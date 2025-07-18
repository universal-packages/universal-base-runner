import { EventEmitter } from '@universal-packages/event-emitter'
import { Measurement, TimeMeasurer } from '@universal-packages/time-measurer'

import { BaseRunnerEventMap, BaseRunnerOptions, PrepareOnMultiMode, ReleaseOnMultiMode, RunMode, Status } from './BaseRunner.types'

const STATUS_LEVEL_MAP = {
  [Status.Idle]: 0,
  [Status.Preparing]: 1,
  [Status.Running]: 2,
  [Status.Stopping]: 2,
  [Status.Releasing]: 3,
  [Status.Succeeded]: 4,
  [Status.Failed]: 4,
  [Status.Error]: 4,
  [Status.Stopped]: 4,
  [Status.Skipped]: 4,
  [Status.TimedOut]: 4
}

const LEVEL_STATUSES_MAP = {
  0: [Status.Idle],
  1: [Status.Preparing],
  2: [Status.Running, Status.Stopping],
  3: [Status.Releasing],
  4: [Status.Stopped, Status.Failed, Status.Error, Status.Succeeded, Status.Skipped, Status.TimedOut]
}

export class BaseRunner<TEventMap extends BaseRunnerEventMap = BaseRunnerEventMap> extends EventEmitter<TEventMap> {
  declare public readonly options: BaseRunnerOptions

  private _status: Status = Status.Idle
  private _timeout: NodeJS.Timeout | null = null
  private _startedAt: Date = new Date()
  private _measurer: TimeMeasurer = TimeMeasurer.start()
  private _stoppingReason?: string
  private _markedAsStopping: boolean = false
  private _stoppingIsActive: boolean = false
  private _failureReason?: string | Error | void
  private _runHasFinished: boolean = false
  private _error?: Error
  private _skipReason?: string
  private _finishedAt: Date | null = null
  private _measurement: Measurement | null = null
  private _timedOut: boolean = false
  private _prepared: boolean = false

  public get status(): Status {
    return this._status
  }

  public get error(): Error | null {
    return this._error || null
  }

  public get failureReason(): string | Error | null {
    return this._failureReason || null
  }

  public get skipReason(): string | null {
    return this._skipReason || null
  }

  public get startedAt(): Date | null {
    return this._status !== Status.Idle && this._status !== Status.Skipped ? this._startedAt : null
  }

  public get finishedAt(): Date | null {
    return this._finishedAt
  }

  public get measurement(): Measurement | null {
    return this._measurement
  }

  public get isIdle(): boolean {
    return this._status === Status.Idle
  }

  public get isPreparing(): boolean {
    return this._status === Status.Preparing
  }

  public get isRunning(): boolean {
    return this._status === Status.Running
  }

  public get isStopping(): boolean {
    return this._status === Status.Stopping
  }

  public get isReleasing(): boolean {
    return this._status === Status.Releasing
  }

  public get isStopped(): boolean {
    return this._status === Status.Stopped
  }

  public get isFailed(): boolean {
    return this._status === Status.Failed
  }

  public get isError(): boolean {
    return this._status === Status.Error
  }

  public get isSucceeded(): boolean {
    return this._status === Status.Succeeded
  }

  public get isTimedOut(): boolean {
    return this._status === Status.TimedOut
  }

  public get isSkipped(): boolean {
    return this._status === Status.Skipped
  }

  public get isActive(): boolean {
    return STATUS_LEVEL_MAP[this._status] > STATUS_LEVEL_MAP[Status.Idle] && STATUS_LEVEL_MAP[this._status] < STATUS_LEVEL_MAP[Status.Succeeded]
  }

  public get isFinished(): boolean {
    return STATUS_LEVEL_MAP[this._status] >= STATUS_LEVEL_MAP[Status.Succeeded]
  }

  public constructor(options?: BaseRunnerOptions) {
    super({
      runMode: RunMode.Single,
      prepareOnMultiMode: PrepareOnMultiMode.Always,
      releaseOnMultiMode: ReleaseOnMultiMode.Never,
      newListenerEvent: false,
      verboseMemoryLeak: false,
      maxListeners: 0,
      ...options
    })
  }

