import { IsEmail, IsString } from 'class-validator'

export class DirectoryRenameDto {
  @IsString()
  name: string

  @IsString()
  @IsEmail()
  email: string

  constructor(partial: Partial<DirectoryRenameDto>) {
    Object.assign(this, partial)
  }
}
