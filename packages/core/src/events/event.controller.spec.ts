import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { S3Event } from 'aws-lambda'

import { EventController } from './event.controller'
import { EventService } from './event.services'

describe('EventController', () => {
  let controller: EventController
  let service: EventService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [EventService],
    })
      .useMocker(createMock)
      .compile()

    controller = module.get<EventController>(EventController)
    service = module.get<EventService>(EventService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('handleS3Event', () => {
    it('should handle S3 event successfully', async () => {
      const eventData: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'us-east-1',
            eventTime: '2023-01-01T00:00:00.000Z',
            eventName: 's3:ObjectCreated:Put',
            userIdentity: {
              principalId: 'test-principal',
            },
            requestParameters: {
              sourceIPAddress: '127.0.0.1',
            },
            responseElements: {
              'x-amz-request-id': 'test-request-id',
              'x-amz-id-2': 'test-id-2',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: {
                  principalId: 'test-owner',
                },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'test-key',
                size: 1024,
                eTag: 'test-etag',
                sequencer: 'test-sequencer',
              },
            },
          },
        ],
      }
      const expectedResult = [{ success: true }, { processed: 1 }]

      jest.spyOn(service, 'handleS3Event').mockResolvedValue(expectedResult as any)

      const result = await controller.handleS3Event(eventData)

      expect(service.handleS3Event).toHaveBeenCalledWith(eventData)
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const eventData: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'us-east-1',
            eventTime: '2023-01-01T00:00:00.000Z',
            eventName: 's3:ObjectCreated:Put',
            userIdentity: {
              principalId: 'test-principal',
            },
            requestParameters: {
              sourceIPAddress: '127.0.0.1',
            },
            responseElements: {
              'x-amz-request-id': 'test-request-id',
              'x-amz-id-2': 'test-id-2',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: {
                  principalId: 'test-owner',
                },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'test-key',
                size: 1024,
                eTag: 'test-etag',
                sequencer: 'test-sequencer',
              },
            },
          },
        ],
      }
      const error = new Error('S3 event processing failed')

      jest.spyOn(service, 'handleS3Event').mockRejectedValue(error)

      await expect(controller.handleS3Event(eventData)).rejects.toThrow(
        'S3 event processing failed',
      )
    })
  })
})
