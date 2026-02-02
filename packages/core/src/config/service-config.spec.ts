import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { SNSClient } from '@aws-sdk/client-sns'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { TableType } from '../commands/enums'
import { DynamoDbService, S3Service } from '../data-store'
import { StepFunctionService } from '../step-func/step-function.service'
import { SnsClientFactory } from '../queue/sns-client-factory'

/**
 * Service Configuration Tests for Framework Users
 *
 * These tests demonstrate how environment variables affect service configuration
 * and help framework users understand the expected behavior in different scenarios:
 *
 * 1. Local development with explicit endpoints
 * 2. AWS deployment without explicit endpoints (using AWS SDK defaults)
 * 3. Mixed configurations with partial endpoint settings
 */
describe('Service Configuration - Environment Variables', () => {
  describe('DynamoDbService', () => {
    describe('With explicit endpoint configuration (Local Development)', () => {
      let service: DynamoDbService
      let s3Service: S3Service

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    NODE_ENV: 'local',
                    APP_NAME: 'test-app',
                    DYNAMODB_ENDPOINT: 'http://localhost:8000',
                    DYNAMODB_REGION: 'us-east-1',
                    ATTRIBUTE_LIMIT_SIZE: 400000,
                    S3_ENDPOINT: 'http://localhost:4566',
                    S3_REGION: 'us-east-1',
                    S3_BUCKET_NAME: 'test-bucket',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        service = module.get<DynamoDbService>(DynamoDbService)
        s3Service = module.get<S3Service>(S3Service)
      })

      it('should create DynamoDBClient with local endpoint', () => {
        expect(service.client).toBeDefined()
        expect(service.client).toBeInstanceOf(DynamoDBClient)
      })

      it('should create S3Client with local endpoint', () => {
        expect(s3Service.client).toBeDefined()
        expect(s3Service.client).toBeInstanceOf(S3Client)
      })

      it('should use configured bucket name', () => {
        expect(s3Service.privateBucket).toBe('test-bucket')
      })
    })

    describe('Without endpoint configuration (AWS Deployment)', () => {
      let service: DynamoDbService
      let s3Service: S3Service

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    NODE_ENV: 'prod',
                    APP_NAME: 'prod-app',
                    // No DYNAMODB_ENDPOINT - uses AWS default
                    DYNAMODB_REGION: 'ap-northeast-1',
                    ATTRIBUTE_LIMIT_SIZE: 400000,
                    // No S3_ENDPOINT - uses AWS default
                    S3_REGION: 'ap-northeast-1',
                    S3_BUCKET_NAME: 'prod-bucket',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        service = module.get<DynamoDbService>(DynamoDbService)
        s3Service = module.get<S3Service>(S3Service)
      })

      it('should create DynamoDBClient without explicit endpoint', () => {
        expect(service.client).toBeDefined()
        expect(service.client).toBeInstanceOf(DynamoDBClient)
      })

      it('should create S3Client without explicit endpoint', () => {
        expect(s3Service.client).toBeDefined()
        expect(s3Service.client).toBeInstanceOf(S3Client)
      })

      it('should use configured bucket name in production', () => {
        expect(s3Service.privateBucket).toBe('prod-bucket')
      })
    })

    describe('With only region configuration', () => {
      let service: DynamoDbService

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    NODE_ENV: 'dev',
                    APP_NAME: 'dev-app',
                    // No endpoint, only region
                    DYNAMODB_REGION: 'eu-west-1',
                    ATTRIBUTE_LIMIT_SIZE: 400000,
                    S3_BUCKET_NAME: 'dev-bucket',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        service = module.get<DynamoDbService>(DynamoDbService)
      })

      it('should create DynamoDBClient with only region', () => {
        expect(service.client).toBeDefined()
        expect(service.client).toBeInstanceOf(DynamoDBClient)
      })
    })

    describe('Table name generation', () => {
      let service: DynamoDbService

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    NODE_ENV: 'local',
                    APP_NAME: 'my-app',
                    ATTRIBUTE_LIMIT_SIZE: 400000,
                    S3_BUCKET_NAME: 'test-bucket',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        service = module.get<DynamoDbService>(DynamoDbService)
      })

      it('should generate table name with environment and app name prefix', () => {
        const tableName = service.getTableName('users')
        expect(tableName).toBe('local-my-app-users')
      })

      it('should generate table name with type suffix', () => {
        const tableName = service.getTableName('users', TableType.COMMAND)
        expect(tableName).toBe('local-my-app-users-command')
      })
    })
  })

  describe('StepFunctionService', () => {
    // Reset mock before tests
    beforeAll(() => {
      jest.resetModules()
    })

    describe('With explicit endpoint configuration (Local Development)', () => {
      let service: StepFunctionService

      beforeEach(async () => {
        // Mock the SFNClient
        jest.mock('@aws-sdk/client-sfn', () => ({
          SFNClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
          })),
          StartExecutionCommand: jest.fn(),
          SendTaskSuccessCommand: jest.fn(),
        }))

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            StepFunctionService,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    SFN_ENDPOINT: 'http://localhost:8083',
                    SFN_REGION: 'us-east-1',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        service = module.get<StepFunctionService>(StepFunctionService)
      })

      it('should create SFNClient with local endpoint', () => {
        expect(service).toBeDefined()
        expect(service.client).toBeDefined()
      })
    })

    describe('Without endpoint configuration (AWS Deployment)', () => {
      let service: StepFunctionService

      beforeEach(async () => {
        jest.mock('@aws-sdk/client-sfn', () => ({
          SFNClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
          })),
          StartExecutionCommand: jest.fn(),
          SendTaskSuccessCommand: jest.fn(),
        }))

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            StepFunctionService,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    // No SFN_ENDPOINT - uses AWS default
                    SFN_REGION: 'ap-northeast-1',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        service = module.get<StepFunctionService>(StepFunctionService)
      })

      it('should create SFNClient without explicit endpoint', () => {
        expect(service).toBeDefined()
        expect(service.client).toBeDefined()
      })
    })
  })

  describe('SnsClientFactory', () => {
    describe('With explicit endpoint configuration (Local Development)', () => {
      let factory: SnsClientFactory

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            SnsClientFactory,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    SNS_ENDPOINT: 'http://localhost:4566',
                    SNS_REGION: 'us-east-1',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        factory = module.get<SnsClientFactory>(SnsClientFactory)
      })

      it('should create SNSClient with local endpoint', () => {
        expect(factory).toBeDefined()
        const client = factory.getClient('arn:aws:sns:us-east-1:000000000000:test-topic')
        expect(client).toBeDefined()
        expect(client).toBeInstanceOf(SNSClient)
      })
    })

    describe('Without endpoint configuration (AWS Deployment)', () => {
      let factory: SnsClientFactory

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            SnsClientFactory,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => {
                  const config = {
                    // No SNS_ENDPOINT - uses AWS default
                    SNS_REGION: 'ap-northeast-1',
                  }
                  return config[key]
                }),
              }),
            },
          ],
        }).compile()

        factory = module.get<SnsClientFactory>(SnsClientFactory)
      })

      it('should create SNSClient without explicit endpoint', () => {
        expect(factory).toBeDefined()
        const client = factory.getClient('arn:aws:sns:ap-northeast-1:123456789012:prod-topic')
        expect(client).toBeDefined()
        expect(client).toBeInstanceOf(SNSClient)
      })
    })
  })

  describe('Environment-specific Configuration Scenarios', () => {
    describe('LocalStack configuration', () => {
      it('should accept LocalStack endpoints for all services', async () => {
        const localStackConfig = {
          NODE_ENV: 'local',
          APP_NAME: 'localstack-app',
          DYNAMODB_ENDPOINT: 'http://localhost:4566',
          DYNAMODB_REGION: 'us-east-1',
          ATTRIBUTE_LIMIT_SIZE: 400000,
          S3_ENDPOINT: 'http://localhost:4566',
          S3_REGION: 'us-east-1',
          S3_BUCKET_NAME: 'local-bucket',
          SFN_ENDPOINT: 'http://localhost:4566',
          SFN_REGION: 'us-east-1',
          SNS_ENDPOINT: 'http://localhost:4566',
          SNS_REGION: 'us-east-1',
        }

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            SnsClientFactory,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => localStackConfig[key]),
              }),
            },
          ],
        }).compile()

        const dynamoDb = module.get<DynamoDbService>(DynamoDbService)
        const s3 = module.get<S3Service>(S3Service)
        const sns = module.get<SnsClientFactory>(SnsClientFactory)

        expect(dynamoDb.client).toBeDefined()
        expect(s3.client).toBeDefined()
        expect(sns.getClient('arn:aws:sns:us-east-1:000000000000:test')).toBeDefined()
      })
    })

    describe('Docker Compose local services configuration', () => {
      it('should accept separate container endpoints', async () => {
        const dockerComposeConfig = {
          NODE_ENV: 'local',
          APP_NAME: 'docker-app',
          DYNAMODB_ENDPOINT: 'http://dynamodb-local:8000',
          DYNAMODB_REGION: 'us-east-1',
          ATTRIBUTE_LIMIT_SIZE: 400000,
          S3_ENDPOINT: 'http://minio:9000',
          S3_REGION: 'us-east-1',
          S3_BUCKET_NAME: 'docker-bucket',
          SFN_ENDPOINT: 'http://stepfunctions-local:8083',
          SFN_REGION: 'us-east-1',
          SNS_ENDPOINT: 'http://elasticmq:9324',
          SNS_REGION: 'us-east-1',
          SES_ENDPOINT: 'http://mailhog:8025',
          SES_REGION: 'us-east-1',
          SES_FROM_EMAIL: 'docker@localhost',
        }

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => dockerComposeConfig[key]),
              }),
            },
          ],
        }).compile()

        const dynamoDb = module.get<DynamoDbService>(DynamoDbService)
        const s3 = module.get<S3Service>(S3Service)

        expect(dynamoDb.client).toBeDefined()
        expect(s3.client).toBeDefined()
      })
    })

    describe('Hybrid configuration (some local, some AWS)', () => {
      it('should allow mixing local and AWS services', async () => {
        const hybridConfig = {
          NODE_ENV: 'dev',
          APP_NAME: 'hybrid-app',
          // DynamoDB uses local
          DYNAMODB_ENDPOINT: 'http://localhost:8000',
          DYNAMODB_REGION: 'us-east-1',
          ATTRIBUTE_LIMIT_SIZE: 400000,
          // S3 uses AWS (no endpoint)
          S3_REGION: 'ap-northeast-1',
          S3_BUCKET_NAME: 'aws-bucket',
          SES_FROM_EMAIL: 'test@example.com',
        }

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamoDbService,
            S3Service,
            {
              provide: ConfigService,
              useValue: createMock<ConfigService>({
                get: jest.fn((key: string) => hybridConfig[key]),
              }),
            },
          ],
        }).compile()

        const dynamoDb = module.get<DynamoDbService>(DynamoDbService)
        const s3 = module.get<S3Service>(S3Service)

        expect(dynamoDb.client).toBeDefined()
        expect(s3.client).toBeDefined()
      })
    })
  })
})
