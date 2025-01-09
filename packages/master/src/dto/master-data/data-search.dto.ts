import { IsOptional, IsString } from 'class-validator'

export class DataSettingSearchDto {
  @IsString()
  @IsOptional()
  settingCode?: string

  @IsString()
  @IsOptional()
  tenantCode?: string
}
