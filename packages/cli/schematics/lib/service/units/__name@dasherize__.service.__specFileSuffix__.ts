import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { <%= classify(name) %>Service } from 'src/<%= dasherize(name) %>/<%= dasherize(name) %>.service'

describe('<%= classify(name) %>Service', () => {
  let service: <%= classify(name) %>Service

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [<%= classify(name) %>Service],
    }).useMocker(createMock).compile()

    service = module.get<<%= classify(name) %>Service>(<%= classify(name) %>Service)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
