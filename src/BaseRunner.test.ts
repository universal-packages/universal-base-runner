import { BaseRunner } from './BaseRunner'
import { Status } from './BaseRunner.types'
import { assert, assertEquals, runTest } from './utils.test'

// Test implementation of BaseRunner
class TestRunner extends BaseRunner {
  public prepareDelay: number = 0
  public runDelay: number = 0
  public releaseDelay: number = 0
  public finallyDelay: number = 0
  public shouldFailInPrepare: boolean = false
  public shouldFailInRun: boolean = false
  public shouldFailInRelease: boolean = false
  public shouldFailInStop: boolean = false
  public shouldFailInFinally: boolean = false
  public shouldReturnFailureReason: string | undefined = undefined
  public runWasInterrupted: boolean = false
  public finallyWasCalled: boolean = false
  public customFinallyFunction?: () => Promise<void>
  public customInternalRun?: () => Promise<string | undefined>

  protected override async internalPrepare(): Promise<void> {
    if (this.prepareDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.prepareDelay))
    }
    if (this.shouldFailInPrepare) {
      throw new Error('Prepare failed')
    }
  }

  protected override async internalRun(): Promise<string | undefined> {
    if (this.customInternalRun) {
      return await this.customInternalRun()
    }

    if (this.runDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.runDelay))
    }
    if (this.shouldFailInRun) {
      throw new Error('Run failed')
    }
    return this.shouldReturnFailureReason
  }

  protected override async internalRelease(): Promise<void> {
    if (this.releaseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.releaseDelay))
    }
    if (this.shouldFailInRelease) {
      throw new Error('Release failed')
    }
  }

  protected override async internalStop(): Promise<void> {
    if (this.shouldFailInStop) {
      throw new Error('Stop failed')
    }
    this.runWasInterrupted = true
  }

  protected override async internalFinally(): Promise<void> {
    if (this.customFinallyFunction) {
      await this.customFinallyFunction()
      return
    }

    if (this.finallyDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.finallyDelay))
    }
    if (this.shouldFailInFinally) {
      throw new Error('Finally failed')
    }
    this.finallyWasCalled = true
  }
}

// Runner that doesn't implement internalRun to test default error
class UnimplementedRunner extends BaseRunner {}

// Runner that doesn't implement internalStop to test default error
class UnstoppableRunner extends BaseRunner {
  protected override async internalRun(): Promise<string | undefined> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return undefined
  }

  public override get status(): Status {
    return (this as any)._status
  }
}

