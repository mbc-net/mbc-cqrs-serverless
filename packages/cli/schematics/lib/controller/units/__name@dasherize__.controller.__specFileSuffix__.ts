import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { <%= classify(name) %>Controller } from 'src/<%= dasherize(name) %>/<%= dasherize(name) %>.controller'

describe('<%= classify(name) %>Controller', () => {
  let controller: <%= classify(name) %>Controller

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [<%= classify(name) %>Controller],
    }).useMocker(createMock).compile()

    controller = module.get<<%= classify(name) %>Controller>(<%= classify(name) %>Controller)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
