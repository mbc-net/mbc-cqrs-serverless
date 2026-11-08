import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { Controller, INestApplication, Param, Post } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { S3Service } from '../data-store/s3.service'
import { DynamoDBExceptionFilter } from './dynamodb-exception.filter'

const service = new DynamoDbService(
  new ConfigService({ ATTRIBUTE_LIMIT_SIZE: 64, DYNAMODB_REGION: 'local' }),
  {} as S3Service,
)

@Controller()
class AdmissionController {
  @Post(':codes')
  persist(@Param('codes') codes: string) {
    jest.spyOn(service.client, 'send').mockRejectedValueOnce(
      new TransactionCanceledException({
        message: 'Transaction cancelled',
        $metadata: { httpStatusCode: 400 },
        CancellationReasons: codes.split(',').map((Code) => ({ Code })),
      }) as never,
    )
    return service.putItemWithConditions(
      'commands',
      { pk: 'tenant', sk: 'command@1' },
      'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      [
        {
          TableName: 'witness',
          Key: { pk: { S: 'tenant' } },
          ConditionExpression: 'attribute_exists(pk)',
        },
      ],
    )
  }
}

describe('HTTP responses for admitted command persistence', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdmissionController],
    }).compile()
    app = module.createNestApplication({ logger: false })
    const { httpAdapter } = app.get(HttpAdapterHost)
    app.useGlobalFilters(new DynamoDBExceptionFilter(httpAdapter))
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    jest.restoreAllMocks()
    service.client.destroy()
  })

  it.each([
    ['ConditionalCheckFailed,None', 409, 'version conflict'],
    ['None,ConditionalCheckFailed', 409, 'admission rejection'],
    ['TransactionConflict,None', 503, 'transaction contention'],
    ['None,ThrottlingError', 500, 'an unclassified cancellation'],
  ])('maps %s to %i for %s', async (codes, status) => {
    await request(app.getHttpServer()).post(`/${codes}`).expect(status)
  })

  it('tells version conflicts and admission rejections apart in the body', async () => {
    const server = app.getHttpServer()
    const conflict = await request(server).post('/ConditionalCheckFailed,None')
    const rejected = await request(server).post('/None,ConditionalCheckFailed')
    expect(conflict.body.message).toContain('conditional request failed')
    expect(rejected.body).toEqual({
      statusCode: 409,
      message: 'Command admission rejected',
    })
  })
})
