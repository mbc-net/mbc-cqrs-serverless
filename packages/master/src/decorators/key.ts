import { DetailDto } from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

export const DetailKeys = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const id = request.params.id

    if (typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException('ID must be a non-empty string.')
    }

    const { pk, sk } = getDetailKeyFromId(id)

    if (!pk || !sk) {
      throw new BadRequestException(
        'Invalid ID format. Expected ID to contain valid PK and SK components separated by "#".',
      )
    }

    const detailDto = plainToInstance(DetailDto, { pk, sk })
    const errors = await validate(detailDto)

    if (errors.length > 0) {
      throw new BadRequestException(
        errors.map((err) => Object.values(err.constraints)).flat(),
      )
    }

    return detailDto
  },
)

function getDetailKeyFromId(id: string) {
  const parts = id.split('#')
  const pk = parts.slice(0, 2).join('#')
  const sk = parts.slice(2).join('#')

  return {
    pk: pk,
    sk: sk,
  }
}
