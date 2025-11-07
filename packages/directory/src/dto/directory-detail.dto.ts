import { IsEmail, IsString } from 'class-validator'

export class DirectoryDetailDto {
  @IsString()
  @IsEmail()
  email: string

  constructor(partial: Partial<DirectoryDetailDto>) {
    Object.assign(this, partial)
  }
}
