import { BaseRunner, Status } from '../src/BaseRunner'

interface BatchItem {
  id: string
  data: any
  processed?: boolean
}

interface BatchProcessorOptions {
  batchSize?: number
  delayBetweenBatches?: number
  failOnItem?: string
}

class BatchProcessor extends BaseRunner {
  private items: BatchItem[] = []
  private processedItems: BatchItem[] = []
  private failedItems: BatchItem[] = []
  private shouldStop: boolean = false
  private currentBatch: number = 0
  private totalBatches: number = 0
  private processingOptions: BatchProcessorOptions

  constructor(options: BatchProcessorOptions = {}) {
    super()
    this.processingOptions = { 
      batchSize: 3, 
      delayBetweenBatches: 500,
      ...options 
    }
  }

  protected override async internalPrepare(): Promise<void> {
    console.log('📦 BatchProcessor: Preparing batch data...')
    
    // Generate sample data
    this.items = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i + 1}`,
      data: `Sample data ${i + 1}`,
      processed: false
    }))
    
    this.totalBatches = Math.ceil(this.items.length / this.processingOptions.batchSize!)
    
    console.log(`✅ BatchProcessor: Prepared ${this.items.length} items in ${this.totalBatches} batches`)
    console.log(`🎛️  Batch size: ${this.processingOptions.batchSize}, Delay: ${this.processingOptions.delayBetweenBatches}ms`)
  }

  protected override async internalRun(): Promise<string | undefined> {
    console.log('🚀 BatchProcessor: Starting batch processing...')
    
    for (let i = 0; i < this.items.length; i += this.processingOptions.batchSize!) {
      if (this.shouldStop) {
        console.log('⏹️  BatchProcessor: Processing stopped by user')
        break
      }
      
      this.currentBatch++
      const batch = this.items.slice(i, i + this.processingOptions.batchSize!)
      
      console.log(`\n📋 Processing batch ${this.currentBatch}/${this.totalBatches} (${batch.length} items)`)
      
      // Process batch items concurrently
      const batchPromises = batch.map(item => this.processItem(item))
      const results = await Promise.allSettled(batchPromises)
      
      // Handle results
      results.forEach((result, index) => {
        const item = batch[index]
        if (result.status === 'fulfilled') {
          item.processed = true
          this.processedItems.push(item)
          console.log(`  ✅ ${item.id}: processed successfully`)
        } else {
          this.failedItems.push(item)
          console.log(`  ❌ ${item.id}: failed - ${result.reason}`)
        }
      })
      
      // Progress report
      const totalProcessed = this.processedItems.length + this.failedItems.length
      const progress = Math.round((totalProcessed / this.items.length) * 100)
      console.log(`📊 Progress: ${totalProcessed}/${this.items.length} (${progress}%)`)
      
      // Delay between batches (except for the last batch)
      if (this.currentBatch < this.totalBatches && !this.shouldStop) {
        console.log(`⏳ Waiting ${this.processingOptions.delayBetweenBatches}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, this.processingOptions.delayBetweenBatches))
      }
    }
    
    // Final summary
    console.log('\n📈 Processing Summary:')
    console.log(`  ✅ Successful: ${this.processedItems.length}`)
    console.log(`  ❌ Failed: ${this.failedItems.length}`)
    console.log(`  ⏹️  Remaining: ${this.items.length - this.processedItems.length - this.failedItems.length}`)
    
    // Return failure reason if we have failed items
    if (this.failedItems.length > 0) {
      return `${this.failedItems.length} items failed to process`
    }
    
    // Return failure if stopped before completing all items
    if (this.shouldStop && this.processedItems.length + this.failedItems.length < this.items.length) {
      return 'Processing was stopped before completion'
    }
    
    return undefined // Success
  }

  protected override async internalRelease(): Promise<void> {
    console.log('🧹 BatchProcessor: Cleaning up resources...')
    
    // Save processed items to "output"
    if (this.processedItems.length > 0) {
      console.log('💾 Saving processed items:')
      this.processedItems.forEach(item => {
        console.log(`  📄 ${item.id}: ${item.data} [PROCESSED]`)
      })
    }
    
    // Log failed items for retry
    if (this.failedItems.length > 0) {
      console.log('🔄 Items that need retry:')
      this.failedItems.forEach(item => {
        console.log(`  ⚠️  ${item.id}: ${item.data}`)
      })
    }
    
    await new Promise(resolve => setTimeout(resolve, 200))
    console.log('✨ BatchProcessor: Cleanup complete')
  }

  protected override async internalStop(): Promise<void> {
    console.log('🛑 BatchProcessor: Stopping batch processing...')
    this.shouldStop = true
  }

  private async processItem(item: BatchItem): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))
    
    // Simulate failure for specific items
    if (this.processingOptions.failOnItem && item.id === this.processingOptions.failOnItem) {
      throw new Error(`Simulated failure for ${item.id}`)
    }
    
    // Random failure chance (5%)
    if (Math.random() < 0.05) {
      throw new Error(`Random processing error for ${item.id}`)
    }
    
    // Processing successful
    item.data = item.data.toUpperCase()
  }
}

export async function runBatchProcessorExample(): Promise<void> {
  console.log('🚀 Running Batch Processor Example')
  console.log('=' .repeat(50))
  
  // Example 1: Normal batch processing
  console.log('\n1️⃣  Normal Batch Processing:')
  const processor1 = new BatchProcessor()
  await runBatchProcessor(processor1)
  
  // Example 2: With specific failure
  console.log('\n2️⃣  Batch Processing with Item Failure:')
  const processor2 = new BatchProcessor({ failOnItem: 'item-3' })
  await runBatchProcessor(processor2)
  
  // Example 3: Smaller batches with longer delays
  console.log('\n3️⃣  Small Batches with Delays:')
  const processor3 = new BatchProcessor({ 
    batchSize: 2, 
    delayBetweenBatches: 1000 
  })
  
  // Stop after 3 seconds to demonstrate partial processing
  setTimeout(() => {
    console.log('👤 User requesting stop during processing...')
    processor3.stop('User stopped processing')
  }, 3000)
  
  await runBatchProcessor(processor3)
  
  console.log('=' .repeat(50))
}

async function runBatchProcessor(processor: BatchProcessor): Promise<void> {
  processor.on('preparing', () => {
    console.log('🔧 Batch processor is preparing...')
  })
  
  processor.on('running', () => {
    console.log('▶️  Batch processing started')
  })
  
  processor.on('succeeded', (event) => {
    console.log(`🎉 Batch processing completed successfully!`)
    console.log(`⏱️  Duration: ${event.measurement?.toString()}`)
  })
  
  processor.on('failed', (event) => {
    console.log(`⚠️  Batch processing failed: ${event.payload.reason}`)
    console.log(`⏱️  Duration: ${event.measurement?.toString()}`)
  })
  
  processor.on('stopped', (event) => {
    console.log(`🛑 Batch processing stopped: ${event.payload.reason}`)
    console.log(`⏱️  Duration: ${event.measurement?.toString()}`)
  })
  
  try {
    await processor.run()
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
} 
