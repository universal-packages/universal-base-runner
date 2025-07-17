import { EventEmitterOptions, InternalEventMap } from '@universal-packages/event-emitter'

export enum RunMode {
  Single = 'single',
  Multi = 'multi'
}

export enum PrepareOnMultiMode {
  Always = 'always',
  Never = 'never',
  OnFirstRun = 'on-first-run'
}

export enum ReleaseOnMultiMode {
  Always = 'always',
  Never = 'never'
}

export interface BaseRunnerOptions extends EventEmitterOptions {
  /**
   * The timeout in milliseconds. If the runner takes longer than this time, it will be stopped.
   * Timeout only applies to the running state. Preparation and releasing states are not affected.
   */
  timeout?: number
  /**
   * The run mode. When set to 'single', the runner can only be run once. When set to 'multi',
   * the runner can be run multiple times and will reset to idle state after completion.
   * @default RunMode.Single
   */
  runMode?: RunMode

  /**
   * Whether to prepare the runner on multi mode.
   * @default PrepareOnMultiMode.Always
   */
  prepareOnMultiMode?: PrepareOnMultiMode

  /**
   * Whether to release the runner on multi mode.
   * @default ReleaseOnMultiMode.Never
   */
  releaseOnMultiMode?: ReleaseOnMultiMode
}

export enum Status {
  Idle = 'idle',
  Preparing = 'preparing',
  Running = 'running',
  Releasing = 'releasing',
  Succeeded = 'succeeded',
  Error = 'error',
  Failed = 'failed',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Skipped = 'skipped',
  TimedOut = 'timed-out'
}

export interface BaseRunnerEventMap extends InternalEventMap {
  preparing: { startedAt: Date }
  prepared: { startedAt: Date; finishedAt: Date }
  running: { startedAt: Date }
  releasing: { startedAt: Date }
  released: { startedAt: Date; finishedAt: Date }
  stopping: { startedAt: Date; stoppingAt: Date; reason?: string }
  stopped: { reason?: string; startedAt: Date; stoppedAt: Date }
  'timed-out': { startedAt: Date; timedOutAt: Date }
  succeeded: { startedAt: Date; finishedAt: Date }
  failed: { reason: string | Error; startedAt: Date; finishedAt: Date }
  skipped: { reason?: string; skippedAt: Date }
  warning: any
}
