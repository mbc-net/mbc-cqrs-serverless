import { IsString } from 'class-validator'

export class DataSettingSearchDto {
  @IsString()
  settingCode: string
}