  /**
   * Starts the life cycle of the runner
   * @returns {Promise<void>}
   */
  public async run(): Promise<void> {
    switch (this._status) {
      case Status.Running:
      case Status.Preparing:
      case Status.Releasing:
        this._emitWarningOrThrow('Run was called but runner is already running')
        return
      case Status.Idle:
        break
      default:
        this._emitWarningOrThrow('Run was called but runner has already finished')
        return
    }

    this._startedAt = new Date()
    this._measurer = TimeMeasurer.start()

    let itShouldPrepare = false

    if (this.options.runMode === RunMode.Single) {
      // Always prepare in single mode
      itShouldPrepare = true
    } else if (this.options.runMode === RunMode.Multi) {
      // In multi mode, check the prepareOnMultiMode option
      if (this.options.prepareOnMultiMode === PrepareOnMultiMode.Always) {
        itShouldPrepare = true
      } else if (this.options.prepareOnMultiMode === PrepareOnMultiMode.OnFirstRun && !this._prepared) {
        itShouldPrepare = true
      } else if (this.options.prepareOnMultiMode === PrepareOnMultiMode.Never) {
        itShouldPrepare = false
      }
    }

    if (itShouldPrepare) {
      try {
        const prepareMeasurer = TimeMeasurer.start()
        const prepareStartedAt = new Date()

        if (await this._checkForStopping(false)) return

        this._status = Status.Preparing
        this.emit('preparing', { payload: { startedAt: prepareStartedAt } })

        await this.internalPrepare()

        this.emit('prepared', {
          measurement: prepareMeasurer.finish(),
          payload: { startedAt: prepareStartedAt, finishedAt: new Date() }
        })

        this._prepared = true
      } catch (error: unknown) {
        this._status = Status.Error
        this._error = error as Error
        await this._executeInternalFinally()
        this.emit('error' as any, { error: error as Error, message: 'Runner preparation failed' })
        this._resetIfMultiMode()
        return
      }
    }

    if (await this._checkForStopping(false)) return

    try {
      this._status = Status.Running
      this.emit('running', { payload: { startedAt: this._startedAt } })

      const internalRunPromise = this.internalRun()
      let internalRunCompleted = false
      let timeoutOccurred = false

      await this._dispatchMarkedAsStopping()

      // Race between internal run completion and timeout
      if (this.options.timeout) {
        // Create timeout promise that resolves when timeout occurs
        const timeoutPromise = new Promise<void>((resolve) => {
          this._timeout = setTimeout(() => {
            this._timedOut = true
            timeoutOccurred = true
            // Don't call this.stop() here as it creates race conditions
            // Just mark as timed out and let the main flow handle stopping
            resolve()
          }, this.options.timeout)
        })

        await Promise.race([
          internalRunPromise.then((result) => {
            internalRunCompleted = true
            this._failureReason = result
            return result
          }),
          timeoutPromise
        ])

        // If we timed out, handle the stopping flow
        if (timeoutOccurred && !internalRunCompleted) {
          this._stoppingReason = 'Runner timed out'
          await this._attemptStop(false) // Don't call internalStop since we're letting it run in background

          // Internal run is still running in background, but we proceed with lifecycle
          internalRunPromise.catch(() => {
            // Silently catch any errors from the background internalRun to prevent unhandled rejection
          })
        }
      } else {
        this._failureReason = await internalRunPromise
        internalRunCompleted = true
      }

      // Only set run as finished if internal run actually completed (not timed out)
      if (internalRunCompleted) {
        this._runHasFinished = true
      }

      if (this._timeout) clearTimeout(this._timeout)
    } catch (error: unknown) {
      this._status = Status.Error
      this._error = error as Error
      await this._executeInternalFinally()
      this.emit('error' as any, { error: error as Error, message: 'Run failed' })
      this._resetIfMultiMode()
      return
    }

    let shouldRelease = false

    if (this.options.runMode === RunMode.Single) {
      shouldRelease = true
    } else if (this.options.runMode === RunMode.Multi) {
      if (this.options.releaseOnMultiMode === ReleaseOnMultiMode.Always) {
        shouldRelease = true
      }
    }

    if (shouldRelease) {
      try {
        const releasingStartedAt = new Date()
        const releasingMeasurer = TimeMeasurer.start()

        this._status = Status.Releasing
        this.emit('releasing', { payload: { startedAt: releasingStartedAt } })

        await this.internalRelease()

        this.emit('released', { measurement: releasingMeasurer.finish(), payload: { startedAt: releasingStartedAt, finishedAt: new Date() } })
      } catch (error: unknown) {
        this._status = Status.Error
        this._error = error as Error
        await this._executeInternalFinally()
        this.emit('error' as any, { error: error as Error, message: 'Release failed' })
        this._resetIfMultiMode()
        return
      }
    }

    if (this._stoppingIsActive) {
      if (this._timedOut) {
        this._status = Status.TimedOut
        this._finishedAt = new Date()
        this._measurement = this._measurer.finish()
        await this._executeInternalFinally()
        this.emit('timed-out', { message: 'Timeout', payload: { startedAt: this._startedAt, timedOutAt: new Date() } })
      } else {
        this._status = Status.Stopped
        this._measurement = this._measurer.finish()
        this._finishedAt = new Date()
        await this._executeInternalFinally()
        this.emit('stopped', { measurement: this._measurement, payload: { reason: this._stoppingReason, startedAt: this._startedAt, stoppedAt: this._finishedAt } })
      }

      this._resetIfMultiMode()
      return
    }

    if (this._failureReason) {
      this._status = Status.Failed
      this._finishedAt = new Date()
      this._measurement = this._measurer.finish()
      await this._executeInternalFinally()
      this.emit('failed', { measurement: this._measurement, payload: { reason: this._failureReason, startedAt: this._startedAt, finishedAt: this._finishedAt } })
    } else {
      this._status = Status.Succeeded
      this._finishedAt = new Date()
      this._measurement = this._measurer.finish()
      await this._executeInternalFinally()
      this.emit('succeeded', { measurement: this._measurement, payload: { startedAt: this._startedAt, finishedAt: this._finishedAt } })
    }

    this._resetIfMultiMode()
  }

