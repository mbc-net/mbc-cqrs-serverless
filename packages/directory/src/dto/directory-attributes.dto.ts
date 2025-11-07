import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

export enum FileRole {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  CHANGE_PERMISSION = 'CHANGE_PERMISSION',
  TAKE_OWNERSHIP = 'TAKE_OWNERSHIP',
}

export enum FilePermission {
  GENERAL = 'GENERAL',
  RESTRICTED = 'RESTRICTED',
  DOMAIN = 'DOMAIN',
  TENANT = 'TENANT',
}

export enum EmailType {
  EMAIL = 'EMAIL',
  EMAIL_GROUP = 'EMAIL_GROUP',
}

export class DomainDto {
  @IsString()
  email: string
}

export class OwnerDto {
  @IsEmail()
  @IsString()
  email: string

  @IsString()
  ownerId: string
}

export class UserPermissionDto {
  @IsEmail()
  @IsString()
  email: string

  @ApiProperty({
    description: 'Defines role user with folder or file',
    examples: [FileRole.WRITE],
    enum: FileRole,
    required: true,
  })
  @IsEnum(FileRole)
  role: FileRole

  @IsString()
  id: string

  @ApiProperty({
    description: 'Defines email type of user',
    examples: [EmailType.EMAIL_GROUP],
    enum: EmailType,
    required: true,
  })
  @IsEnum(EmailType)
  type: EmailType
}

export class PermissionDto {
  @ApiProperty({
    description: 'Defines permission type of folder or file',
    examples: [FilePermission.GENERAL],
    enum: FilePermission,
    required: true,
  })
  @IsEnum(FilePermission)
  type: FilePermission

  @ApiProperty({
    description: 'Defines role user with folder or file',
    examples: [FileRole.WRITE],
    enum: FileRole,
    required: true,
  })
  @IsEnum(FileRole)
  role: FileRole

  @ApiProperty({
    description: 'Permission for folder,file',
  })
  @Type(() => DomainDto)
  @ValidateNested()
  @IsOptional()
  domain?: DomainDto

  @ApiProperty({
    description: 'User permission restricted for folder,file',
  })
  @Type(() => UserPermissionDto)
  @ValidateNested()
  @IsOptional()
  users?: UserPermissionDto[]
}

export class DirectoryAttributes {
  @IsString()
  @IsOptional()
  expirationTime?: string

  @IsNumber()
  @IsOptional()
  fileSize?: number

  @IsString()
  @IsOptional()
  fileType?: string

  @IsString()
  @IsOptional()
  parentId?: string

  @Type(() => OwnerDto)
  @ValidateNested()
  owner: OwnerDto

  @IsString()
  @IsOptional()
  s3Key?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ancestors?: string[]

  @IsBoolean()
  @IsOptional()
  inheritance?: boolean

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]

  @ApiProperty({
    description: 'Permission for folder,file',
  })
  @Type(() => PermissionDto)
  @ValidateNested()
  @IsOptional()
  permission?: PermissionDto
}
