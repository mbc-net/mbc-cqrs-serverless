import { IsString } from 'class-validator'

export class GenUploadFileDto {
  @IsString()
  filename: string

  @IsString()
  tenant: string

  @IsString()
  path: string
}
