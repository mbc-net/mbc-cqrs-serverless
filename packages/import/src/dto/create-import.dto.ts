import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateImportDto {
  @IsString()
  tableName: string

  @IsString()
  tenantCode: string

  @IsString()
  @IsOptional()
  name?: string

  @IsObject()
  attributes: Record<string, any>
}
