import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

export class SettingAttrFields {
  @IsString()
  physicalName: string

  @IsString()
  name: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  dataType: string

  @IsString()
  @IsOptional()
  min?: string

  @IsString()
  @IsOptional()
  max?: string

  @IsString()
  @IsOptional()
  length?: string

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxRow?: number

  @IsString()
  @IsOptional()
  defaultValue?: string

  @IsBoolean()
  isRequired: boolean

  @IsBoolean()
  isShowedOnList: boolean

  @IsString()
  @IsOptional()
  dataFormat?: string

  constructor(attrs: Partial<SettingAttrFields>) {
    Object.assign(this, attrs)
  }
}

export class SettingAttributes {
  @IsString()
  description: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingAttrFields)
  fields: SettingAttrFields[]
}
