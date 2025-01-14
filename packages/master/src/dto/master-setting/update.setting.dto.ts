import { PartialType } from '@nestjs/swagger'

import { TenantSettingDto } from './tenant-setting-create.dto'
export class UpdateSettingDto extends PartialType(TenantSettingDto) {
  settingValue: object
}
