export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Test failed: ${message}`)
  }
}

export function assertEquals(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(`Test failed: ${message}. Expected: ${expected}, but got: ${actual}`)
  }
}

export async function runTest(testName: string, testFn: () => void | Promise<void>): Promise<void> {
  try {
    await testFn()
    console.log(`✅ ${testName} - PASSED`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`❌ ${testName} - FAILED: ${errorMessage}`)
    throw error
  }
}