  /**
   * Tries to stop the runner, you can stop a runner before and after it is prepared, an actual stop attempt is done while running,
   * releasing always happens if the runner was prepared.
   * @param {string} [reason] - The reason for stopping the runner
   * @returns {Promise<void>}
   */
  public async stop(reason?: string): Promise<void> {
    switch (this._status) {
      case Status.Idle:
        this._emitWarningOrThrow('Stop was called but runner is not running')
        return
      case Status.Stopping:
        this._emitWarningOrThrow('Stop was called but runner is already stopping')
        return
      case Status.Skipped:
        this._emitWarningOrThrow('Stop was called but runner was skipped')
        return
      case Status.Releasing:
        this._emitWarningOrThrow('Stop was called but runner is releasing')
        return
      case Status.Failed:
      case Status.Error:
      case Status.Succeeded:
      case Status.Stopped:
      case Status.TimedOut:
        this._emitWarningOrThrow('Stop was called but runner has already finished')
        return
      case Status.Running:
        if (this._runHasFinished) {
          this._emitWarningOrThrow('Stop was called but runner has already finished')
          return
        }
      default:
        break
    }

    this._stoppingReason = reason

    if (this._status === Status.Running) {
      await this._attemptStop()
    } else {
      this._markedAsStopping = true
    }

    await this.waitForStatusLevel(this._timedOut ? Status.TimedOut : Status.Stopped)
  }

  /**
   * Skips the runner, this is just a flag, when marked as skipped, the runner will not do anything.
   * @param {string} [reason] - The reason for skipping the runner
   * @returns {void}
   */
  public async skip(reason?: string): Promise<void> {
    switch (this._status) {
      case Status.Idle:
        this._status = Status.Skipped
        this._skipReason = reason
        await this._executeInternalFinally()
        this.emit('skipped', { payload: { reason: this._skipReason, skippedAt: new Date() } })
        this._resetIfMultiMode()
        break
      case Status.Skipped:
        this._emitWarningOrThrow('Skip was called but runner is already skipped')
        return
      default:
        this._emitWarningOrThrow('Skip was called but runner can only be skipped when idle')
        return
    }
  }

