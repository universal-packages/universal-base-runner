import { runSimpleWorkerExample } from './simple-worker'
import { runFileProcessorExample } from './file-processor'
import { runBatchProcessorExample } from './batch-processor'
import { runStatusWaitDemo } from './status-wait-demo'
import { runErrorHandlingExample, runCustomEventExample } from './error-handling'

async function runAllExamples() {
  console.log('\n' + '='.repeat(60))
  console.log('🎯 Universal Base Runner - Examples Showcase')
  console.log('='.repeat(60))
  
  try {
    // Example 1: Simple Worker
    await runSimpleWorkerExample()
    await delay(1000)
    
    // Example 2: File Processor (with timeouts, errors, stopping)
    await runFileProcessorExample()
    await delay(1000)
    
    // Example 3: Batch Processor (with progress tracking)
    await runBatchProcessorExample()
    await delay(1000)
    
    // Example 4: Status and Wait Functionality
    await runStatusWaitDemo()
    await delay(1000)
    
    // Example 5: Error Handling
    await runErrorHandlingExample()
    await delay(1000)
    
    // Example 6: Custom Events
    await runCustomEventExample()
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 All examples completed successfully!')
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('\n💥 Error running examples:', error)
    console.log('='.repeat(60))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

runAllExamples()
