import { EventEmitterOptions } from '@universal-packages/event-emitter'

export interface BaseRunnerOptions extends EventEmitterOptions {
  /**
   * The timeout in milliseconds. If the runner takes longer than this time, it will be stopped.
   * Timeout only applies to the running state. Preparation and releasing states are not affected.
   */
  timeout?: number
}
