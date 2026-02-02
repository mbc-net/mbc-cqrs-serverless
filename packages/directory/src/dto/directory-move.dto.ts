import { IsEmail, IsOptional, IsString } from 'class-validator'

export class DirectoryMoveDto {
  @IsString()
  @IsOptional()
  parentId?: string

  @IsString()
  @IsEmail()
  email: string

  constructor(partial: Partial<DirectoryMoveDto>) {
    Object.assign(this, partial)
  }
}
