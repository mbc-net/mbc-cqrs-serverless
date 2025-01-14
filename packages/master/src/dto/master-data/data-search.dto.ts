import { IsOptional, IsString } from 'class-validator'

export class MasterDataSearchDto {
  @IsString()
  @IsOptional()
  settingCode?: string

  @IsString()
  @IsOptional()
  tenantCode?: string
}
