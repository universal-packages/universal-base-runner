# Base Runner

[![npm version](https://badge.fury.io/js/@universal-packages%2Fbase-runner.svg)](https://www.npmjs.com/package/@universal-packages/base-runner)
[![Testing](https://github.com/universal-packages/universal-base-runner/actions/workflows/testing.yml/badge.svg)](https://github.com/universal-packages/universal-base-runner/actions/workflows/testing.yml)
[![codecov](https://codecov.io/gh/universal-packages/universal-base-runner/branch/main/graph/badge.svg?token=CXPJSN8IGL)](https://codecov.io/gh/universal-packages/universal-base-runner)

Base class for runner oriented functionalities. It handles the lifecycle of a runner so you just worry about the implementation of what is running.

The BaseRunner provides a state machine with events for the different phases: prepare → run → release, with support for stopping, skipping, timeouts, and error handling.

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
- **`failed`** - Runner failed (returned failure reason)
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
