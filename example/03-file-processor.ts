import { BaseRunner } from '../src'

interface FileProcessorOptions {
  timeout?: number
  simulateError?: boolean
  slowProcessing?: boolean
}

class FileProcessor extends BaseRunner {
  private inputData: string[] = []
  private outputData: string[] = []
  private shouldStop: boolean = false
  private processingOptions: FileProcessorOptions

  constructor(options: FileProcessorOptions = {}) {
    super({ timeout: options.timeout })
    this.processingOptions = options
  }

  protected override async internalPrepare(): Promise<void> {
    console.log('📁 FileProcessor: Reading input data...')

    // Simulate reading a file
    this.inputData = ['hello world', 'the quick brown fox', 'jumps over the lazy dog', 'lorem ipsum dolor sit amet', 'consectetur adipiscing elit']

    await new Promise((resolve) => setTimeout(resolve, 300))
    console.log(`✅ FileProcessor: Loaded ${this.inputData.length} lines`)
  }

  protected override async internalRun(): Promise<string | undefined> {
    console.log('🔄 FileProcessor: Processing data...')

    if (this.processingOptions.simulateError) {
      return 'Simulated processing error occurred'
    }

    let processed = 0
    const total = this.inputData.length

    for (const line of this.inputData) {
      if (this.shouldStop) {
        console.log('⏹️  FileProcessor: Processing stopped by user')
        break
      }

      // Simulate processing time
      const delay = this.processingOptions.slowProcessing ? 2000 : 400
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Process the line (convert to uppercase and add line number)
      const processedLine = `${processed + 1}: ${line.toUpperCase()}`
      this.outputData.push(processedLine)
      processed++

      console.log(`📝 Processed line ${processed}/${total}: "${processedLine}"`)
    }

    if (processed === 0) {
      return 'No data was processed'
    }

    return undefined // Success
  }

  protected override async internalRelease(): Promise<void> {
    console.log('💾 FileProcessor: Saving output data...')

    if (this.outputData.length > 0) {
      console.log('📤 Output data:')
      this.outputData.forEach((line) => console.log(`  ${line}`))
    } else {
      console.log('📭 No output data to save')
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
    console.log('✅ FileProcessor: Output saved')
  }

  protected override async internalStop(): Promise<void> {
    console.log('🛑 FileProcessor: Stopping file processing...')
    this.shouldStop = true
  }
}

export async function runFileProcessorExample(): Promise<void> {
  console.log('🚀 Running File Processor Example')
  console.log('='.repeat(40))

  // Example 1: Normal processing
  console.log('\n1️⃣  Normal Processing:')
  const processor1 = new FileProcessor()
  await runProcessor(processor1)

  // Example 2: With timeout (slow processing)
  console.log('\n2️⃣  Processing with Timeout (will timeout):')
  const processor2 = new FileProcessor({
    timeout: 3000, // 3 second timeout
    slowProcessing: true
  })
  await runProcessor(processor2)

  // Example 3: With error
  console.log('\n3️⃣  Processing with Error:')
  const processor3 = new FileProcessor({ simulateError: true })
  await runProcessor(processor3)

  // Example 4: Manual stop
  console.log('\n4️⃣  Manual Stop:')
  const processor4 = new FileProcessor({ slowProcessing: true })

  // Stop after 2 seconds
  setTimeout(() => {
    console.log('👤 User requesting stop...')
    processor4.stop('User requested stop')
  }, 2000)

  await runProcessor(processor4)

  console.log('='.repeat(40))
}

async function runProcessor(processor: FileProcessor): Promise<void> {
  processor.on('succeeded', (event) => {
    console.log(`🎉 Processing succeeded! Duration: ${event.measurement?.toString()}`)
  })

  processor.on('failed', (event) => {
    console.log(`❌ Processing failed: ${event.payload.reason}`)
  })

  processor.on('timed-out', (event) => {
    console.log(`⏰ Processing timed out! ${event.message || 'Timeout occurred'}`)
  })

  processor.on('stopped', (event) => {
    console.log(`🛑 Processing stopped: ${event.payload.reason}`)
  })

  try {
    await processor.run()
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}
