import { PartialType } from '@nestjs/swagger'

import { TenantCreateDto } from './tenant-create.dto'
export class TenantUpdateDto extends PartialType(TenantCreateDto) {
  attributes?: object
}
