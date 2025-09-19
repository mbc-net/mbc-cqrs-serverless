import { IsNotEmpty, IsString } from 'class-validator'

export class CreateZipImportDto {
  @IsString()
  @IsNotEmpty()
  bucket: string

  @IsString()
  @IsNotEmpty()
  key: string

  @IsString()
  @IsNotEmpty()
  tenantCode: string
}
