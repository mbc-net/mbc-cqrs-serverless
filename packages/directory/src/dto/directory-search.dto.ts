import { SearchDto } from '@mbc-cqrs-serverless/core'
import { IsOptional, IsString } from 'class-validator'

export class DirectorySearchDto extends SearchDto {
  @IsOptional()
  @IsString()
  ownerId?: string

  @IsOptional()
  @IsString()
  parentId?: string

  constructor(partial: Partial<DirectorySearchDto>) {
    super(partial)
    Object.assign(this, partial)
  }
}
