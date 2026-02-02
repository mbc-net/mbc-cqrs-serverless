/**
 * @nestjs/swagger Behavioral Tests
 *
 * These tests verify that @nestjs/swagger behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * @nestjs/swagger is used for generating OpenAPI documentation
 * for the REST API endpoints.
 */

import 'reflect-metadata'

import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiTags,
  DocumentBuilder,
  getSchemaPath,
  PickType,
  OmitType,
  PartialType,
  IntersectionType,
} from '@nestjs/swagger'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

describe('@nestjs/swagger Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export decorator functions', () => {
      expect(typeof ApiProperty).toBe('function')
      expect(typeof ApiPropertyOptional).toBe('function')
      expect(typeof ApiOperation).toBe('function')
      expect(typeof ApiResponse).toBe('function')
      expect(typeof ApiTags).toBe('function')
      expect(typeof ApiParam).toBe('function')
      expect(typeof ApiQuery).toBe('function')
      expect(typeof ApiBody).toBe('function')
      expect(typeof ApiHeader).toBe('function')
    })

    it('should export DocumentBuilder class', () => {
      expect(DocumentBuilder).toBeDefined()
      expect(typeof DocumentBuilder).toBe('function')
    })

    it('should export type helper functions', () => {
      expect(typeof PickType).toBe('function')
      expect(typeof OmitType).toBe('function')
      expect(typeof PartialType).toBe('function')
      expect(typeof IntersectionType).toBe('function')
    })

    it('should export getSchemaPath helper', () => {
      expect(typeof getSchemaPath).toBe('function')
    })
  })

  describe('@ApiProperty decorator', () => {
    it('should store metadata on class property', () => {
      class TestDto {
        @ApiProperty({ description: 'User ID', example: '123' })
        id: string

        @ApiProperty({ description: 'User name', minLength: 1, maxLength: 100 })
        name: string
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'id',
      )

      expect(metadata).toBeDefined()
      expect(metadata.description).toBe('User ID')
      expect(metadata.example).toBe('123')
    })

    it('should support type specification', () => {
      class TestDto {
        @ApiProperty({ type: String })
        stringField: string

        @ApiProperty({ type: Number })
        numberField: number

        @ApiProperty({ type: Boolean })
        boolField: boolean
      }

      const stringMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'stringField',
      )
      const numberMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'numberField',
      )
      const boolMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'boolField',
      )

      expect(stringMeta.type).toBe(String)
      expect(numberMeta.type).toBe(Number)
      expect(boolMeta.type).toBe(Boolean)
    })

    it('should support array types', () => {
      class TestDto {
        @ApiProperty({ type: [String] })
        tags: string[]

        @ApiProperty({ type: 'array', items: { type: 'number' } })
        scores: number[]
      }

      const tagsMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'tags',
      )

      // Note: @nestjs/swagger may normalize array type to just the type constructor
      expect(tagsMeta.type).toBeDefined()
      expect(tagsMeta.isArray || Array.isArray(tagsMeta.type)).toBe(true)
    })

    it('should support enum values', () => {
      enum Status {
        ACTIVE = 'active',
        INACTIVE = 'inactive',
      }

      class TestDto {
        @ApiProperty({ enum: Status, enumName: 'Status' })
        status: Status
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'status',
      )

      // Enum metadata may be stored as the enum object or as an array of values
      expect(metadata.enum).toBeDefined()
      expect(metadata.enumName).toBe('Status')
    })

    it('should support required and nullable options', () => {
      class TestDto {
        @ApiProperty({ required: true })
        requiredField: string

        @ApiProperty({ required: false, nullable: true })
        optionalField?: string | null
      }

      const requiredMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'requiredField',
      )
      const optionalMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'optionalField',
      )

      expect(requiredMeta.required).toBe(true)
      expect(optionalMeta.required).toBe(false)
      expect(optionalMeta.nullable).toBe(true)
    })
  })

  describe('@ApiPropertyOptional decorator', () => {
    it('should mark property as optional', () => {
      class TestDto {
        @ApiPropertyOptional({ description: 'Optional field' })
        optionalField?: string
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        TestDto.prototype,
        'optionalField',
      )

      expect(metadata.required).toBe(false)
    })
  })

  describe('@ApiOperation decorator', () => {
    it('should store operation metadata', () => {
      class TestController {
        @ApiOperation({
          summary: 'Get user',
          description: 'Retrieve user by ID',
        })
        getUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_OPERATION,
        TestController.prototype.getUser,
      )

      expect(metadata).toBeDefined()
      expect(metadata.summary).toBe('Get user')
      expect(metadata.description).toBe('Retrieve user by ID')
    })

    it('should support operationId', () => {
      class TestController {
        @ApiOperation({ operationId: 'getUserById' })
        getUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_OPERATION,
        TestController.prototype.getUser,
      )

      expect(metadata.operationId).toBe('getUserById')
    })

    it('should support deprecated flag', () => {
      class TestController {
        @ApiOperation({ deprecated: true })
        oldMethod() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_OPERATION,
        TestController.prototype.oldMethod,
      )

      expect(metadata.deprecated).toBe(true)
    })
  })

  describe('@ApiResponse decorator', () => {
    it('should store response metadata', () => {
      class UserDto {
        id: string
        name: string
      }

      class TestController {
        @ApiResponse({ status: 200, description: 'Success', type: UserDto })
        getUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_RESPONSE,
        TestController.prototype.getUser,
      )

      expect(metadata).toBeDefined()
      // Response metadata is stored as an object with status code as key
      expect(metadata['200']).toBeDefined()
      expect(metadata['200'].description).toBe('Success')
    })

    it('should support multiple response codes', () => {
      class TestController {
        @ApiResponse({ status: 200, description: 'Success' })
        @ApiResponse({ status: 404, description: 'Not found' })
        @ApiResponse({ status: 500, description: 'Server error' })
        getUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_RESPONSE,
        TestController.prototype.getUser,
      )

      expect(metadata['200']).toBeDefined()
      expect(metadata['404']).toBeDefined()
      expect(metadata['500']).toBeDefined()
    })
  })

  describe('@ApiTags decorator', () => {
    it('should store tag metadata on controller', () => {
      @ApiTags('users', 'management')
      class UsersController {}

      const metadata = Reflect.getMetadata(DECORATORS.API_TAGS, UsersController)

      expect(metadata).toEqual(['users', 'management'])
    })
  })

  describe('@ApiParam decorator', () => {
    it('should store parameter metadata', () => {
      class TestController {
        @ApiParam({ name: 'id', description: 'User ID', type: String })
        getUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        TestController.prototype.getUser,
      )

      expect(metadata).toBeDefined()
      expect(Array.isArray(metadata)).toBe(true)
      expect(metadata.some((p: any) => p.name === 'id')).toBe(true)
    })

    it('should support required parameter', () => {
      class TestController {
        @ApiParam({ name: 'id', required: true })
        getUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        TestController.prototype.getUser,
      )

      const idParam = metadata.find((p: any) => p.name === 'id')
      expect(idParam.required).toBe(true)
    })
  })

  describe('@ApiQuery decorator', () => {
    it('should store query parameter metadata', () => {
      class TestController {
        @ApiQuery({ name: 'page', type: Number, required: false })
        @ApiQuery({ name: 'limit', type: Number, required: false })
        listUsers() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        TestController.prototype.listUsers,
      )

      expect(metadata).toBeDefined()
      expect(metadata.some((p: any) => p.name === 'page')).toBe(true)
      expect(metadata.some((p: any) => p.name === 'limit')).toBe(true)
    })

    it('should support enum query parameters', () => {
      enum SortOrder {
        ASC = 'asc',
        DESC = 'desc',
      }

      class TestController {
        @ApiQuery({ name: 'sort', enum: SortOrder })
        listUsers() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        TestController.prototype.listUsers,
      )

      expect(metadata).toBeDefined()
      expect(Array.isArray(metadata)).toBe(true)
      const sortParam = metadata.find((p: any) => p.name === 'sort')
      expect(sortParam).toBeDefined()
      // The enum may be stored as 'enum' or 'schema.enum' depending on version
      expect(sortParam.enum || sortParam.schema?.enum).toBeDefined()
    })
  })

  describe('@ApiBody decorator', () => {
    it('should store body metadata', () => {
      class CreateUserDto {
        name: string
        email: string
      }

      class TestController {
        @ApiBody({ type: CreateUserDto, description: 'User data' })
        createUser() {}
      }

      const metadata = Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        TestController.prototype.createUser,
      )

      expect(metadata).toBeDefined()
      const bodyParam = metadata.find((p: any) => p.in === 'body')
      expect(bodyParam).toBeDefined()
    })
  })

  describe('@ApiHeader decorator', () => {
    it('should store header metadata', () => {
      class TestController {
        @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant identifier' })
        getData() {}
      }

      // Check for header metadata - may be stored differently in different versions
      const headersMetadata = Reflect.getMetadata(
        DECORATORS.API_HEADERS,
        TestController.prototype.getData,
      )
      const parametersMetadata = Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        TestController.prototype.getData,
      )

      // Headers might be stored in API_HEADERS or API_PARAMETERS depending on version
      const metadata = headersMetadata || parametersMetadata

      expect(metadata).toBeDefined()
      expect(Array.isArray(metadata)).toBe(true)
      expect(
        metadata.some(
          (h: any) => h.name === 'X-Tenant-ID' || h.in === 'header',
        ),
      ).toBe(true)
    })
  })

  describe('DocumentBuilder', () => {
    it('should create document configuration', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setDescription('API Description')
        .setVersion('1.0')
        .build()

      expect(config.info.title).toBe('Test API')
      expect(config.info.description).toBe('API Description')
      expect(config.info.version).toBe('1.0')
    })

    it('should add tags', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .addTag('users', 'User operations')
        .addTag('products', 'Product operations')
        .build()

      expect(config.tags).toEqual([
        { name: 'users', description: 'User operations' },
        { name: 'products', description: 'Product operations' },
      ])
    })

    it('should add bearer auth', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .addBearerAuth()
        .build()

      expect(config.components?.securitySchemes).toBeDefined()
      expect(config.components?.securitySchemes?.bearer).toBeDefined()
    })

    it('should add API key auth', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .addApiKey({ type: 'apiKey', name: 'X-API-KEY', in: 'header' })
        .build()

      expect(config.components?.securitySchemes).toBeDefined()
    })

    it('should add server configuration', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .addServer('https://api.example.com', 'Production')
        .addServer('https://staging.example.com', 'Staging')
        .build()

      expect(config.servers).toHaveLength(2)
      expect(config.servers?.[0].url).toBe('https://api.example.com')
      expect(config.servers?.[0].description).toBe('Production')
    })

    it('should set contact information', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .setContact(
          'Support',
          'https://support.example.com',
          'support@example.com',
        )
        .build()

      expect(config.info.contact?.name).toBe('Support')
      expect(config.info.contact?.url).toBe('https://support.example.com')
      expect(config.info.contact?.email).toBe('support@example.com')
    })

    it('should set license', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .setLicense('MIT', 'https://opensource.org/licenses/MIT')
        .build()

      expect(config.info.license?.name).toBe('MIT')
      expect(config.info.license?.url).toBe(
        'https://opensource.org/licenses/MIT',
      )
    })

    it('should set external documentation', () => {
      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0')
        .setExternalDoc('Full documentation', 'https://docs.example.com')
        .build()

      expect(config.externalDocs?.description).toBe('Full documentation')
      expect(config.externalDocs?.url).toBe('https://docs.example.com')
    })
  })

  describe('Type helpers', () => {
    class BaseDto {
      @ApiProperty()
      id: string

      @ApiProperty()
      name: string

      @ApiProperty()
      email: string

      @ApiProperty()
      createdAt: Date
    }

    it('should create PickType class with selected properties', () => {
      class PickedDto extends PickType(BaseDto, ['id', 'name'] as const) {}

      // The picked class should have metadata only for selected properties
      const idMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        PickedDto.prototype,
        'id',
      )
      const nameMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        PickedDto.prototype,
        'name',
      )

      expect(idMeta).toBeDefined()
      expect(nameMeta).toBeDefined()
    })

    it('should create OmitType class without specified properties', () => {
      class OmittedDto extends OmitType(BaseDto, ['createdAt'] as const) {}

      const idMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        OmittedDto.prototype,
        'id',
      )

      expect(idMeta).toBeDefined()
    })

    it('should create PartialType class with all optional properties', () => {
      class PartialDto extends PartialType(BaseDto) {}

      const idMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        PartialDto.prototype,
        'id',
      )

      // In PartialType, properties should be marked as not required
      expect(idMeta).toBeDefined()
      expect(idMeta.required).toBe(false)
    })

    it('should create IntersectionType combining multiple DTOs', () => {
      class AdditionalDto {
        @ApiProperty()
        extra: string
      }

      class CombinedDto extends IntersectionType(BaseDto, AdditionalDto) {}

      const idMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        CombinedDto.prototype,
        'id',
      )
      const extraMeta = Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        CombinedDto.prototype,
        'extra',
      )

      expect(idMeta).toBeDefined()
      expect(extraMeta).toBeDefined()
    })
  })

  describe('getSchemaPath helper', () => {
    it('should generate schema path for class', () => {
      class TestDto {
        id: string
      }

      const schemaPath = getSchemaPath(TestDto)

      expect(schemaPath).toBe('#/components/schemas/TestDto')
    })

    it('should generate schema path for named class', () => {
      class MyCustomResponse {
        data: any
      }

      const schemaPath = getSchemaPath(MyCustomResponse)

      expect(schemaPath).toBe('#/components/schemas/MyCustomResponse')
    })
  })
})
