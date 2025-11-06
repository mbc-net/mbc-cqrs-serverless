import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class GenViewFileDto {
  @IsNotEmpty()
  @IsString()
  key: string

  @IsOptional()
  @IsString()
  filename?: string
}
