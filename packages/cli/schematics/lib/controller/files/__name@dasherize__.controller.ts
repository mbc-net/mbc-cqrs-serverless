import { Controller, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger'

@ApiTags('<%= dasherize(name) %>')
@Controller('api/<%= dasherize(name) %>')
export class <%= classify(name) %>Controller {
    private readonly logger = new Logger(<%= classify(name) %>Controller.name)

    constructor() {}

}
