import { IInvoke } from '@mbc-cqrs-serverless/core'
import { Test } from '@nestjs/testing'

import { MasterAccessService } from '../access/master-access.service'
import { MasterControllerGuard } from '../guards'
import { MasterAccessController } from './master-access.controller'

describe('MasterAccessController', () => {
  let controller: MasterAccessController
  const getAccess = jest.fn()
  const invokeContext = { event: {} } as IInvoke

  beforeEach(async () => {
    getAccess.mockReset()
    const module = await Test.createTestingModule({
      controllers: [MasterAccessController],
      providers: [{ provide: MasterAccessService, useValue: { getAccess } }],
    })
      .overrideGuard(MasterControllerGuard)
      .useValue({ canActivate: () => true })
      .compile()
    controller = module.get(MasterAccessController)
  })

  it.each([
    ['returns enabled false with no resolver', { enabled: false, grants: [] }],
    [
      'returns the grants of the caller',
      { enabled: true, grants: [{ systemId: 'sys-a', actions: ['read'] }] },
    ],
    ['returns empty grants when not logged in', { enabled: true, grants: [] }],
  ])('%s', async (_name, result) => {
    getAccess.mockResolvedValue(result)
    await expect(controller.getAccess(invokeContext)).resolves.toEqual(result)
    expect(getAccess).toHaveBeenCalledWith({ invokeContext })
  })
})
