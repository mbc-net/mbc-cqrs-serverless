import { SearchDto } from '@mbc-cqrs-serverless/core'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class CustomMasterDataSearchDto extends SearchDto {
  @IsOptional()
  @IsString()
  settingCode?: string

  @IsOptional()
  @IsString()
  code?: string

  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  isDeleted?: boolean
}
