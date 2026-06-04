import { IsEmail, IsOptional, IsString } from 'class-validator'

export class DirectoryDetailDto {
  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string

  constructor(partial: Partial<DirectoryDetailDto>) {
    Object.assign(this, partial)
  }
}
