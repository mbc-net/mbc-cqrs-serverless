import { ClassConstructor, plainToInstance } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsPositive,
  IsString,
  validateSync,
} from 'class-validator'

export enum Environment {
  Local = 'local',
  Development = 'dev',
  Production = 'prod',
  Staging = 'stg',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment
  @IsString()
  APP_NAME: string

  @IsBoolean()
  EVENT_SOURCE_DISABLED: boolean

  @IsString()
  LOG_LEVEL: string

  @IsString()
  @IsOptional()
  DYNAMODB_ENDPOINT: string
  @IsOptional()
  @IsString()
  DYNAMODB_REGION: string
  @IsPositive()
  ATTRIBUTE_LIMIT_SIZE: number
  @IsString()
  @IsOptional()
  S3_ENDPOINT: string
  @IsString()
  @IsOptional()
  S3_REGION: string
  @IsString()
  S3_BUCKET_NAME: string

  @IsString()
  @IsOptional()
  SFN_ENDPOINT: string
  @IsString()
  @IsOptional()
  SFN_REGION: string
  @IsString()
  SFN_COMMAND_ARN: string

  @IsString()
  @IsOptional()
  SNS_ENDPOINT: string
  @IsString()
  @IsOptional()
  SNS_REGION: string

  @IsString()
  @IsOptional()
  APPSYNC_ENDPOINT: string

  @IsString()
  @IsOptional()
  SES_ENDPOINT: string
  @IsString()
  @IsOptional()
  SES_REGION: string
  @IsString()
  SES_FROM_EMAIL: string
}

export function getValidateConfig<T extends EnvironmentVariables>(
  cls?: ClassConstructor<T>,
) {
  return function validate(config: Record<string, unknown>) {
    const validatedConfig = plainToInstance(
      cls || EnvironmentVariables,
      config,
      {
        enableImplicitConversion: true,
      },
    )
    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false,
    })

    if (errors.length > 0) {
      throw new Error(errors.toString())
    }
    return validatedConfig
  }
}
