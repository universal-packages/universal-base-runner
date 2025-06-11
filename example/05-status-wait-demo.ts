import { BaseRunner, Status } from '../src'

class StatusDemoWorker extends BaseRunner {
  private workType: 'fast' | 'slow' | 'error'

  constructor(workType: 'fast' | 'slow' | 'error' = 'fast') {
    super()
    this.workType = workType
  }

  protected override async internalPrepare(): Promise<void> {
    console.log(`🔧 StatusDemoWorker: Preparing ${this.workType} work...`)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  protected override async internalRun(): Promise<string | undefined> {
    console.log(`⚡ StatusDemoWorker: Running ${this.workType} work...`)

    switch (this.workType) {
      case 'fast':
        await new Promise((resolve) => setTimeout(resolve, 500))
        break
      case 'slow':
        await new Promise((resolve) => setTimeout(resolve, 3000))
        break
      case 'error':
        await new Promise((resolve) => setTimeout(resolve, 200))
        return 'Simulated work error'
    }

    return undefined
  }

  protected override async internalRelease(): Promise<void> {
    console.log(`🧹 StatusDemoWorker: Cleaning up ${this.workType} work...`)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  protected override async internalStop(): Promise<void> {
    console.log(`🛑 StatusDemoWorker: Stopping ${this.workType} work...`)
  }
}

export async function runStatusWaitDemo(): Promise<void> {
  console.log('🚀 Running Status Wait Demo')
  console.log('='.repeat(40))

  // Demo 1: Wait for completion
  console.log('\n1️⃣  Waiting for Fast Worker Completion:')
  await demonstrateWaitForCompletion()

  // Demo 2: Skip functionality
  console.log('\n2️⃣  Skip Functionality:')
  await demonstrateSkip()

  // Demo 3: Multiple runners with different outcomes
  console.log('\n3️⃣  Multiple Runners - Race to Completion:')
  await demonstrateMultipleRunners()

  // Demo 4: Status monitoring
  console.log('\n4️⃣  Real-time Status Monitoring:')
  await demonstrateStatusMonitoring()

  console.log('='.repeat(40))
}

async function demonstrateWaitForCompletion(): Promise<void> {
  const worker = new StatusDemoWorker('fast')

  // Start the worker
  const runPromise = worker.run()

  console.log('📊 Current status:', getStatusName(worker))

  // Wait for it to start running
  console.log('⏳ Waiting for worker to start running...')
  await worker.waitForStatusLevel(Status.Running)
  console.log('✅ Worker is now running!')

  // Wait for final completion (any final status)
  console.log('⏳ Waiting for worker to complete...')
  await worker.waitForStatusLevel(Status.Succeeded)
  console.log('🎉 Worker has completed!')

  // Wait for the actual run promise to finish
  await runPromise
}

async function demonstrateSkip(): Promise<void> {
  const worker1 = new StatusDemoWorker('fast')
  const worker2 = new StatusDemoWorker('slow')

  // Set up event listeners first
  worker1.on('skipped', (event) => {
    console.log(`📝 Worker 1 skipped: ${event.payload.reason}`)
  })

  worker2.on('skipped', (event) => {
    console.log(`📝 Worker 2 skipped: ${event.payload.reason}`)
  })

  worker1.on('warning', (event) => {
    console.log(`⚠️  Worker 1 warning: ${event.message}`)
  })

  worker2.on('warning', (event) => {
    console.log(`⚠️  Worker 2 warning: ${event.message}`)
  })

  // Skip the first worker
  console.log('⏭️  Skipping first worker...')
  worker1.skip('Not needed for this demo')

  // Try to run it (should warn or do nothing gracefully)
  console.log('🚫 Attempting to run skipped worker...')
  try {
    await worker1.run()
    console.log('✅ Run call completed (worker was already skipped)')
  } catch (error) {
    console.log(`❌ Error running skipped worker: ${error}`)
  }

  // Skip the second worker with a reason
  console.log('⏭️  Skipping second worker...')
  worker2.skip('User decided to skip')
  console.log('📊 Second worker status:', getStatusName(worker2))
}

async function demonstrateMultipleRunners(): Promise<void> {
  const fastWorker = new StatusDemoWorker('fast')
  const slowWorker = new StatusDemoWorker('slow')
  const errorWorker = new StatusDemoWorker('error')

  console.log('🏁 Starting three workers with different behaviors...')

  // Start all workers
  const fastPromise = fastWorker.run()
  const slowPromise = slowWorker.run()
  const errorPromise = errorWorker.run()

  // Wait for any one to complete
  console.log('⏳ Waiting for first worker to finish...')

  const racePromise = Promise.race([
    fastPromise.then(() => ({ worker: 'fast', status: 'completed' })),
    slowPromise.then(() => ({ worker: 'slow', status: 'completed' })),
    errorPromise.then(() => ({ worker: 'error', status: 'completed' }))
  ])

  const first = await racePromise
  console.log(`🥇 First to finish: ${first.worker} worker`)

  // Wait for all to finish
  console.log('⏳ Waiting for all workers to finish...')
  await Promise.all([fastPromise, slowPromise, errorPromise])
  console.log('✅ All workers finished!')

  // Show final statuses
  console.log(`📊 Final statuses:`)
  console.log(`  Fast worker: ${getStatusName(fastWorker)}`)
  console.log(`  Slow worker: ${getStatusName(slowWorker)}`)
  console.log(`  Error worker: ${getStatusName(errorWorker)}`)
}

async function demonstrateStatusMonitoring(): Promise<void> {
  const worker = new StatusDemoWorker('slow')

  // Set up comprehensive event monitoring
  setupStatusMonitoring(worker, 'StatusWorker')

  // Monitor status in real-time
  const statusMonitor = setInterval(() => {
    console.log(`📈 Real-time status: ${getStatusName(worker)}`)
  }, 800)

  console.log('🎬 Starting status monitoring demo...')

  try {
    await worker.run()
  } finally {
    clearInterval(statusMonitor)
    console.log('🔚 Status monitoring complete')
  }
}

function setupStatusMonitoring(runner: BaseRunner, name: string): void {
  // Status change events
  runner.on('preparing', (event) => {
    console.log(`🔧 ${name}: Started preparing at ${event.payload.startedAt.toISOString()}`)
  })

  runner.on('prepared', (event) => {
    console.log(`✅ ${name}: Preparation complete (${event.measurement?.toString()})`)
  })

  runner.on('running', (event) => {
    console.log(`🏃 ${name}: Started running at ${event.payload.startedAt.toISOString()}`)
  })

  runner.on('releasing', (event) => {
    console.log(`🔄 ${name}: Started releasing at ${event.payload.startedAt.toISOString()}`)
  })

  runner.on('released', (event) => {
    console.log(`🔓 ${name}: Release complete (${event.measurement?.toString()})`)
  })

  // Final status events
  runner.on('succeeded', (event) => {
    console.log(`🎉 ${name}: Succeeded! Total time: ${event.measurement?.toString()}`)
  })

  runner.on('failed', (event) => {
    console.log(`❌ ${name}: Failed - ${event.payload.reason}`)
  })

  runner.on('stopped', (event) => {
    console.log(`🛑 ${name}: Stopped - ${event.payload.reason}`)
  })

  runner.on('skipped', (event) => {
    console.log(`⏭️  ${name}: Skipped - ${event.payload.reason}`)
  })

  runner.on('warning', (event) => {
    console.log(`⚠️  ${name}: Warning - ${event.message}`)
  })
}

function getStatusName(runner: any): string {
  // Access private _status field for demo purposes
  // In real code, you'd track status through events
  return runner._status || 'unknown'
}
