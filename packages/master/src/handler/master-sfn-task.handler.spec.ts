import { createMock } from '@golevelup/ts-jest'
import {
  DataService,
  DynamoDbService,
  extractInvokeContext,
} from '@mbc-cqrs-serverless/core'
import { SequencesService } from '@mbc-cqrs-serverless/sequence'
import { Test } from '@nestjs/testing'

import { CopyType } from '../dto'
import { PRISMA_SERVICE } from '../master.module-definition'
import { MasterDataService, MasterSettingService } from '../services'
import { MasterSfnTaskEventHandler } from './master-sfn-task.handler'

jest.mock('@mbc-cqrs-serverless/core', () => ({
  ...jest.requireActual('@mbc-cqrs-serverless/core'),
  extractInvokeContext: jest.fn(),
}))

describe('MasterSfnTaskEventHandler', () => {
  let handler: MasterSfnTaskEventHandler
  let prisma: { master: { findMany: jest.Mock } }
  let sequences: jest.Mocked<SequencesService>
  let dynamoDb: jest.Mocked<DynamoDbService>

  const setting = {
    pk: 'MASTER#common',
    sk: 'MASTER_SETTING#X',
    tenantCode: 'common',
    attributes: {
      fields: [
        { physicalName: 'code', dataType: 'auto_number', formatCode: 'F' },
      ],
    },
  }
  const event: any = {
    input: {
      input: {
        masterSettingId: 'MASTER#common#MASTER_SETTING#X',
        targetTenants: ['ta'],
        copyType: CopyType.DATA_ONLY,
      },
    },
  }

  beforeEach(async () => {
    ;(extractInvokeContext as jest.Mock).mockReturnValue({})
    prisma = { master: { findMany: jest.fn().mockResolvedValue([]) } }
    dynamoDb = createMock<DynamoDbService>()
    dynamoDb.getTableName.mockReturnValue('sequences')
    sequences = createMock<SequencesService>()
    sequences.getCurrentSequence.mockResolvedValue(null)
    const dataService = createMock<DataService>()
    dataService.getItem.mockResolvedValue(setting as any)

    const module = await Test.createTestingModule({
      providers: [
        MasterSfnTaskEventHandler,
        { provide: DynamoDbService, useValue: dynamoDb },
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: MasterSettingService, useValue: createMock() },
        { provide: MasterDataService, useValue: createMock() },
        { provide: DataService, useValue: dataService },
        { provide: SequencesService, useValue: sequences },
      ],
    }).compile()
    handler = module.get(MasterSfnTaskEventHandler)
  })

  it('reads source data from the source setting tenant', async () => {
    await handler.execute(event)
    expect(prisma.master.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ pk: 'MASTER#common' }),
    })
  })

  it('copies the sequence when the target is behind the source', async () => {
    sequences.getCurrentSequence.mockImplementation(async (key: any) =>
      key.pk === 'SEQ#common' ? ({ seq: 5 } as any) : ({ seq: 2 } as any),
    )
    await handler.execute(event)
    expect(dynamoDb.putItem).toHaveBeenCalledWith(
      'sequences',
      expect.objectContaining({ pk: 'SEQ#ta', seq: 5 }),
    )
  })

  it('does not copy the sequence when the target is ahead', async () => {
    sequences.getCurrentSequence.mockImplementation(async (key: any) =>
      key.pk === 'SEQ#common' ? ({ seq: 2 } as any) : ({ seq: 5 } as any),
    )
    await handler.execute(event)
    expect(dynamoDb.putItem).not.toHaveBeenCalled()
  })
})
