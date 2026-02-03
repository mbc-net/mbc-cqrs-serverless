/**
 * API Signature Contract Tests
 *
 * These tests verify that external packages export expected functions and classes.
 * When a package removes or renames an exported member, these tests will fail,
 * alerting us to potential breaking changes in the API surface.
 */

describe('API Signature Contracts', () => {
  describe('class-transformer', () => {
    it('should export plainToClass (legacy)', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.plainToClass).toBe('function')
    })

    it('should export plainToInstance (modern)', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.plainToInstance).toBe('function')
    })

    it('should export instanceToPlain', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.instanceToPlain).toBe('function')
    })

    it('should export classToPlain (legacy)', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.classToPlain).toBe('function')
    })

    it('should export Transform decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.Transform).toBe('function')
    })

    it('should export Expose decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.Expose).toBe('function')
    })

    it('should export Exclude decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.Exclude).toBe('function')
    })

    it('should export Type decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ct = require('class-transformer')
      expect(typeof ct.Type).toBe('function')
    })
  })

  describe('class-validator', () => {
    it('should export validate', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cv = require('class-validator')
      expect(typeof cv.validate).toBe('function')
    })

    it('should export validateSync', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cv = require('class-validator')
      expect(typeof cv.validateSync).toBe('function')
    })

    it('should export commonly used decorators', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cv = require('class-validator')
      expect(typeof cv.IsString).toBe('function')
      expect(typeof cv.IsNumber).toBe('function')
      expect(typeof cv.IsBoolean).toBe('function')
      expect(typeof cv.IsOptional).toBe('function')
      expect(typeof cv.IsEnum).toBe('function')
      expect(typeof cv.IsArray).toBe('function')
      expect(typeof cv.IsObject).toBe('function')
      expect(typeof cv.IsDate).toBe('function')
      expect(typeof cv.IsEmail).toBe('function')
      expect(typeof cv.IsNotEmpty).toBe('function')
      expect(typeof cv.MinLength).toBe('function')
      expect(typeof cv.MaxLength).toBe('function')
      expect(typeof cv.Min).toBe('function')
      expect(typeof cv.Max).toBe('function')
    })

    it('should export ValidateNested decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cv = require('class-validator')
      expect(typeof cv.ValidateNested).toBe('function')
    })
  })

  describe('@aws-sdk/util-dynamodb', () => {
    it('should export marshall', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dynamodb = require('@aws-sdk/util-dynamodb')
      expect(typeof dynamodb.marshall).toBe('function')
    })

    it('should export unmarshall', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dynamodb = require('@aws-sdk/util-dynamodb')
      expect(typeof dynamodb.unmarshall).toBe('function')
    })

    it('should export convertToAttr', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dynamodb = require('@aws-sdk/util-dynamodb')
      expect(typeof dynamodb.convertToAttr).toBe('function')
    })

    it('should export convertToNative', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dynamodb = require('@aws-sdk/util-dynamodb')
      expect(typeof dynamodb.convertToNative).toBe('function')
    })
  })

  describe('@nestjs/common', () => {
    it('should export core decorators', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.Controller).toBe('function')
      expect(typeof nestjs.Get).toBe('function')
      expect(typeof nestjs.Post).toBe('function')
      expect(typeof nestjs.Put).toBe('function')
      expect(typeof nestjs.Delete).toBe('function')
      expect(typeof nestjs.Patch).toBe('function')
      expect(typeof nestjs.Injectable).toBe('function')
      expect(typeof nestjs.Module).toBe('function')
      expect(typeof nestjs.Inject).toBe('function')
    })

    it('should export exception classes', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.BadRequestException).toBe('function')
      expect(typeof nestjs.UnauthorizedException).toBe('function')
      expect(typeof nestjs.ForbiddenException).toBe('function')
      expect(typeof nestjs.NotFoundException).toBe('function')
      expect(typeof nestjs.InternalServerErrorException).toBe('function')
      expect(typeof nestjs.HttpException).toBe('function')
    })

    it('should export UseGuards decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.UseGuards).toBe('function')
    })

    it('should export UseInterceptors decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.UseInterceptors).toBe('function')
    })

    it('should export UsePipes decorator', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.UsePipes).toBe('function')
    })

    it('should export parameter decorators', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.Body).toBe('function')
      expect(typeof nestjs.Param).toBe('function')
      expect(typeof nestjs.Query).toBe('function')
      expect(typeof nestjs.Headers).toBe('function')
    })

    it('should export Logger class', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nestjs = require('@nestjs/common')
      expect(typeof nestjs.Logger).toBe('function')
    })
  })

  describe('rxjs', () => {
    it('should export Observable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rxjs = require('rxjs')
      expect(typeof rxjs.Observable).toBe('function')
    })

    it('should export common operators from rxjs/operators or rxjs', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rxjs = require('rxjs')
      expect(typeof rxjs.map).toBe('function')
      expect(typeof rxjs.filter).toBe('function')
      expect(typeof rxjs.mergeMap).toBe('function')
      expect(typeof rxjs.catchError).toBe('function')
      expect(typeof rxjs.tap).toBe('function')
    })

    it('should export Subject', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rxjs = require('rxjs')
      expect(typeof rxjs.Subject).toBe('function')
    })

    it('should export BehaviorSubject', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rxjs = require('rxjs')
      expect(typeof rxjs.BehaviorSubject).toBe('function')
    })

    it('should export firstValueFrom', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rxjs = require('rxjs')
      expect(typeof rxjs.firstValueFrom).toBe('function')
    })

    it('should export lastValueFrom', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rxjs = require('rxjs')
      expect(typeof rxjs.lastValueFrom).toBe('function')
    })
  })
})