export async function baseRunnerTest() {
  console.log('🧪 Running BaseRunner Tests')
  console.log('='.repeat(50))

  await runTest('BaseRunner should start in idle state', async () => {
    const runner = new TestRunner()
    assertEquals(runner.status, Status.Idle, 'Runner should start in idle state')
  })

  await runTest('BaseRunner should succeed when all phases complete', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('succeeded', () => events.push('succeeded'))

    await runner.run()

    assertEquals(runner.status, Status.Succeeded, 'Runner should be in succeeded state')
    assertEquals(events.length, 6, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'prepared', 'Second event should be prepared')
    assertEquals(events[2], 'running', 'Third event should be running')
    assertEquals(events[3], 'releasing', 'Fourth event should be releasing')
    assertEquals(events[4], 'released', 'Fifth event should be released')
    assertEquals(events[5], 'succeeded', 'Last event should be succeeded')
  })

  await runTest('BaseRunner should fail when internalRun returns failure reason', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    runner.shouldReturnFailureReason = 'Something went wrong'

    let failedEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('succeeded', () => events.push('succeeded'))
    runner.on('failed', (event) => {
      failedEvent = event
      events.push('failed')
    })

    await runner.run()

    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')
    assert(failedEvent !== null, 'Failed event should have been emitted')
    assertEquals(failedEvent.payload.reason, 'Something went wrong', 'Failure reason should match')
    assertEquals(events.length, 6, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'prepared', 'Second event should be prepared')
    assertEquals(events[2], 'running', 'Third event should be running')
    assertEquals(events[3], 'releasing', 'Fourth event should be releasing')
    assertEquals(events[4], 'released', 'Fifth event should be released')
    assertEquals(events[5], 'failed', 'Last event should be failed')
  })

  await runTest('BaseRunner should handle preparation errors', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    runner.shouldFailInPrepare = true

    let errorEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('error', (event) => {
      errorEvent = event
      events.push('error')
    })

    await runner.run()

    assertEquals(runner.status, Status.Error, 'Runner should be in error state')
    assert(errorEvent !== null, 'Error event should have been emitted')
    assertEquals(errorEvent.message, 'Runner preparation failed', 'Error message should match')
    assertEquals(events.length, 2, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'error', 'Last event should be error')
  })

  await runTest('BaseRunner should handle release errors', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    runner.shouldFailInRelease = true

    let errorEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('error', (event) => {
      errorEvent = event
      events.push('error')
    })

    await runner.run()

    assertEquals(runner.status, Status.Error, 'Runner should be in error state')
    assert(errorEvent !== null, 'Error event should have been emitted')
    assertEquals(errorEvent.message, 'Release failed', 'Error message should match')
    assertEquals(events.length, 5, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'prepared', 'Second event should be prepared')
    assertEquals(events[2], 'running', 'Third event should be running')
    assertEquals(events[3], 'releasing', 'Fourth event should be releasing')
    assertEquals(events[4], 'error', 'Last event should be error')
  })

  await runTest('BaseRunner should handle internalRun throwing errors (should stop immediately like prepare errors)', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    runner.shouldFailInRun = true

    let errorEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('error', (event) => {
      errorEvent = event
      events.push('error')
    })

    await runner.run()

    assertEquals(runner.status, Status.Error, 'Runner should be in error state')
    assert(errorEvent !== null, 'Error event should have been emitted')
    assertEquals(errorEvent.message, 'Run failed', 'Error message should match')
    assertEquals(events.length, 4, 'Should only have preparing, prepared, running, error events - NOT releasing/released')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'prepared', 'Second event should be prepared')
    assertEquals(events[2], 'running', 'Third event should be running')
    assertEquals(events[3], 'error', 'Last event should be error - should NOT continue to releasing')
  })

  await runTest('BaseRunner should handle timeout', async () => {
    const runner = new TestRunner({ timeout: 100 })
    const events: string[] = []

    runner.runDelay = 200 // Longer than timeout

    let timedOutEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('timed-out', (event) => {
      timedOutEvent = event
      events.push('timed-out')
    })
    runner.on('stopping', () => events.push('stopping'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))

    await runner.run()

    assertEquals(runner.status, Status.TimedOut, 'Runner should be in timed out state')
    assert(timedOutEvent !== null, 'Timed-out event should have been emitted')
    assertEquals(events.length, 7, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'prepared', 'Second event should be prepared')
    assertEquals(events[2], 'running', 'Third event should be running')
    assertEquals(events[3], 'stopping', 'Fifth event should be stopping')
    assertEquals(events[4], 'releasing', 'Sixth event should be releasing')
    assertEquals(events[5], 'released', 'Seventh event should be released')
    assertEquals(events[6], 'timed-out', 'Last event should be timed-out')
  })

  await runTest('BaseRunner should complete lifecycle quickly on timeout while internal run continues in background', async () => {
    const runner = new TestRunner({ timeout: 100 })
    const events: string[] = []
    let internalRunCompleted = false
    let internalRunStarted = false

    // Use customInternalRun to track its progress
    runner.customInternalRun = async (): Promise<string | undefined> => {
      internalRunStarted = true
      await new Promise((resolve) => setTimeout(resolve, 300)) // 3x longer than timeout
      internalRunCompleted = true
      return undefined
    }

    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('stopping', () => events.push('stopping'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('timed-out', () => events.push('timed-out'))

    const startTime = Date.now()
    await runner.run()
    const endTime = Date.now()
    const totalDuration = endTime - startTime

    // Verify the runner completed quickly (around timeout duration, not internal run duration)
    assert(totalDuration < 200, `Runner should complete in ~100ms, but took ${totalDuration}ms`)
    assert(totalDuration >= 100, `Runner should take at least the timeout duration (100ms), but took ${totalDuration}ms`)

    // Verify proper lifecycle completion
    assertEquals(runner.status, Status.TimedOut, 'Runner should be in timed out state')
    assertEquals(events.length, 7, 'All lifecycle events should have been emitted')
    assertEquals(events[6], 'timed-out', 'Last event should be timed-out')

    // Verify internal run started but didn't block the lifecycle
    assertEquals(internalRunStarted, true, 'Internal run should have started')
    assertEquals(internalRunCompleted, false, 'Internal run should not have completed yet (still running in background)')

    // Wait a bit more to verify internal run can complete in background
    await new Promise((resolve) => setTimeout(resolve, 250))
    assertEquals(internalRunCompleted, true, 'Internal run should have completed in background')
  })

  await runTest('BaseRunner should handle stop request', async () => {
    const runner = new TestRunner()
    const events: string[] = []
    runner.runDelay = 100

    let stoppedEvent: any = null

    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('stopping', () => events.push('stopping'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('stopped', (event) => {
      stoppedEvent = event
      events.push('stopped')
    })

    // Start running and stop it
    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop'), 50)

    await runPromise

    assertEquals(runner.status, Status.Stopped, 'Runner should be in stopped state')
    assert(stoppedEvent !== null, 'Stopped event should have been emitted')
    assertEquals(stoppedEvent.payload.reason, 'Test stop', 'Stop reason should match')
    assert(runner.runWasInterrupted, 'Internal stop should have been called')
    assertEquals(events.length, 7, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'preparing', 'First event should be preparing')
    assertEquals(events[1], 'prepared', 'Second event should be prepared')
    assertEquals(events[2], 'running', 'Third event should be running')
    assertEquals(events[3], 'stopping', 'Fourth event should be stopping')
    assertEquals(events[4], 'releasing', 'Fifth event should be releasing')
    assertEquals(events[5], 'released', 'Sixth event should be released')
    assertEquals(events[6], 'stopped', 'Last event should be stopped')
  })

  await runTest('BaseRunner should handle skip', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    let skippedEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('stopping', () => events.push('stopping'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('stopped', () => events.push('stopped'))
    runner.on('skipped', (event) => {
      skippedEvent = event
      events.push('skipped')
    })

    await runner.skip('Test skip')

    assertEquals(runner.status, Status.Skipped, 'Runner should be in skipped state')
    assert(skippedEvent !== null, 'Skipped event should have been emitted')
    assertEquals(skippedEvent.payload.reason, 'Test skip', 'Skip reason should match')
    assertEquals(events.length, 1, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'skipped', 'Last event should be skipped')
  })

  await runTest('BaseRunner should handle fail', async () => {
    const runner = new TestRunner()
    const events: string[] = []

    let failedEvent: any = null
    runner.on('preparing', () => events.push('preparing'))
    runner.on('prepared', () => events.push('prepared'))
    runner.on('running', () => events.push('running'))
    runner.on('stopping', () => events.push('stopping'))
    runner.on('releasing', () => events.push('releasing'))
    runner.on('released', () => events.push('released'))
    runner.on('stopped', () => events.push('stopped'))
    runner.on('failed', (event) => {
      failedEvent = event
      events.push('failed')
    })

    await runner.fail('Test failure')

    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')
    assert(failedEvent !== null, 'Failed event should have been emitted')
    assertEquals(failedEvent.payload.reason, 'Test failure', 'Failure reason should match')
    assertEquals(events.length, 1, 'All lifecycle events should have been emitted')
    assertEquals(events[0], 'failed', 'Last event should be failed')
    assert(runner.startedAt instanceof Date, 'StartedAt should be a Date')
    assert(runner.finishedAt instanceof Date, 'FinishedAt should be a Date')
    assert(runner.measurement !== null, 'Measurement should not be null')
  })

  await runTest('BaseRunner should handle fail with Error object', async () => {
    const runner = new TestRunner()
    const testError = new Error('Test error message')

    let failedEvent: any = null
    runner.on('failed', (event) => {
      failedEvent = event
    })

    await runner.fail(testError)

    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')
    assert(failedEvent !== null, 'Failed event should have been emitted')
    assertEquals(failedEvent.payload.reason, testError, 'Failure reason should match the error object')
    assertEquals(runner.failureReason, testError, 'Failure reason getter should return the error object')
  })

  await runTest('BaseRunner should not allow multiple runs', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    await runner.run() // Second run should emit warning

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Run was called but runner has already finished', 'Warning message should match')
  })

  await runTest('BaseRunner should not allow stop when idle', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.stop()

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner is not running', 'Warning message should match')
  })

  await runTest('BaseRunner should not allow skip after running', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    await runner.skip('Too late')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Skip was called but runner can only be skipped when idle', 'Warning message should match')
  })

  await runTest('BaseRunner should not allow fail after running', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    await runner.fail('Too late')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Fail was called but runner can only be failed when idle', 'Warning message should match')
  })

  await runTest('BaseRunner should not allow fail when already failed', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.fail('First failure')
    await runner.fail('Second failure')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Fail was called but runner is already failed', 'Warning message should match')
  })

  await runTest('BaseRunner should not allow fail when skipped', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.skip('Skipped first')
    await runner.fail('Try to fail skipped')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Fail was called but runner can only be failed when idle', 'Warning message should match')
  })

  await runTest('BaseRunner should wait for status level', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()
    const waitPromise = runner.waitForStatusLevel(Status.Succeeded)

    await Promise.all([runPromise, waitPromise])

    assertEquals(runner.status, Status.Succeeded, 'Runner should have succeeded')
  })

  await runTest('BaseRunner should provide measurement data', async () => {
    const runner = new TestRunner()

    let succeededEvent: any = null
    runner.on('succeeded', (event) => (succeededEvent = event))

    await runner.run()

    assert(succeededEvent !== null, 'Succeeded event should have been emitted')
    assert(succeededEvent.measurement !== undefined, 'Measurement should be provided')
    assert(succeededEvent.payload.startedAt instanceof Date, 'StartedAt should be a date')
    assert(succeededEvent.payload.finishedAt instanceof Date, 'FinishedAt should be a date')
  })

  await runTest('BaseRunner should handle stop during preparation', async () => {
    const runner = new TestRunner()
    runner.prepareDelay = 100

    let stoppedEvent: any = null
    runner.on('stopped', (event) => (stoppedEvent = event))

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Stop during prep'), 50)

    await runPromise

    assertEquals(runner.status, Status.Stopped, 'Runner should be in stopped state')
    assert(stoppedEvent !== null, 'Stopped event should have been emitted')
  })

  await runTest('BaseRunner should emit warning when trying to run while preparing', async () => {
    const runner = new TestRunner()
    runner.prepareDelay = 100

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    const runPromise = runner.run()

    // Wait a bit for preparing to start, then try to run again
    await new Promise((resolve) => setTimeout(resolve, 50))
    await runner.run()

    await runPromise

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Run was called but runner is already running', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to run while running', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    const runPromise = runner.run()

    // Wait for running state to start, then try to run again
    await new Promise((resolve) => setTimeout(resolve, 50))
    await runner.run()

    await runPromise

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Run was called but runner is already running', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to run while releasing', async () => {
    const runner = new TestRunner()
    runner.releaseDelay = 100

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    const runPromise = runner.run()

    // Wait for releasing phase and try to stop
    setTimeout(() => runner.stop('Stop during release'), 50)

    await runPromise

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner is releasing', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to stop while already stopping', async () => {
    const runner = new TestRunner()
    runner.runDelay = 200

    let warningEvents: any[] = []
    runner.on('warning', (event) => warningEvents.push(event))

    const runPromise = runner.run()

    // Stop the runner
    setTimeout(() => runner.stop('First stop'), 50)
    // Try to stop again while already stopping
    setTimeout(() => runner.stop('Second stop'), 60)

    await runPromise

    assert(warningEvents.length > 0, 'Warning event should have been emitted')
    assert(
      warningEvents.some((e) => e.message === 'Stop was called but runner is already stopping'),
      'Should warn about already stopping'
    )
  })

  await runTest('BaseRunner should emit warning when trying to stop skipped runner', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.skip('Test skip')
    await runner.stop('Try to stop skipped')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner was skipped', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to stop while releasing', async () => {
    const runner = new TestRunner()
    runner.releaseDelay = 100

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    const runPromise = runner.run()

    // Wait for releasing phase and try to stop
    setTimeout(() => runner.stop('Stop during release'), 50)

    await runPromise

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner is releasing', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to stop finished runner', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    await runner.stop('Try to stop finished')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner has already finished', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to stop timed out runner', async () => {
    const runner = new TestRunner({ timeout: 50 })
    runner.runDelay = 100 // Longer than timeout

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    assertEquals(runner.status, Status.TimedOut, 'Runner should be in timed out state')

    await runner.stop('Try to stop timed out')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner has already finished', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to skip already skipped runner', async () => {
    const runner = new TestRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.skip('First skip')
    await runner.skip('Second skip')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Skip was called but runner is already skipped', 'Warning message should match')
  })

  await runTest('BaseRunner internalRun should throw error when not implemented', async () => {
    const runner = new UnimplementedRunner()

    let errorEvent: any = null
    runner.on('error', (event) => (errorEvent = event))

    await runner.run()

    assert(errorEvent !== null, 'Error event should have been emitted')
    assertEquals(errorEvent.error.message, 'internalRun is not implemented, this runner will not run', 'Error message should match')
  })

  await runTest('BaseRunner internalStop should throw error when not implemented', async () => {
    const runner = new UnstoppableRunner()

    let errorEvent: any = null
    runner.on('error', (event) => (errorEvent = event))

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop'), 50)

    await runPromise

    assert(errorEvent !== null, 'Error event should have been emitted')
    assertEquals(errorEvent.error.message, 'internalStop is not implemented, this runner will just run indefinitely (probably)', 'Error message should match')
  })

  await runTest('BaseRunner should throw error when no warning listeners', async () => {
    const runner = new TestRunner()

    // Don't add warning listener
    await runner.run()

    let errorThrown = false
    try {
      await runner.run() // Second run should throw
    } catch (error: any) {
      errorThrown = true
      assertEquals(error.message, 'Run was called but runner has already finished', 'Error message should match')
    }

    assert(errorThrown, 'Error should have been thrown')
  })

  await runTest('BaseRunner should throw error when fail called with no warning listeners', async () => {
    const runner = new TestRunner()

    // Don't add warning listener
    await runner.fail('First failure')

    let errorThrown = false
    try {
      await runner.fail('Second failure') // Second fail should throw
    } catch (error: any) {
      errorThrown = true
      assertEquals(error.message, 'Fail was called but runner is already failed', 'Error message should match')
    }

    assert(errorThrown, 'Error should have been thrown')
  })

  await runTest('BaseRunner should handle error in stop attempt', async () => {
    const runner = new TestRunner()
    runner.shouldFailInStop = true
    runner.runDelay = 100

    let errorEvent: any = null
    runner.on('error', (event) => (errorEvent = event))

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop with error'), 50)

    await runPromise

    assert(errorEvent !== null, 'Error event should have been emitted')
    assertEquals(errorEvent.message, 'Attempt to stop runner failed', 'Error message should match')
  })

  await runTest('BaseRunner should handle stop when run has finished but still in Running state', async () => {
    // Create a special runner to test the edge case where _runHasFinished is true but status is still Running
    class SpecialRunner extends BaseRunner {
      private _forceRunFinished = false

      protected override async internalRun(): Promise<string | undefined> {
        // Immediately mark as finished but don't change state
        this._forceRunFinished = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        return undefined
      }

      public get runHasFinished(): boolean {
        return this._forceRunFinished || (this as any)._runHasFinished
      }

      // Override the private _runHasFinished property for testing
      public forceRunFinished() {
        ;(this as any)._runHasFinished = true
      }
    }

    const runner = new SpecialRunner()

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    const runPromise = runner.run()

    // Wait a bit for the run to start and then force run finished state
    setTimeout(() => {
      runner.forceRunFinished()
      runner.stop('Stop after run finished')
    }, 50)

    await runPromise

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner has already finished', 'Warning message should match')
  })

  await runTest('BaseRunner should mark as stopping when stop called during preparing', async () => {
    const runner = new TestRunner()
    runner.prepareDelay = 100

    let stoppedEvent: any = null
    runner.on('stopped', (event) => (stoppedEvent = event))

    const runPromise = runner.run()

    // Stop while preparing - this should set _markedAsStopping = true
    setTimeout(() => runner.stop('Stop during prepare'), 30)

    await runPromise

    assertEquals(runner.status, Status.Stopped, 'Runner should be in stopped state')
    assert(stoppedEvent !== null, 'Stopped event should have been emitted')
    assertEquals(stoppedEvent.payload.reason, 'Stop during prepare', 'Stop reason should match')
  })

  await runTest('BaseRunner should emit warning when trying to stop failed runner', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Test failure'

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')

    await runner.stop('Try to stop failed')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner has already finished', 'Warning message should match')
  })

  await runTest('BaseRunner should emit warning when trying to stop error runner', async () => {
    const runner = new TestRunner()
    runner.shouldFailInPrepare = true

    let warningEvent: any = null
    runner.on('warning', (event) => (warningEvent = event))

    await runner.run()
    assertEquals(runner.status, Status.Error, 'Runner should be in error state')

    await runner.stop('Try to stop errored')

    assert(warningEvent !== null, 'Warning event should have been emitted')
    assertEquals(warningEvent.message, 'Stop was called but runner has already finished', 'Warning message should match')
  })

  console.log('\n✅ All BaseRunner tests completed!')

  // ===========================================
  // INTERNAL FINALLY TESTS
  // ===========================================
  console.log('\n🧪 Testing BaseRunner internalFinally Feature')
  console.log('='.repeat(50))

  await runTest('BaseRunner internalFinally should be called on successful run', async () => {
    const runner = new TestRunner()

    await runner.run()

    assertEquals(runner.status, Status.Succeeded, 'Runner should have succeeded')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on failed run', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Test failure'

    await runner.run()

    assertEquals(runner.status, Status.Failed, 'Runner should have failed')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on preparation error', async () => {
    const runner = new TestRunner()
    runner.shouldFailInPrepare = true

    await runner.run()

    assertEquals(runner.status, Status.Error, 'Runner should be in error state')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on run error', async () => {
    const runner = new TestRunner()
    runner.shouldFailInRun = true

    await runner.run()

    assertEquals(runner.status, Status.Error, 'Runner should be in error state')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on release error', async () => {
    const runner = new TestRunner()
    runner.shouldFailInRelease = true

    await runner.run()

    assertEquals(runner.status, Status.Error, 'Runner should be in error state')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on timeout', async () => {
    const runner = new TestRunner({ timeout: 50 })
    runner.runDelay = 100 // Longer than timeout

    await runner.run()

    assertEquals(runner.status, Status.TimedOut, 'Runner should have timed out')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on stop', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop'), 50)

    await runPromise

    assertEquals(runner.status, Status.Stopped, 'Runner should be stopped')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on skip', async () => {
    const runner = new TestRunner()

    await runner.skip('Test skip')

    assertEquals(runner.status, Status.Skipped, 'Runner should be skipped')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should be called on fail', async () => {
    const runner = new TestRunner()

    await runner.fail('Test fail')

    assertEquals(runner.status, Status.Failed, 'Runner should be failed')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
  })

  await runTest('BaseRunner internalFinally should handle errors gracefully', async () => {
    const runner = new TestRunner()
    runner.shouldFailInFinally = true

    const events: string[] = []
    let errorEvent: any = null
    let succeededEvent: any = null

    runner.on('error', (event) => {
      errorEvent = event
      events.push('error')
    })
    runner.on('succeeded', (event) => {
      succeededEvent = event
      events.push('succeeded')
    })

    await runner.run()

    assertEquals(runner.status, Status.Succeeded, 'Runner should still succeed despite finally error')
    assertEquals(runner.finallyWasCalled, false, 'internalFinally should have thrown before setting flag')
    assert(errorEvent !== null, 'Error event should have been emitted for finally failure')
    assertEquals(errorEvent.message, 'Internal finally failed', 'Error message should match')
    assert(succeededEvent !== null, 'Succeeded event should still have been emitted')
    assertEquals(events.length, 2, 'Both error and succeeded events should be emitted')
    assertEquals(events[0], 'error', 'Error should be emitted first')
    assertEquals(events[1], 'succeeded', 'Succeeded should be emitted after')
  })

  await runTest('BaseRunner internalFinally should handle errors gracefully on failure', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Original failure'
    runner.shouldFailInFinally = true

    const events: string[] = []
    let errorEvent: any = null
    let failedEvent: any = null

    runner.on('error', (event) => {
      errorEvent = event
      events.push('error')
    })
    runner.on('failed', (event) => {
      failedEvent = event
      events.push('failed')
    })

    await runner.run()

    assertEquals(runner.status, Status.Failed, 'Runner should still fail despite finally error')
    assert(errorEvent !== null, 'Error event should have been emitted for finally failure')
    assertEquals(errorEvent.message, 'Internal finally failed', 'Error message should match')
    assert(failedEvent !== null, 'Failed event should still have been emitted')
    assertEquals(failedEvent.payload.reason, 'Original failure', 'Original failure reason should be preserved')
    assertEquals(events.length, 2, 'Both error and failed events should be emitted')
    assertEquals(events[0], 'error', 'Error should be emitted first')
    assertEquals(events[1], 'failed', 'Failed should be emitted after')
  })

  await runTest('BaseRunner internalFinally should handle async operations', async () => {
    const runner = new TestRunner()
    runner.finallyDelay = 50

    const startTime = Date.now()
    await runner.run()
    const endTime = Date.now()

    assertEquals(runner.status, Status.Succeeded, 'Runner should have succeeded')
    assertEquals(runner.finallyWasCalled, true, 'internalFinally should have been called')
    assert(endTime - startTime >= 50, 'Finally delay should have been respected')
  })

  await runTest('BaseRunner internalFinally should be called exactly once per run', async () => {
    const runner = new TestRunner()
    let finallyCalls = 0

    // Use custom function to count calls
    runner.customFinallyFunction = async () => {
      finallyCalls++
    }

    await runner.run()

    assertEquals(finallyCalls, 1, 'internalFinally should be called exactly once')
  })

  await runTest('BaseRunner internalFinally should have access to final state', async () => {
    const runner = new TestRunner()
    let statusInFinally: Status | null = null
    let measurementInFinally: any = null

    // Use custom function to capture state
    runner.customFinallyFunction = async () => {
      statusInFinally = runner.status
      measurementInFinally = runner.measurement
    }

    await runner.run()

    assertEquals(statusInFinally, Status.Succeeded, 'Status should be set before internalFinally')
    assert(measurementInFinally !== null, 'Measurement should be available in internalFinally')
  })

  console.log('\n✅ All BaseRunner internalFinally tests completed!')

  // ===========================================
  // GETTER TESTS
  // ===========================================
  console.log('\n🧪 Testing BaseRunner Getters')
  console.log('='.repeat(50))

  await runTest('BaseRunner error getter should return null when no error', async () => {
    const runner = new TestRunner()

    assertEquals(runner.error, null, 'Error should be null initially')

    await runner.run()

    assertEquals(runner.error, null, 'Error should be null after successful run')
  })

  await runTest('BaseRunner error getter should return error after preparation failure', async () => {
    const runner = new TestRunner()
    runner.shouldFailInPrepare = true

    await runner.run()

    assert(runner.error !== null, 'Error should not be null after preparation failure')
    assertEquals(runner.error?.message, 'Prepare failed', 'Error message should match')
  })

  await runTest('BaseRunner error getter should return error after run failure', async () => {
    const runner = new TestRunner()
    runner.shouldFailInRun = true

    await runner.run()

    assert(runner.error !== null, 'Error should not be null after run failure')
    assertEquals(runner.error?.message, 'Run failed', 'Error message should match')
  })

  await runTest('BaseRunner error getter should return error after release failure', async () => {
    const runner = new TestRunner()
    runner.shouldFailInRelease = true

    await runner.run()

    assert(runner.error !== null, 'Error should not be null after release failure')
    assertEquals(runner.error?.message, 'Release failed', 'Error message should match')
  })

  await runTest('BaseRunner failureReason getter should return null when no failure', async () => {
    const runner = new TestRunner()

    assertEquals(runner.failureReason, null, 'Failure reason should be null initially')

    await runner.run()

    assertEquals(runner.failureReason, null, 'Failure reason should be null after successful run')
  })

  await runTest('BaseRunner failureReason getter should return reason when run fails', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Custom failure reason'

    await runner.run()

    assertEquals(runner.failureReason, 'Custom failure reason', 'Failure reason should match')
    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')
  })

  await runTest('BaseRunner skipReason getter should return null when not skipped', async () => {
    const runner = new TestRunner()

    assertEquals(runner.skipReason, null, 'Skip reason should be null initially')

    await runner.run()

    assertEquals(runner.skipReason, null, 'Skip reason should be null after normal run')
  })

  await runTest('BaseRunner skipReason getter should return reason when skipped', async () => {
    const runner = new TestRunner()

    await runner.skip('Test skip reason')

    assertEquals(runner.skipReason, 'Test skip reason', 'Skip reason should match')
    assertEquals(runner.status, Status.Skipped, 'Runner should be in skipped state')
  })

  await runTest('BaseRunner skipReason getter should return null when skipped without reason', async () => {
    const runner = new TestRunner()

    await runner.skip()

    assertEquals(runner.skipReason, null, 'Skip reason should be null when no reason given')
    assertEquals(runner.status, Status.Skipped, 'Runner should be in skipped state')
  })

  await runTest('BaseRunner startedAt getter should return null when idle', async () => {
    const runner = new TestRunner()

    assertEquals(runner.startedAt, null, 'StartedAt should be null when idle')
  })

  await runTest('BaseRunner startedAt getter should return null when skipped', async () => {
    const runner = new TestRunner()

    await runner.skip('Test skip')

    assertEquals(runner.startedAt, null, 'StartedAt should be null when skipped')
  })

  await runTest('BaseRunner startedAt getter should return date when running', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()

    // Wait a bit for the run to start
    await new Promise((resolve) => setTimeout(resolve, 50))

    assert(runner.startedAt instanceof Date, 'StartedAt should be a Date when running')

    await runPromise

    assert(runner.startedAt instanceof Date, 'StartedAt should still be a Date after completion')
  })

  await runTest('BaseRunner finishedAt getter should return null when not finished', async () => {
    const runner = new TestRunner()

    assertEquals(runner.finishedAt, null, 'FinishedAt should be null initially')

    runner.runDelay = 100
    const runPromise = runner.run()

    // Wait a bit but not for completion
    await new Promise((resolve) => setTimeout(resolve, 50))

    assertEquals(runner.finishedAt, null, 'FinishedAt should be null while running')

    await runPromise

    assert(runner.finishedAt instanceof Date, 'FinishedAt should be a Date after completion')
  })

  await runTest('BaseRunner finishedAt getter should return date when succeeded', async () => {
    const runner = new TestRunner()

    await runner.run()

    assert(runner.finishedAt instanceof Date, 'FinishedAt should be a Date when succeeded')
    assertEquals(runner.status, Status.Succeeded, 'Runner should be in succeeded state')
  })

  await runTest('BaseRunner finishedAt getter should return date when failed', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Test failure'

    await runner.run()

    assert(runner.finishedAt instanceof Date, 'FinishedAt should be a Date when failed')
    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')
  })

  await runTest('BaseRunner finishedAt getter should return date when stopped', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop'), 50)

    await runPromise

    assert(runner.finishedAt instanceof Date, 'FinishedAt should be a Date when stopped')
    assertEquals(runner.status, Status.Stopped, 'Runner should be in stopped state')
  })

  await runTest('BaseRunner measurement getter should return null when not finished', async () => {
    const runner = new TestRunner()

    assertEquals(runner.measurement, null, 'Measurement should be null initially')

    runner.runDelay = 100
    const runPromise = runner.run()

    // Wait a bit but not for completion
    await new Promise((resolve) => setTimeout(resolve, 50))

    assertEquals(runner.measurement, null, 'Measurement should be null while running')

    await runPromise

    assert(runner.measurement !== null, 'Measurement should not be null after completion')
  })

  await runTest('BaseRunner measurement getter should return measurement data when succeeded', async () => {
    const runner = new TestRunner()

    await runner.run()

    assert(runner.measurement !== null, 'Measurement should not be null when succeeded')
    assert(typeof runner.measurement!.milliseconds === 'number', 'Measurement should have milliseconds as number')
    assert(typeof runner.measurement!.seconds === 'number', 'Measurement should have seconds as number')
    assertEquals(runner.status, Status.Succeeded, 'Runner should be in succeeded state')
  })

  await runTest('BaseRunner measurement getter should return measurement data when failed', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Test failure'

    await runner.run()

    assert(runner.measurement !== null, 'Measurement should not be null when failed')
    assert(typeof runner.measurement!.milliseconds === 'number', 'Measurement should have milliseconds as number')
    assert(typeof runner.measurement!.seconds === 'number', 'Measurement should have seconds as number')
    assertEquals(runner.status, Status.Failed, 'Runner should be in failed state')
  })

  await runTest('BaseRunner measurement getter should return measurement data when stopped', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop'), 50)

    await runPromise

    assert(runner.measurement !== null, 'Measurement should not be null when stopped')
    assert(typeof runner.measurement!.milliseconds === 'number', 'Measurement should have milliseconds as number')
    assert(typeof runner.measurement!.seconds === 'number', 'Measurement should have seconds as number')
    assertEquals(runner.status, Status.Stopped, 'Runner should be in stopped state')
  })

  await runTest('BaseRunner measurement getter should return measurement data when timed out', async () => {
    const runner = new TestRunner({ timeout: 50 })
    runner.runDelay = 100 // Longer than timeout

    await runner.run()

    assert(runner.measurement !== null, 'Measurement should not be null when timed out')
    assert(typeof runner.measurement!.milliseconds === 'number', 'Measurement should have milliseconds as number')
    assert(typeof runner.measurement!.seconds === 'number', 'Measurement should have seconds as number')
    assertEquals(runner.status, Status.TimedOut, 'Runner should be in timed out state')
  })

  await runTest('BaseRunner finishedAt getter should return date when timed out', async () => {
    const runner = new TestRunner({ timeout: 50 })
    runner.runDelay = 100 // Longer than timeout

    await runner.run()

    assert(runner.finishedAt instanceof Date, 'FinishedAt should be a Date when timed out')
    assertEquals(runner.status, Status.TimedOut, 'Runner should be in timed out state')
  })

  await runTest('BaseRunner startedAt and finishedAt should show proper timing', async () => {
    const runner = new TestRunner()
    runner.runDelay = 50

    const beforeRun = new Date()
    await runner.run()
    const afterRun = new Date()

    assert(runner.startedAt !== null, 'StartedAt should not be null')
    assert(runner.finishedAt !== null, 'FinishedAt should not be null')

    assert(runner.startedAt! >= beforeRun, 'StartedAt should be after test start')
    assert(runner.startedAt! <= afterRun, 'StartedAt should be before test end')
    assert(runner.finishedAt! >= beforeRun, 'FinishedAt should be after test start')
    assert(runner.finishedAt! <= afterRun, 'FinishedAt should be before test end')
    assert(runner.finishedAt! >= runner.startedAt!, 'FinishedAt should be after startedAt')
  })

  await runTest('BaseRunner getters should maintain consistency across lifecycle', async () => {
    const runner = new TestRunner()

    // Initial state
    assertEquals(runner.status, Status.Idle, 'Initial status should be idle')
    assertEquals(runner.error, null, 'Initial error should be null')
    assertEquals(runner.failureReason, null, 'Initial failure reason should be null')
    assertEquals(runner.skipReason, null, 'Initial skip reason should be null')
    assertEquals(runner.startedAt, null, 'Initial startedAt should be null')
    assertEquals(runner.finishedAt, null, 'Initial finishedAt should be null')
    assertEquals(runner.measurement, null, 'Initial measurement should be null')

    // After successful run
    await runner.run()

    assertEquals(runner.status, Status.Succeeded, 'Final status should be succeeded')
    assertEquals(runner.error, null, 'Final error should be null')
    assertEquals(runner.failureReason, null, 'Final failure reason should be null')
    assertEquals(runner.skipReason, null, 'Final skip reason should be null')
    assert(runner.startedAt instanceof Date, 'Final startedAt should be a Date')
    assert(runner.finishedAt instanceof Date, 'Final finishedAt should be a Date')
    assert(runner.measurement !== null, 'Final measurement should not be null')
  })

  console.log('\n✅ All BaseRunner getter tests completed!')

  console.log('\n🧪 Testing BaseRunner Boolean Getters')
  console.log('='.repeat(50))

  await runTest('BaseRunner isIdle getter should return true when idle', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isIdle, true, 'isIdle should be true initially')
    assertEquals(runner.status, Status.Idle, 'Status should be idle')
  })

  await runTest('BaseRunner isIdle getter should return false when not idle', async () => {
    const runner = new TestRunner()

    await runner.run()

    assertEquals(runner.isIdle, false, 'isIdle should be false after running')
    assertEquals(runner.status, Status.Succeeded, 'Status should be succeeded')
  })

  await runTest('BaseRunner isPreparing getter should return true when preparing', async () => {
    const runner = new TestRunner()
    runner.prepareDelay = 100

    const runPromise = runner.run()

    // Wait a bit for preparing to start
    await new Promise((resolve) => setTimeout(resolve, 30))

    assertEquals(runner.isPreparing, true, 'isPreparing should be true during preparation')
    assertEquals(runner.status, Status.Preparing, 'Status should be preparing')

    await runPromise
  })

  await runTest('BaseRunner isPreparing getter should return false when not preparing', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isPreparing, false, 'isPreparing should be false when idle')

    await runner.run()

    assertEquals(runner.isPreparing, false, 'isPreparing should be false when finished')
  })

  await runTest('BaseRunner isRunning getter should return true when running', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()

    // Wait for running phase to start
    await new Promise((resolve) => setTimeout(resolve, 30))

    assertEquals(runner.isRunning, true, 'isRunning should be true during run phase')
    assertEquals(runner.status, Status.Running, 'Status should be running')

    await runPromise
  })

  await runTest('BaseRunner isRunning getter should return false when not running', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isRunning, false, 'isRunning should be false when idle')

    await runner.run()

    assertEquals(runner.isRunning, false, 'isRunning should be false when finished')
  })

  await runTest('BaseRunner isStopping getter should return true when stopping', async () => {
    const runner = new TestRunner()
    runner.runDelay = 200

    const runPromise = runner.run()

    // Stop the runner and check status during stopping
    setTimeout(async () => {
      await runner.stop('Test stop')
    }, 50)

    // Wait for stopping phase
    await new Promise((resolve) => setTimeout(resolve, 80))

    if (runner.status === Status.Stopping) {
      assertEquals(runner.isStopping, true, 'isStopping should be true during stopping phase')
    }

    await runPromise
  })

  await runTest('BaseRunner isStopping getter should return false when not stopping', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isStopping, false, 'isStopping should be false when idle')

    await runner.run()

    assertEquals(runner.isStopping, false, 'isStopping should be false when finished')
  })

  await runTest('BaseRunner isReleasing getter should return true when releasing', async () => {
    const runner = new TestRunner()
    runner.releaseDelay = 100

    const runPromise = runner.run()

    // Wait for releasing phase to start
    await new Promise((resolve) => setTimeout(resolve, 30))

    if (runner.status === Status.Releasing) {
      assertEquals(runner.isReleasing, true, 'isReleasing should be true during release phase')
    }

    await runPromise
  })

  await runTest('BaseRunner isReleasing getter should return false when not releasing', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isReleasing, false, 'isReleasing should be false when idle')

    await runner.run()

    assertEquals(runner.isReleasing, false, 'isReleasing should be false when finished')
  })

  await runTest('BaseRunner isStopped getter should return true when stopped', async () => {
    const runner = new TestRunner()
    runner.runDelay = 100

    const runPromise = runner.run()
    setTimeout(() => runner.stop('Test stop'), 50)

    await runPromise

    assertEquals(runner.isStopped, true, 'isStopped should be true when stopped')
    assertEquals(runner.status, Status.Stopped, 'Status should be stopped')
  })

  await runTest('BaseRunner isStopped getter should return false when not stopped', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isStopped, false, 'isStopped should be false when idle')

    await runner.run()

    assertEquals(runner.isStopped, false, 'isStopped should be false when succeeded')
  })

  await runTest('BaseRunner isFailed getter should return true when failed', async () => {
    const runner = new TestRunner()
    runner.shouldReturnFailureReason = 'Test failure'

    await runner.run()

    assertEquals(runner.isFailed, true, 'isFailed should be true when failed')
    assertEquals(runner.status, Status.Failed, 'Status should be failed')
  })

  await runTest('BaseRunner isFailed getter should return false when not failed', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isFailed, false, 'isFailed should be false when idle')

    await runner.run()

    assertEquals(runner.isFailed, false, 'isFailed should be false when succeeded')
  })

  await runTest('BaseRunner isError getter should return true when error', async () => {
    const runner = new TestRunner()
    runner.shouldFailInPrepare = true

    await runner.run()

    assertEquals(runner.isError, true, 'isError should be true when error')
    assertEquals(runner.status, Status.Error, 'Status should be error')
  })

  await runTest('BaseRunner isSucceeded getter should return true when succeeded', async () => {
    const runner = new TestRunner()

    await runner.run()

    assertEquals(runner.isSucceeded, true, 'isSucceeded should be true when succeeded')
    assertEquals(runner.status, Status.Succeeded, 'Status should be succeeded')
  })

  await runTest('BaseRunner isSucceeded getter should return false when not succeeded', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isSucceeded, false, 'isSucceeded should be false when idle')

    runner.shouldReturnFailureReason = 'Test failure'
    await runner.run()

    assertEquals(runner.isSucceeded, false, 'isSucceeded should be false when failed')
  })

  await runTest('BaseRunner isTimedOut getter should return true when timed out', async () => {
    const runner = new TestRunner({ timeout: 50 })
    runner.runDelay = 100 // Longer than timeout

    await runner.run()

    assertEquals(runner.isTimedOut, true, 'isTimedOut should be true when timed out')
    assertEquals(runner.status, Status.TimedOut, 'Status should be timed out')
  })

  await runTest('BaseRunner isTimedOut getter should return false when not timed out', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isTimedOut, false, 'isTimedOut should be false when idle')

    await runner.run()

    assertEquals(runner.isTimedOut, false, 'isTimedOut should be false when succeeded')
  })

  await runTest('BaseRunner isSkipped getter should return true when skipped', async () => {
    const runner = new TestRunner()

    await runner.skip('Test skip')

    assertEquals(runner.isSkipped, true, 'isSkipped should be true when skipped')
    assertEquals(runner.status, Status.Skipped, 'Status should be skipped')
  })

  await runTest('BaseRunner isSkipped getter should return false when not skipped', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isSkipped, false, 'isSkipped should be false when idle')

    await runner.run()

    assertEquals(runner.isSkipped, false, 'isSkipped should be false when succeeded')
  })

  await runTest('BaseRunner isActive getter should return false when idle', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isActive, false, 'isActive should be false when idle')
    assertEquals(runner.status, Status.Idle, 'Status should be idle')
  })

  await runTest('BaseRunner isActive getter should return true during lifecycle phases', async () => {
    const runner = new TestRunner()
    runner.prepareDelay = 50
    runner.runDelay = 50
    runner.releaseDelay = 50

    const runPromise = runner.run()

    // Check during preparing
    await new Promise((resolve) => setTimeout(resolve, 25))
    if (runner.status === Status.Preparing) {
      assertEquals(runner.isActive, true, 'isActive should be true when preparing')
    }

    // Check during running
    await new Promise((resolve) => setTimeout(resolve, 50))
    if (runner.status === Status.Running) {
      assertEquals(runner.isActive, true, 'isActive should be true when running')
    }

    await runPromise

    assertEquals(runner.isActive, false, 'isActive should be false when finished')
  })

  await runTest('BaseRunner isActive getter should return false when finished', async () => {
    const runner = new TestRunner()

    await runner.run()

    assertEquals(runner.isActive, false, 'isActive should be false when succeeded')
    assertEquals(runner.status, Status.Succeeded, 'Status should be succeeded')
  })

  await runTest('BaseRunner isActive getter should return false when skipped', async () => {
    const runner = new TestRunner()

    await runner.skip('Test skip')

    assertEquals(runner.isActive, false, 'isActive should be false when skipped')
    assertEquals(runner.status, Status.Skipped, 'Status should be skipped')
  })

  await runTest('BaseRunner isFinished getter should return false when not finished', async () => {
    const runner = new TestRunner()

    assertEquals(runner.isFinished, false, 'isFinished should be false when idle')

    runner.runDelay = 100
    const runPromise = runner.run()

    // Check during active phases
    await new Promise((resolve) => setTimeout(resolve, 30))
    assertEquals(runner.isFinished, false, 'isFinished should be false during active phases')

    await runPromise

    assertEquals(runner.isFinished, true, 'isFinished should be true when completed')
  })

  await runTest('BaseRunner isFinished getter should return true for all terminal states', async () => {
    // Test succeeded
    const succeededRunner = new TestRunner()
    await succeededRunner.run()
    assertEquals(succeededRunner.isFinished, true, 'isFinished should be true when succeeded')

    // Test failed
    const failedRunner = new TestRunner()
    failedRunner.shouldReturnFailureReason = 'Test failure'
    await failedRunner.run()
    assertEquals(failedRunner.isFinished, true, 'isFinished should be true when failed')

    // Test stopped
    const stoppedRunner = new TestRunner()
    stoppedRunner.runDelay = 100
    const runPromise = stoppedRunner.run()
    setTimeout(() => stoppedRunner.stop('Test stop'), 50)
    await runPromise
    assertEquals(stoppedRunner.isFinished, true, 'isFinished should be true when stopped')

    // Test timed out
    const timedOutRunner = new TestRunner({ timeout: 50 })
    timedOutRunner.runDelay = 100
    await timedOutRunner.run()
    assertEquals(timedOutRunner.isFinished, true, 'isFinished should be true when timed out')

    // Test skipped
    const skippedRunner = new TestRunner()
    skippedRunner.skip('Test skip')
    assertEquals(skippedRunner.isFinished, true, 'isFinished should be true when skipped')

    // Test error
    const errorRunner = new TestRunner()
    errorRunner.shouldFailInPrepare = true
    await errorRunner.run()
    assertEquals(errorRunner.isFinished, true, 'isFinished should be true when error occurred')
  })

  await runTest('BaseRunner boolean getters should be mutually exclusive', async () => {
    const runner = new TestRunner()

    // Test idle state
    assertEquals(runner.isIdle, true, 'Should be idle initially')
    assertEquals(runner.isPreparing, false, 'Should not be preparing when idle')
    assertEquals(runner.isRunning, false, 'Should not be running when idle')
    assertEquals(runner.isStopping, false, 'Should not be stopping when idle')
    assertEquals(runner.isReleasing, false, 'Should not be releasing when idle')
    assertEquals(runner.isStopped, false, 'Should not be stopped when idle')
    assertEquals(runner.isFailed, false, 'Should not be failed when idle')
    assertEquals(runner.isSucceeded, false, 'Should not be succeeded when idle')
    assertEquals(runner.isTimedOut, false, 'Should not be timed out when idle')
    assertEquals(runner.isSkipped, false, 'Should not be skipped when idle')

    await runner.run()

    // Test succeeded state
    assertEquals(runner.isIdle, false, 'Should not be idle when succeeded')
    assertEquals(runner.isPreparing, false, 'Should not be preparing when succeeded')
    assertEquals(runner.isRunning, false, 'Should not be running when succeeded')
    assertEquals(runner.isStopping, false, 'Should not be stopping when succeeded')
    assertEquals(runner.isReleasing, false, 'Should not be releasing when succeeded')
    assertEquals(runner.isStopped, false, 'Should not be stopped when succeeded')
    assertEquals(runner.isFailed, false, 'Should not be failed when succeeded')
    assertEquals(runner.isSucceeded, true, 'Should be succeeded')
    assertEquals(runner.isTimedOut, false, 'Should not be timed out when succeeded')
    assertEquals(runner.isSkipped, false, 'Should not be skipped when succeeded')
  })

  await runTest('BaseRunner boolean getters consistency during lifecycle', async () => {
    const runner = new TestRunner()
    runner.prepareDelay = 50
    runner.runDelay = 50
    runner.releaseDelay = 50

    // Test skipped state
    const skippedRunner = new TestRunner()
    await skippedRunner.skip('Test skip')

    assertEquals(skippedRunner.isSkipped, true, 'Should be skipped')
    assertEquals(skippedRunner.isActive, false, 'Should not be active when skipped')
    assertEquals(skippedRunner.isFinished, true, 'Should be finished when skipped')

    // Test all phases work correctly
    const runPromise = runner.run()

    await runPromise

    // Final state checks
    assertEquals(runner.isSucceeded, true, 'Should be succeeded at end')
    assertEquals(runner.isActive, false, 'Should not be active when finished')
    assertEquals(runner.isFinished, true, 'Should be finished when succeeded')
  })

  console.log('\n✅ All BaseRunner boolean getter tests completed!')
}