  /**
   * Marks the runner as failed without going through the normal lifecycle.
   * @param {string | Error} reason - The reason for the failure
   * @returns {void}
   */
  public async fail(reason: string | Error): Promise<void> {
    switch (this._status) {
      case Status.Idle:
        this._status = Status.Failed
        this._failureReason = reason
        this._startedAt = new Date()
        this._finishedAt = new Date()
        this._measurement = this._measurer.finish()
        await this._executeInternalFinally()
        this.emit('failed', { measurement: this._measurement, payload: { reason: this._failureReason, startedAt: this._startedAt, finishedAt: this._finishedAt } })
        this._resetIfMultiMode()
        break
      case Status.Failed:
        this._emitWarningOrThrow('Fail was called but runner is already failed')
        return
      default:
        this._emitWarningOrThrow('Fail was called but runner can only be failed when idle')
        return
    }
  }

  /**
   * Waits for the runner to reach a certain status level for example if you want to wait for the runner to be succeeded,
   * you can use this method to wait for that status and it will still resolve if the runner fails since it will never succeed.
   * @param {Status} status - The status to wait for
   * @returns {Promise<void>}
   */
  public async waitForStatusLevel(status: Status): Promise<void> {
    if (STATUS_LEVEL_MAP[status] <= STATUS_LEVEL_MAP[this._status]) return

    await Promise.any(LEVEL_STATUSES_MAP[STATUS_LEVEL_MAP[status]].map((status: Status) => this.waitFor(status as any)))
  }

  protected async internalPrepare(): Promise<void> {}
  protected async internalRun(): Promise<string | Error | void> {
    throw new Error('internalRun is not implemented, this runner will not run')
  }
  protected async internalRelease(): Promise<void> {}
  protected async internalStop(): Promise<void> {
    throw new Error('internalStop is not implemented, this runner will just run indefinitely (probably)')
  }
  protected async internalFinally(): Promise<void> {}

  private _emitWarningOrThrow(message: string): void {
    if (this.hasListeners('warning')) {
      this.emit('warning' as any, { message })
    } else {
      throw new Error(message)
    }
  }

  private async _executeInternalFinally(): Promise<void> {
    try {
      await this.internalFinally()
    } catch (error: unknown) {
      this.emit('error' as any, { error: error as Error, message: 'Internal finally failed' })
    }
  }

  private async _checkForStopping(callInternalStop: boolean = true): Promise<boolean> {
    await this._dispatchMarkedAsStopping(callInternalStop)

    if (this._status === Status.Stopping) {
      this._status = Status.Stopped
      await this._executeInternalFinally()
      this.emit('stopped', { measurement: this._measurer.finish(), payload: { reason: this._stoppingReason, startedAt: this._startedAt, stoppedAt: new Date() } })
      this._resetIfMultiMode()

      return true
    }

    return false
  }

  private async _dispatchMarkedAsStopping(callInternalStop: boolean = true): Promise<void> {
    if (this._markedAsStopping) await this._attemptStop(callInternalStop)
  }

  private async _attemptStop(callInternalStop: boolean = true) {
    try {
      if (callInternalStop) await this.internalStop()

      // We are now only interested in this stop call, so we clear the timeout, since timed out will call stop as well
      if (this._timeout) clearTimeout(this._timeout)

      this.emit('stopping', { payload: { startedAt: this._startedAt, stoppingAt: new Date(), reason: this._stoppingReason } })
      this._status = Status.Stopping
      this._stoppingIsActive = true
    } catch (error: unknown) {
      this.emit('error' as any, { error: error as Error, message: 'Attempt to stop runner failed' })
    }
  }

  private _resetIfMultiMode(): void {
    if (this.options.runMode === RunMode.Multi) {
      this._resetToIdle()
    }
  }

  private _resetToIdle(): void {
    this._status = Status.Idle
    this._timeout = null
    this._stoppingReason = undefined
    this._markedAsStopping = false
    this._stoppingIsActive = false
    this._runHasFinished = false
    this._finishedAt = null
    this._timedOut = false
  }
}
