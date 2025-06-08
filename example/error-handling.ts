import { BaseRunner, Status } from '../src/BaseRunner'

type ErrorType = 'preparation' | 'runtime' | 'release' | 'none'

class ErrorDemoWorker extends BaseRunner {
  private errorType: ErrorType
  private shouldWarn: boolean
  
  constructor(errorType: ErrorType = 'none', shouldWarn: boolean = false) {
    super()
    this.errorType = errorType
    this.shouldWarn = shouldWarn
  }

  protected override async internalPrepare(): Promise<void> {
    console.log(`🔧 ErrorDemo: Preparing with error type: ${this.errorType}`)
    
    if (this.errorType === 'preparation') {
      throw new Error('Preparation failed: Database connection error')
    }
    
    await new Promise(resolve => setTimeout(resolve, 300))
    console.log('✅ ErrorDemo: Preparation successful')
  }

  protected override async internalRun(): Promise<string | undefined> {
    console.log(`⚡ ErrorDemo: Running with error type: ${this.errorType}`)
    
    if (this.errorType === 'runtime') {
      throw new Error('Runtime error: Process crashed unexpectedly')
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (this.shouldWarn) {
      console.log('⚠️  Simulating warning scenario...')
      // This would trigger a warning if no listeners are attached
      this.emit('warning', { message: 'This is a test warning' })
    }
    
    return undefined
  }

  protected override async internalRelease(): Promise<void> {
    console.log(`🧹 ErrorDemo: Releasing with error type: ${this.errorType}`)
    
    if (this.errorType === 'release') {
      throw new Error('Release failed: Cleanup process error')
    }
    
    await new Promise(resolve => setTimeout(resolve, 200))
    console.log('✅ ErrorDemo: Release successful')
  }

  protected override async internalStop(): Promise<void> {
    console.log('🛑 ErrorDemo: Stopping work...')
  }
}

export async function runErrorHandlingExample(): Promise<void> {
  console.log('🚀 Running Error Handling Example')
  console.log('=' .repeat(45))
  
  // Example 1: Preparation error
  console.log('\n1️⃣  Preparation Error:')
  await demonstrateError('preparation')
  
  // Example 2: Runtime error
  console.log('\n2️⃣  Runtime Error:')
  await demonstrateError('runtime')
  
  // Example 3: Release error
  console.log('\n3️⃣  Release Error:')
  await demonstrateError('release')
  
  // Example 4: Warning handling
  console.log('\n4️⃣  Warning Handling:')
  await demonstrateWarnings()
  
  // Example 5: Multiple invalid operations
  console.log('\n5️⃣  Invalid Operations:')
  await demonstrateInvalidOperations()
  
  console.log('=' .repeat(45))
}

async function demonstrateError(errorType: ErrorType): Promise<void> {
  const worker = new ErrorDemoWorker(errorType)
  
  // Set up error event handlers
  worker.on('error', (event) => {
    console.log(`💥 Error caught: ${event.error?.message || 'Unknown error'}`)
    if (event.message) {
      console.log(`📝 Context: ${event.message}`)
    }
  })
  
  worker.on('succeeded', () => {
    console.log('🎉 Worker succeeded (unexpected)')
  })
  
  worker.on('failed', (event) => {
    console.log(`❌ Worker failed: ${event.payload.reason}`)
  })
  
  try {
    await worker.run()
  } catch (error) {
    console.log(`🚫 Unhandled error: ${error}`)
  }
}

async function demonstrateWarnings(): Promise<void> {
  console.log('📢 Demonstrating warning scenarios...')
  
  // Case 1: Worker with warning listener
  console.log('\n🔊 With warning listener:')
  const workerWithListener = new ErrorDemoWorker('none', true)
  
  workerWithListener.on('warning', (event) => {
    console.log(`⚠️  Warning received: ${event.message}`)
  })
  
  await workerWithListener.run()
  
  // Case 2: Worker without warning listener (would throw)
  console.log('\n🔇 Without warning listener (but catching errors):')
  const workerWithoutListener = new ErrorDemoWorker('none', true)
  
  try {
    await workerWithoutListener.run()
  } catch (error) {
    console.log(`🎯 Caught warning as error: ${error}`)
  }
}

async function demonstrateInvalidOperations(): Promise<void> {
  const worker = new ErrorDemoWorker('none')
  
  // Set up warning listener to catch invalid operation warnings
  worker.on('warning', (event) => {
    console.log(`⚠️  Invalid operation warning: ${event.message}`)
  })
  
  // Try various invalid operations
  console.log('🚫 Attempting to stop idle worker...')
  try {
    await worker.stop('Test stop')
  } catch (error) {
    console.log(`❌ Error: ${error}`)
  }
  
  console.log('🚫 Attempting to skip already running worker...')
  
  // Start the worker
  const runPromise = worker.run()
  
  // Wait a bit then try to skip (should warn)
  setTimeout(() => {
    try {
      worker.skip('Too late to skip')
    } catch (error) {
      console.log(`❌ Error: ${error}`)
    }
  }, 100)
  
  // Wait a bit then try to run again (should warn)
  setTimeout(() => {
    worker.run().catch((error) => {
      console.log(`❌ Second run error: ${error}`)
    })
  }, 200)
  
  await runPromise
  
  console.log('🚫 Attempting operations on completed worker...')
  
  // Try to stop completed worker
  try {
    await worker.stop('Stop completed worker')
  } catch (error) {
    console.log(`❌ Error: ${error}`)
  }
  
  // Try to skip completed worker
  try {
    worker.skip('Skip completed worker')
  } catch (error) {
    console.log(`❌ Error: ${error}`)
  }
  
  // Try to run completed worker again
  try {
    await worker.run()
  } catch (error) {
    console.log(`❌ Error: ${error}`)
  }
}

// Helper function to demonstrate custom event emitter usage
export async function runCustomEventExample(): Promise<void> {
  console.log('\n🎭 Custom Event Example')
  console.log('=' .repeat(30))
  
  class CustomEventWorker extends BaseRunner {
    protected override async internalRun(): Promise<string | undefined> {
      console.log('📡 Emitting custom events during work...')
      
      // Emit custom events (you can extend the event map)
      for (let i = 1; i <= 3; i++) {
        console.log(`📤 Step ${i}: Processing...`)
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // These would be custom events if you extend the BaseRunnerEvents interface
        console.log(`📦 Completed step ${i}`)
      }
      
      return undefined
    }
    
    protected override async internalPrepare(): Promise<void> {
      console.log('🎬 Custom worker preparation')
    }
    
    protected override async internalRelease(): Promise<void> {
      console.log('🎬 Custom worker cleanup')
    }
    
    protected override async internalStop(): Promise<void> {
      console.log('🎬 Custom worker stop')
    }
  }
  
  const customWorker = new CustomEventWorker()
  
  // Listen to all standard events
  customWorker.on('preparing', () => console.log('🔧 Custom: Preparing...'))
  customWorker.on('running', () => console.log('⚡ Custom: Running...'))
  customWorker.on('succeeded', (event) => {
    console.log(`🎉 Custom: Success! (${event.measurement?.toString()})`)
  })
  
  await customWorker.run()
} 
