import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateTaskDto {
  @IsString()
  tenantCode: string

  @IsString()
  taskType: string

  @IsString()
  @IsOptional()
  name?: string

  @IsObject()
  input: Record<string, any>
}
