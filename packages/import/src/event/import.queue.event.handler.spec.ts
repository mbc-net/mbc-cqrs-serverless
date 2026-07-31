import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'

import { ImportQueueEvent } from './import.queue.event'
import { ImportQueueEventHandler } from './import.queue.event.handler'
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
    // CsvBatchProcessor uses the raw SQS payload
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
    // 1. Mock the raw SQS payload (does not contain prototype getters like importEntity)
    const mockPayload = {
      action: 'single-import-process',
      dynamodb: {
        NewImage: { pk: { S: 'IMPORT#tenant001' }, sk: { S: 'contract#123' } },
      },
    }

    // 2. Mock the parsed, rich object returned by the `importEvent` getter
    const mockImportEvent = {
      importKey: { pk: 'IMPORT#tenant001', sk: 'contract#123' },
      importEntity: { id: 'IMPORT#tenant001#contract#123', type: 'contract' },
    }

    // 3. Assemble the mock event
    const mockEvent = {
      isCsvBatch: false,
      payload: mockPayload,
      importEvent: mockImportEvent, // Provide the mocked getter output
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    // THE FIX: Assert it was called with the parsed importEvent, NOT the raw payload
    expect(singleImportProcessor.process).toHaveBeenCalledWith(mockImportEvent)
    expect(csvBatchProcessor.process).not.toHaveBeenCalled()
  })

  it('should rethrow errors to trigger SQS retries', async () => {
    const mockEvent = {
      isCsvBatch: true,
      payload: {},
    } as unknown as ImportQueueEvent

    const error = new Error('Processing failed')
    csvBatchProcessor.process.mockRejectedValue(error)

    await expect(handler.execute(mockEvent)).rejects.toThrow(
      'Processing failed',
    )
  })
})
