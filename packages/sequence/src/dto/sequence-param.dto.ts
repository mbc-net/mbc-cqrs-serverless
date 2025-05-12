import { IsOptional, IsString } from 'class-validator'

export class SequenceParamsDto {
  //code1#code2#code3#code4#code5

  @IsString()
  code1: string

  @IsString()
  @IsOptional()
  code2?: string

  @IsOptional()
  @IsString()
  code3?: string

  @IsOptional()
  @IsString()
  code4?: string

  @IsOptional()
  @IsString()
  code5?: string

  constructor(partial: Partial<SequenceParamsDto>) {
    Object.assign(this, partial)
  }
}
