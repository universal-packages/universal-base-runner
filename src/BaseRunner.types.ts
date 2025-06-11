import { EventEmitterOptions } from '@universal-packages/event-emitter'

export interface BaseRunnerOptions extends EventEmitterOptions {
  /**
   * The timeout in milliseconds. If the runner takes longer than this time, it will be stopped.
   * Timeout only applies to the running state. Preparation and releasing states are not affected.
   */
  timeout?: number
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
  Skipped = 'skipped'
}

export interface BaseRunnerEvents {
  [Status.Preparing]: { startedAt: Date }
  prepared: { startedAt: Date; finishedAt: Date }
  [Status.Running]: { startedAt: Date }
  [Status.Releasing]: { startedAt: Date }
  released: { startedAt: Date; finishedAt: Date }
  [Status.Succeeded]: { startedAt: Date; finishedAt: Date }
  'timed-out': { startedAt: Date; timedOutAt: Date }
  [Status.Failed]: { reason?: string; startedAt: Date; finishedAt: Date }
  [Status.Stopping]: { reason?: string; startedAt: Date; stoppingAt: Date }
  [Status.Stopped]: { reason?: string; startedAt: Date; stoppedAt: Date }
  [Status.Skipped]: { reason?: string; skippedAt: Date }
  warning: {}
}
