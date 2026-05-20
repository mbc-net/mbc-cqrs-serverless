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

import { validateBuiltinNotificationTransportEnv } from './notification-env.validation'

export {
  BUILTIN_NOTIFICATION_TRANSPORT_ENV,
  parseNotificationTransports,
  validateBuiltinNotificationTransportEnv,
} from './notification-env.validation'

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

  /**
   * Comma-separated list of active notification transport names.
   * Supported built-in values: 'appsync-graphql' | 'appsync-event'
   * Defaults to 'appsync-graphql' when not set.
   *
   * Examples:
   *   NOTIFICATION_TRANSPORTS=appsync-graphql
   *   NOTIFICATION_TRANSPORTS=appsync-event
   *   NOTIFICATION_TRANSPORTS=appsync-graphql,appsync-event
   */
  @IsString()
  @IsOptional()
  NOTIFICATION_TRANSPORTS: string

  // AppSync GraphQL API (transport: appsync-graphql)
  @IsString()
  @IsOptional()
  APPSYNC_ENDPOINT: string

  // AppSync Events API (transport: appsync-event)
  @IsString()
  @IsOptional()
  APPSYNC_EVENTS_ENDPOINT: string

  /**
   * Channel namespace name — must match the pre-created namespace in the
   * AppSync Event API (segment 1 of every channel path).
   * Defaults to 'default'.
   */
  @IsString()
  @IsOptional()
  APPSYNC_EVENTS_NAMESPACE: string

  // ---------------------------------------------------------------------------

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

  @IsNumber()
  @IsOptional()
  RYW_SESSION_TTL_MINUTES: number
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

    validateBuiltinNotificationTransportEnv(
      validatedConfig as unknown as Record<string, unknown>,
    )

    return validatedConfig
  }
}
