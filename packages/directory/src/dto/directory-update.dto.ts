import { PartialType, PickType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { DirectoryAttributes } from './directory-attributes.dto'

export class DirectoryUpdateAttributes extends PartialType(
  DirectoryAttributes,
) {}

export class DirectoryUpdateDto {
  @IsString()
  email: string

  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  isDeleted?: boolean

  @Type(() => DirectoryUpdateAttributes)
  @ValidateNested()
  @IsOptional()
  attributes?: DirectoryUpdateAttributes

  constructor(partial: Partial<DirectoryUpdateDto>) {
    Object.assign(this, partial)
  }
}

export class DirectoryUpdatePermissionAttributes extends PartialType(
  PickType(DirectoryAttributes, ['permission', 'inheritance']),
) {}

export class DirectoryUpdatePermissionDto {
  @IsString()
  email: string

  @Type(() => DirectoryUpdatePermissionAttributes)
  @ValidateNested()
  @IsOptional()
  attributes?: DirectoryUpdatePermissionAttributes

  constructor(partial: Partial<DirectoryUpdateDto>) {
    Object.assign(this, partial)
  }
}
