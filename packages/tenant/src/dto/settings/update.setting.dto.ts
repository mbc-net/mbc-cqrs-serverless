import { PartialType } from '@nestjs/swagger'

import { CreateSettingDto } from './create.setting.dto'
export class UpdateSettingDto extends PartialType(CreateSettingDto) { }
