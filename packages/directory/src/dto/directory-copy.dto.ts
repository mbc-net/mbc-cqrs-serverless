import { IsOptional, IsString } from 'class-validator'

export class DirectoryCopyDto {
  @IsString()
  path: string

  @IsString()
  @IsOptional()
  parentId?: string

  @IsString()
  email: string

  constructor(partial: Partial<DirectoryCopyDto>) {
    Object.assign(this, partial)
  }
}
