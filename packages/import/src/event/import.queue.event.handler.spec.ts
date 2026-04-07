import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'

import { ImportQueueEventHandler } from './import.queue.event.handler'
import { ImportQueueEvent } from './import.queue.event'
import { CsvBatchProcessor } from './processor/csv-batch.processor'
import { SingleImportProcessor } from './processor/single-import.processor'

describe('ImportQueueEventHandler', () => {
  let handler: ImportQueueEventHandler
  let csvBatchProcessor: jest.Mocked<CsvBatchProcessor>
  let singleImportProcessor: jest.Mocked<SingleImportProcessor>

  beforeEach(async () => {
    csvBatchProcessor = createMock<CsvBatchProcessor>()
    singleImportProcessor = createMock<SingleImportProcessor>()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportQueueEventHandler,
        { provide: CsvBatchProcessor, useValue: csvBatchProcessor },
        { provide: SingleImportProcessor, useValue: singleImportProcessor },
      ],
    }).compile()

    handler = module.get<ImportQueueEventHandler>(ImportQueueEventHandler)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  it('should route to CsvBatchProcessor when event.isCsvBatch is true', async () => {
    const mockPayload = { action: 'csv-batch-process', items: [] }
    const mockEvent = {
      isCsvBatch: true,
      payload: mockPayload,
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    expect(csvBatchProcessor.process).toHaveBeenCalledWith(mockPayload)
    expect(singleImportProcessor.process).not.toHaveBeenCalled()
  })

  it('should route to SingleImportProcessor when event.isCsvBatch is false', async () => {
    const mockPayload = { action: 'single-import-process', importEntity: {} }
    const mockEvent = {
      isCsvBatch: false,
      payload: mockPayload,
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    expect(singleImportProcessor.process).toHaveBeenCalledWith(mockPayload)
    expect(csvBatchProcessor.process).not.toHaveBeenCalled()
  })

  it('should throw an error and let SQS retry if processing fails', async () => {
    const mockEvent = {
      isCsvBatch: true,
      payload: {},
    } as unknown as ImportQueueEvent

    const error = new Error('Simulated processing failure')
    csvBatchProcessor.process.mockRejectedValue(error)

    // The handler should NOT swallow the error. It must bubble up so SQS retries the message.
    await expect(handler.execute(mockEvent)).rejects.toThrow(
      'Simulated processing failure',
    )
  })
})
