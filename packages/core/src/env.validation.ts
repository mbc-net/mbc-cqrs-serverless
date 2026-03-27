import { Logger } from '@nestjs/common'
import { ClassConstructor, plainToInstance } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsNumber,
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

  @IsNumber()
  @IsOptional()
  APP_PORT: number

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

  @IsString()
  @IsOptional()
  REQUEST_BODY_SIZE_LIMIT: string
}

// Deprecated environment variable mappings: [oldName, newName]
const DEPRECATED_ENV_VARS: [string, string][] = [
  ['COGNITO_USER_POLL_CLIENT_ID', 'COGNITO_USER_POOL_CLIENT_ID'],
]

/**
 * Migrate deprecated environment variable names to their new names.
 * If the old name is set and the new name is not, the value is copied
 * to the new name and a deprecation warning is logged.
 */
function migrateDeprecatedEnvVars(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const logger = new Logger('EnvValidation')
  for (const [oldName, newName] of DEPRECATED_ENV_VARS) {
    if (config[oldName] !== undefined && config[newName] === undefined) {
      config[newName] = config[oldName]
      logger.warn(
        `Environment variable "${oldName}" is deprecated. ` +
          `Please use "${newName}" instead.`,
      )
    }
  }
  return config
}

export function getValidateConfig<T extends EnvironmentVariables>(
  cls?: ClassConstructor<T>,
) {
  return function validate(config: Record<string, unknown>) {
    const migratedConfig = migrateDeprecatedEnvVars(config)
    const validatedConfig = plainToInstance(
      cls || EnvironmentVariables,
      migratedConfig,
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
