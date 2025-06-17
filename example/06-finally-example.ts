import { BaseRunner } from '../src'

interface WorkerOptions {
  shouldFail?: boolean
  timeout?: number
}

class ExampleWorker extends BaseRunner {
  private shouldFail: boolean
  private connections: string[] = []
  private tempFiles: string[] = []

  constructor(options: WorkerOptions = {}) {
    super({ timeout: options.timeout })
    this.shouldFail = options.shouldFail || false
  }

  protected override async internalPrepare(): Promise<void> {
    console.log('🔧 Preparing worker...')

    // Simulate setting up connections and temp files
    this.connections.push('database-connection-1', 'cache-connection-2')
    this.tempFiles.push('/tmp/work-file-1.tmp', '/tmp/work-file-2.tmp')

    console.log(`   📡 Created ${this.connections.length} connections`)
    console.log(`   📄 Created ${this.tempFiles.length} temp files`)

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  protected override async internalRun(): Promise<string | undefined> {
    console.log('🏃 Running worker...')

    await new Promise((resolve) => setTimeout(resolve, 200))

    if (this.shouldFail) {
      return 'Worker failed because shouldFail was set to true'
    }

    console.log('   ✅ Work completed successfully')
    return undefined
  }

  protected override async internalRelease(): Promise<void> {
    console.log('🧹 Releasing worker resources...')

    // Normal cleanup
    await new Promise((resolve) => setTimeout(resolve, 50))
    console.log('   🔄 Released worker-specific resources')
  }

  protected override async internalFinally(): Promise<void> {
    console.log('🏁 Finally block - always runs regardless of outcome!')
    console.log(`   📊 Final status: ${this.status}`)

    if (this.measurement) {
      console.log(`   ⏱️  Total execution time: ${this.measurement.toString()}`)
    }

    // Always cleanup connections and temp files
    if (this.connections.length > 0) {
      console.log(`   🔌 Closing ${this.connections.length} connections`)
      this.connections.length = 0
    }

    if (this.tempFiles.length > 0) {
      console.log(`   🗑️  Deleting ${this.tempFiles.length} temp files`)
      this.tempFiles.length = 0
    }

    if (this.error) {
      console.log(`   ❌ Had error: ${this.error.message}`)
    }

    if (this.failureReason) {
      console.log(`   💥 Failed because: ${this.failureReason}`)
    }

    console.log('   🎯 Cleanup completed - resources guaranteed to be released!')

    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function runExample(description: string, options: WorkerOptions = {}) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📋 Example: ${description}`)
  console.log('='.repeat(60))

  const worker = new ExampleWorker(options)

  worker.on('succeeded', () => console.log('🎉 Worker succeeded!'))
  worker.on('failed', (event) => console.log(`💔 Worker failed: ${event.payload.reason}`))
  worker.on('timed-out', () => console.log('⏰ Worker timed out!'))
  worker.on('error', (event) => console.log(`🚨 Worker error: ${event.error?.message}`))

  try {
    await worker.run()
  } catch (error) {
    console.log(`🚨 Unexpected error: ${error}`)
  }

  console.log(`\n🏁 Final state: ${worker.status}`)
}

async function main() {
  console.log('🧪 Testing BaseRunner internalFinally Feature')

  // Example 1: Successful run
  await runExample('Successful Worker Run')

  // Example 2: Failed run
  await runExample('Failed Worker Run', { shouldFail: true })

  // Example 3: Timed out run
  await runExample('Timed Out Worker Run', { timeout: 150 }) // Will timeout during run phase

  // Example 4: Skipped run
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📋 Example: Skipped Worker Run`)
  console.log('='.repeat(60))

  const skippedWorker = new ExampleWorker()
  skippedWorker.on('skipped', () => console.log('⏭️  Worker was skipped!'))

  await skippedWorker.skip('Not needed for this demo')
  console.log(`\n🏁 Final state: ${skippedWorker.status}`)

  console.log(`\n${'='.repeat(60)}`)
  console.log('✅ All examples completed!')
  console.log('Notice how internalFinally always runs and cleans up resources!')
  console.log('='.repeat(60))
}

main().catch(console.error)
