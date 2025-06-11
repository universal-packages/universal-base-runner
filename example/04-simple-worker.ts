import { BaseRunner } from '../src'

class SimpleWorker extends BaseRunner {
  private workData: number[] = []
  private result: number = 0

  protected override async internalPrepare(): Promise<void> {
    console.log('📋 SimpleWorker: Preparing work data...')
    // Simulate preparing some data
    this.workData = Array.from({ length: 10 }, (_, i) => i + 1)
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.log('✅ SimpleWorker: Preparation complete')
  }

  protected override async internalRun(): Promise<string | undefined> {
    console.log('🔄 SimpleWorker: Processing data...')

    // Simulate some work
    for (const num of this.workData) {
      this.result += num * 2
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(`📊 SimpleWorker: Calculation result: ${this.result}`)

    // Return undefined for success
    return undefined
  }

  protected override async internalRelease(): Promise<void> {
    console.log('🧹 SimpleWorker: Cleaning up resources...')
    await new Promise((resolve) => setTimeout(resolve, 200))
    console.log('✨ SimpleWorker: Cleanup complete')
  }

  protected override async internalStop(): Promise<void> {
    console.log('🛑 SimpleWorker: Stopping work...')
    // In a real scenario, you'd cancel ongoing operations
  }
}

export async function runSimpleWorkerExample(): Promise<void> {
  console.log('🚀 Running Simple Worker Example')
  console.log('='.repeat(40))

  const worker = new SimpleWorker()

  // Set up event listeners
  worker.on('preparing', (event) => {
    console.log(`📅 Started preparing at: ${event.payload.startedAt.toISOString()}`)
  })

  worker.on('running', (event) => {
    console.log(`🏃 Started running at: ${event.payload.startedAt.toISOString()}`)
  })

  worker.on('succeeded', (event) => {
    console.log(`🎉 Worker succeeded! Duration: ${event.measurement?.toString()}`)
    console.log(`📅 Finished at: ${event.payload.finishedAt.toISOString()}`)
  })

  worker.on('failed', (event) => {
    console.log(`❌ Worker failed: ${event.payload.reason}`)
  })

  try {
    await worker.run()
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }

  console.log('='.repeat(40))
}
