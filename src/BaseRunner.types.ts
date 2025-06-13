import { EventEmitterOptions, InternalEventMap } from '@universal-packages/event-emitter'

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

export interface BaseRunnerEventMap extends InternalEventMap {
  preparing: { startedAt: Date }
  prepared: { startedAt: Date; finishedAt: Date }
  running: { startedAt: Date }
  'timed-out': { startedAt: Date; timedOutAt: Date }
  releasing: { startedAt: Date }
  released: { startedAt: Date; finishedAt: Date }
  stopping: { startedAt: Date; stoppingAt: Date; reason?: string }
  stopped: { reason?: string; startedAt: Date; stoppedAt: Date }
  succeeded: { startedAt: Date; finishedAt: Date }
  failed: { reason: string | Error; startedAt: Date; finishedAt: Date }
  skipped: { reason?: string; skippedAt: Date }
  warning: any
}
