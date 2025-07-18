import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'

import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
  let controller: AppController
  let service: AppService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    })
      .useMocker(createMock)
      .compile()

    controller = module.get<AppController>(AppController)
    service = module.get<AppService>(AppService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getHello', () => {
    it('should return hello message from service', () => {
      const mockInvokeContext = {
        event: {
          requestContext: {
            authorizer: {
              jwt: {
                claims: {
                  'custom:tenant': 'test-tenant',
                  'cognito:username': 'test-user',
                },
              },
            },
          },
        },
      } as any
      const expectedMessage = 'Hello World!'
      jest.spyOn(service, 'getHello').mockReturnValue(expectedMessage)

      const result = controller.getHello(mockInvokeContext)

      expect(service.getHello).toHaveBeenCalled()
      expect(result).toBe(expectedMessage)
    })
  })
})
