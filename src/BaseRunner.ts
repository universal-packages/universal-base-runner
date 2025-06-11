import { EventEmitter } from '@universal-packages/event-emitter'
import { Measurement, TimeMeasurer } from '@universal-packages/time-measurer'

import { BaseRunnerEvents, BaseRunnerOptions, Status } from './BaseRunner.types'

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
  [Status.Skipped]: 4
}

const LEVEL_STATUSES_MAP = {
  0: [Status.Idle],
  1: [Status.Preparing],
  2: [Status.Running, Status.Stopping],
  3: [Status.Releasing],
  4: [Status.Stopped, Status.Failed, Status.Error, Status.Succeeded, Status.Skipped]
}

export class BaseRunner<TEventMap extends BaseRunnerEvents = BaseRunnerEvents> extends EventEmitter<TEventMap> {
  public override readonly options: BaseRunnerOptions

  private _status: Status = Status.Idle
  private _timeout: NodeJS.Timeout | null = null
  private _startedAt: Date = new Date()
  private _measurer: TimeMeasurer = TimeMeasurer.start()
  private _stoppingReason?: string
  private _markedAsStopping: boolean = false
  private _stoppingIsActive: boolean = false
  private _failureReason?: string
  private _runHasFinished: boolean = false
  private _error?: Error
  private _skipReason?: string
  private _finishedAt: Date | null = null
  private _measurement: Measurement | null = null

  public get status(): Status {
    return this._status
  }

  public get error(): Error | null {
    return this._error || null
  }

  public get failureReason(): string | null {
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

  public constructor(options?: BaseRunnerOptions) {
    super({ ignoreErrors: true, maxListeners: 0, verboseMemoryLeak: false, ...options })
    this.options = { ...options }
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
    } catch (error: unknown) {
      this._status = Status.Error
      this._error = error as Error
      this.emit('error', { error: error as Error, message: 'Runner preparation failed' })
      return
    }

    if (await this._checkForStopping(false)) return

    try {
      this._status = Status.Running
      this.emit('running', { payload: { startedAt: this._startedAt } })

      if (this.options.timeout) {
        this._timeout = setTimeout(() => {
          this.emit('timed-out', { message: 'Timeout', payload: { timeout: this.options.timeout } })
          this.stop('Runner timed out')
        }, this.options.timeout)
      }

      const internalRunPromise = this.internalRun()

      await this._dispatchMarkedAsStopping()

      this._failureReason = await internalRunPromise
      this._runHasFinished = true

      if (this._timeout) clearTimeout(this._timeout)
    } catch (error: unknown) {
      this._status = Status.Error
      this._error = error as Error
      this.emit('error', { error: error as Error })
    }

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
      this.emit('error', { error: error as Error, message: 'Release failed' })
      return
    }

    if (this._stoppingIsActive) {
      this._status = Status.Stopped
      this._measurement = this._measurer.finish()
      this._finishedAt = new Date()
      this.emit('stopped', { measurement: this._measurement, payload: { reason: this._stoppingReason, startedAt: this._startedAt, stoppedAt: this._finishedAt } })
      return
    }

    if (this._failureReason) {
      this._status = Status.Failed
      this._finishedAt = new Date()
      this._measurement = this._measurer.finish()
      this.emit('failed', { measurement: this._measurement, payload: { reason: this._failureReason, startedAt: this._startedAt, finishedAt: this._finishedAt } })
    } else {
      this._status = Status.Succeeded
      this._finishedAt = new Date()
      this._measurement = this._measurer.finish()
      this.emit('succeeded', { measurement: this._measurement, payload: { startedAt: this._startedAt, finishedAt: this._finishedAt } })
    }
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

    await this.waitForStatusLevel(Status.Stopped)
  }

  /**
   * Skips the runner, this is just a flag, when marked as skipped, the runner will not do anything.
   * @param {string} [reason] - The reason for skipping the runner
   * @returns {void}
   */
  public skip(reason?: string): void {
    switch (this._status) {
      case Status.Idle:
        this._status = Status.Skipped
        this._skipReason = reason
        this.emit('skipped', { payload: { reason: this._skipReason, skippedAt: new Date() } })
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
   * Waits for the runner to reach a certain status level for example if you want to wait for the runner to be succeeded,
   * you can use this method to wait for that status and it will still resolve if the runner fails since it will never succeed.
   * @param {Status} status - The status to wait for
   * @returns {Promise<void>}
   */
  public async waitForStatusLevel(status: Status): Promise<void> {
    if (STATUS_LEVEL_MAP[status] <= STATUS_LEVEL_MAP[this._status]) return

    await Promise.any(LEVEL_STATUSES_MAP[STATUS_LEVEL_MAP[status]].map((status: Status) => this.waitFor(status)))
  }

  protected async internalPrepare(): Promise<void> {}
  protected async internalRun(): Promise<string | undefined> {
    throw new Error('internalRun is not implemented, this runner will not run')
  }
  protected async internalRelease(): Promise<void> {}
  protected async internalStop(): Promise<void> {
    throw new Error('internalStop is not implemented, this runner will just run indefinitely (probably)')
  }

  private _emitWarningOrThrow(message: string): void {
    if (this.hasListeners('warning')) {
      this.emit('warning', { message })
    } else {
      throw new Error(message)
    }
  }

  private async _checkForStopping(callInternalStop: boolean = true): Promise<boolean> {
    await this._dispatchMarkedAsStopping(callInternalStop)

    if (this._status === Status.Stopping) {
      this._status = Status.Stopped
      this.emit('stopped', { measurement: this._measurer.finish(), payload: { reason: this._stoppingReason, startedAt: this._startedAt, stoppedAt: new Date() } })

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
      this.emit('error', { error: error as Error, message: 'Attempt to stop runner failed' })
    }
  }
}
