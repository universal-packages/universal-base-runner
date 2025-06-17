# Base Runner

[![npm version](https://badge.fury.io/js/@universal-packages%2Fbase-runner.svg)](https://www.npmjs.com/package/@universal-packages/base-runner)
[![Testing](https://github.com/universal-packages/universal-base-runner/actions/workflows/testing.yml/badge.svg)](https://github.com/universal-packages/universal-base-runner/actions/workflows/testing.yml)
[![codecov](https://codecov.io/gh/universal-packages/universal-base-runner/branch/main/graph/badge.svg?token=CXPJSN8IGL)](https://codecov.io/gh/universal-packages/universal-base-runner)

Base class for runner oriented functionalities. It handles the lifecycle of a runner so you just worry about the implementation of what is running.

The BaseRunner provides a state machine with events for the different phases: prepare → run → release → finally, with support for stopping, skipping, timeouts, and error handling.

# Getting Started

```shell
npm install @universal-packages/base-runner
```

# Usage

## BaseRunner `class`

The `BaseRunner` class is designed to be extended. It provides a complete lifecycle management system for any kind of runner (workers, tasks, processes, etc.).

```ts
import { BaseRunner } from '@universal-packages/base-runner'

class MyWorker extends BaseRunner {
  protected async internalPrepare(): Promise<void> {
    // Setup your worker
    console.log('Setting up worker...')
  }

  protected async internalRun(): Promise<string | Error | void> {
    // Do the actual work
    console.log('Working...')
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Return for success, or a string for failure reason, or an error for failure
    return
  }

  protected async internalRelease(): Promise<void> {
    // Cleanup after work
    console.log('Cleaning up...')
  }

  protected async internalStop(): Promise<void> {
    // Handle stopping the work
    console.log('Stopping work...')
  }

  protected async internalFinally(): Promise<void> {
    // Always cleanup, regardless of outcome
    console.log('Cleaning up always...')
  }
}

const worker = new MyWorker({ timeout: 5000 })

worker.on('succeeded', (event) => {
  console.log('Worker completed successfully!')
})

worker.on('failed', (event) => {
  console.log('Worker failed:', event.payload.reason)
})

worker.on('timed-out', (event) => {
  console.log('Worker timed out at:', event.payload.timedOutAt)
})

await worker.run()

// Check final status
console.log('Final status:', worker.status) // 'succeeded', 'failed', 'timed-out', etc.
```

### Constructor <small><small>`constructor`</small></small>

```ts
new BaseRunner(options?: BaseRunnerOptions)
```

Creates a new BaseRunner instance.

#### BaseRunnerOptions

All options from [@universal-packages/event-emitter](https://github.com/universal-packages/universal-event-emitter?tab=readme-ov-file#options) are supported.

- **`timeout`** `Number` `optional`
  The timeout in milliseconds. If the runner takes longer than this time, it will be stopped.
  Timeout only applies to the running state. Preparation and releasing states are not affected.

### Status Lifecycle

The BaseRunner follows a specific state machine:

1. **`Idle`** - Initial state
2. **`Preparing`** - Running `internalPrepare()`
3. **`Running`** - Running `internalRun()`
4. **`Releasing`** - Running `internalRelease()`
5. **`Stopping`** - Trying to stop by running `internalStop()`
6. **Final states**: `Succeeded`, `Failed`, `Error`, `Stopped`, `TimedOut`, or `Skipped`
   - **`internalFinally()`** runs after reaching any final state, before emitting the final event

### Getters

#### status

```ts
get status(): Status
```

Returns the current status of the runner.

```ts
const runner = new MyWorker()
console.log(runner.status) // Status.Idle

await runner.run()
console.log(runner.status) // Status.Succeeded, Status.Failed, etc.
```

#### error

```ts
get error(): Error | null
```

Returns the error that occurred during execution, or `null` if no error occurred.

```ts
runner.on('error', () => {
  console.log('Error occurred:', runner.error?.message)
})
```

#### failureReason

```ts
get failureReason(): string | null
```

Returns the failure reason or `null` if the runner didn't fail.

```ts
runner.on('failed', () => {
  console.log('Failed because:', runner.failureReason)
})
```

#### skipReason

```ts
get skipReason(): string | null
```

Returns the reason the runner was skipped, or `null` if it wasn't skipped.

```ts
runner.skip('Not needed today')
console.log(runner.skipReason) // "Not needed today"
```

#### startedAt

```ts
get startedAt(): Date | null
```

Returns the date when the runner started execution, or `null` if it hasn't started or was skipped.

```ts
runner.on('running', () => {
  console.log('Started at:', runner.startedAt)
})
```

#### finishedAt

```ts
get finishedAt(): Date | null
```

Returns the date when the runner finished execution, or `null` if it hasn't finished yet.

```ts
runner.on('succeeded', () => {
  console.log('Finished at:', runner.finishedAt)
  console.log('Duration:', runner.finishedAt.getTime() - runner.startedAt.getTime())
})
```

#### measurement

```ts
get measurement(): Measurement | null
```

Returns the time measurement of the entire execution, or `null` if the runner hasn't finished yet. This includes preparation, running, and release phases.

```ts
runner.on('succeeded', () => {
  console.log('Total execution time:', runner.measurement?.toString())
})
```

The BaseRunner provides boolean getter methods for easy status checking:

#### isIdle

```ts
get isIdle(): boolean
```

Returns `true` if the runner is in the `Idle` state.

#### isPreparing

```ts
get isPreparing(): boolean
```

Returns `true` if the runner is in the `Preparing` state.

#### isRunning

```ts
get isRunning(): boolean
```

Returns `true` if the runner is in the `Running` state.

#### isStopping

```ts
get isStopping(): boolean
```

Returns `true` if the runner is in the `Stopping` state.

#### isReleasing

```ts
get isReleasing(): boolean
```

Returns `true` if the runner is in the `Releasing` state.

#### isStopped

```ts
get isStopped(): boolean
```

Returns `true` if the runner is in the `Stopped` state.

#### isFailed

```ts
get isFailed(): boolean
```

Returns `true` if the runner is in the `Failed` state.

#### isSucceeded

```ts
get isSucceeded(): boolean
```

Returns `true` if the runner is in the `Succeeded` state.

#### isTimedOut

```ts
get isTimedOut(): boolean
```

Returns `true` if the runner is in the `TimedOut` state.

#### isSkipped

```ts
get isSkipped(): boolean
```

Returns `true` if the runner is in the `Skipped` state.

#### isActive

```ts
get isActive(): boolean
```

Returns `true` if the runner is currently active (preparing, running, or stopping).

#### isFinished

```ts
get isFinished(): boolean
```

Returns `true` if the runner has reached a terminal state (succeeded, failed, stopped, timed out, skipped, or error).

### Instance Methods

#### run

```ts
async run(): Promise<void>
```

Starts the lifecycle of the runner

```ts
const runner = new MyWorker()
await runner.run()
```

#### stop

```ts
async stop(reason?: string): Promise<void>
```

Attempts to stop the runner. The behavior depends on the current state.

```ts
const runner = new MyWorker()
const runPromise = runner.run()

// Stop after 2 seconds
setTimeout(() => runner.stop('User requested'), 2000)

await runPromise
```

#### skip

```ts
skip(reason?: string): void
```

Skips the runner execution. Can only be called when the runner is in `Idle` state.

```ts
const runner = new MyWorker()
runner.skip('Not needed')
// Runner will be in 'Skipped' state
```

#### fail

```ts
fail(reason: string | Error): void
```

Marks the runner as failed without going through the normal lifecycle. Can only be called when the runner is in `Idle` state. This is useful for pre-execution validation failures.

```ts
const runner = new MyWorker()

// Check some precondition
if (!isConfigurationValid()) {
  runner.fail('Invalid configuration')
  // Runner will be in 'Failed' state immediately
  return
}

// Or fail with an Error object
try {
  validateInput()
} catch (error) {
  runner.fail(error)
  return
}

await runner.run()
```

#### waitForStatusLevel

```ts
async waitForStatusLevel(status: Status): Promise<void>
```

Waits for the runner to reach a certain status level. Useful for waiting for completion regardless of the final state.

```ts
const runner = new MyWorker()
const runPromise = runner.run()

// Wait for any final status (succeeded, failed, stopped, etc.)
await runner.waitForStatusLevel(Status.Succeeded)
```

### Protected Methods (Override These)

#### internalPrepare

```ts
protected async internalPrepare(): Promise<void>
```

Override this method to implement your preparation logic. This runs before the main work.

```ts
protected async internalPrepare(): Promise<void> {
  this.database = await connectToDatabase()
  this.logger = new Logger('my-worker')
}
```

#### internalRun

```ts
protected async internalRun(): Promise<string | undefined>
```

**Required override.** Implement your main work logic here.

- Return `undefined` or don't return anything for success
- Return a string to indicate failure with a reason

```ts
protected async internalRun(): Promise<string | undefined> {
  try {
    await this.processData()
    return undefined // Success
  } catch (error) {
    return `Processing failed: ${error.message}` // Failure
  }
}
```

#### internalRelease

```ts
protected async internalRelease(): Promise<void>
```

Override this method to implement cleanup logic. This always runs after the work, regardless of success or failure.

```ts
protected async internalRelease(): Promise<void> {
  await this.database?.close()
  this.logger?.close()
}
```

#### internalStop

```ts
protected async internalStop(): Promise<void>
```

Override this method to handle stop requests. This should interrupt the current work.

```ts
protected async internalStop(): Promise<void> {
  this.shouldStop = true
  await this.currentTask?.cancel()
}
```

#### internalFinally

```ts
protected async internalFinally(): Promise<void>
```

Override this method to implement cleanup logic that should **always** run after the runner reaches any finished state, regardless of success, failure, error, timeout, stop, or skip. This is similar to a `finally` block in try-catch-finally.

This method is called after the final status is set but before the final event is emitted, giving you access to the final state while ensuring cleanup always happens.

**Important Notes:**

- This method runs for **all** terminal states: `Succeeded`, `Failed`, `Error`, `Stopped`, `TimedOut`, and `Skipped`
- If this method throws an error, it will emit an `error` event but won't prevent the final status event from being emitted
- This method has access to the final status, measurements, and timing information
- This method is called exactly once per runner lifecycle

```ts
protected async internalFinally(): Promise<void> {
  // Always runs regardless of outcome
  await this.closeConnections()
  await this.cleanupTempFiles()

  // You have access to final state
  this.logger?.info(`Runner finished with status: ${this.status}`)

  if (this.error) {
    this.logger?.error('Runner had error:', this.error)
  }

  if (this.measurement) {
    this.logger?.info(`Total execution time: ${this.measurement.toString()}`)
  }
}
```

**Use Cases:**

- Cleanup resources that should always be released
- Logging final status and metrics
- Sending notifications regardless of outcome
- Closing database connections or file handles
- Cleanup temporary files or directories

### Events

The BaseRunner emits events for each phase of the lifecycle:

#### Status Events

- **`preparing`** - Preparation phase started
- **`prepared`** - Preparation phase completed
- **`running`** - Running phase started
- **`releasing`** - Release phase started
- **`released`** - Release phase completed
- **`stopping`** - Stopping phase started

#### Final Status Events

- **`succeeded`** - Runner completed successfully
- **`failed`** - Runner failed (returned failure reason or was marked as failed using `fail()`)
- **`stopped`** - Runner was stopped
- **`timed-out`** - Runner exceeded timeout
- **`skipped`** - Runner was skipped
- **`error`** - An error occurred during execution

#### Other Events

- **`warning`** - Warning event (e.g., invalid operations)

All events include timing information and relevant payloads:

```ts
worker.on('succeeded', (event) => {
  console.log('Duration:', event.measurement.toString())
  console.log('Started at:', event.payload.startedAt)
  console.log('Finished at:', event.payload.finishedAt)
})

worker.on('failed', (event) => {
  console.log('Failure reason:', event.payload.reason)
  console.log('Duration:', event.measurement.toString())
})

worker.on('stopped', (event) => {
  console.log('Stop reason:', event.payload.reason)
  console.log('Stopped at:', event.payload.stoppedAt)
})

worker.on('timed-out', (event) => {
  console.log('Runner timed out at:', event.payload.timedOutAt)
  // Note: Final status will be TimedOut, not Stopped
})
```

### Example: File Processing Worker

```ts
import { BaseRunner, Status } from '@universal-packages/base-runner'
import { readFile, writeFile } from 'fs/promises'

class FileProcessor extends BaseRunner {
  private inputFile: string
  private outputFile: string
  private data: string[]
  private processedData: string[] = []

  private shouldStop: boolean = false

  constructor(inputFile: string, outputFile: string, options?: BaseRunnerOptions) {
    super(options)
    this.inputFile = inputFile
    this.outputFile = outputFile
  }

  protected async internalPrepare(): Promise<void> {
    // Validate files exist, setup temp directories, etc.
    this.data = (await readFile(this.inputFile, 'utf-8')).split('\n')
  }

  protected async internalRun(): Promise<string | undefined> {
    try {
      // Process the data
      let processedData: string[] = []

      for (const line of this.data) {
        if (this.shouldStop) break

        processedData.push(line.toUpperCase())
      }

      this.processedData = processedData
    } catch (error) {
      return `Processing failed: ${error.message}`
    }
  }

  protected async internalRelease(): Promise<void> {
    // Write output file if we have processed data
    if (this.processedData) {
      await writeFile(this.outputFile, this.processedData)
    }
  }

  protected async internalStop(): Promise<void> {
    // Cancel any ongoing operations
    console.log('Stopping file processing...')
    this.shouldStop = true
  }

  protected async internalFinally(): Promise<void> {
    // Always cleanup, regardless of success or failure
    console.log(`File processing completed with status: ${this.status}`)

    if (this.measurement) {
      console.log(`Total processing time: ${this.measurement.toString()}`)
    }

    // Any cleanup that should always happen
    this.processedData = []
  }
}

// Usage
const processor = new FileProcessor('input.txt', 'output.txt', { timeout: 10000 })

processor.on('succeeded', () => console.log('File processed successfully!'))
processor.on('failed', (event) => console.log('Processing failed:', event.payload.reason))
processor.on('timed-out', () => console.log('Processing timed out'))

await processor.run()
```

## Typescript

This library is developed in TypeScript and shipped fully typed.

## Contributing

The development of this library happens in the open on GitHub, and we are grateful to the community for contributing bugfixes and improvements. Read below to learn how you can take part in improving this library.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributing Guide](./CONTRIBUTING.md)

### License

[MIT licensed](./LICENSE).
