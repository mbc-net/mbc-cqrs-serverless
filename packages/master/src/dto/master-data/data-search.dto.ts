import { IsOptional, IsString } from 'class-validator'

export class MasterDataSearchDto {
  @IsString()
  settingCode: string

  @IsString()
  @IsOptional()
  tenantCode?: string
}
