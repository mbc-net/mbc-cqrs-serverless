import { IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CreateCsvImportDto } from './dto/create-csv-import.dto'
import { CreateImportDto } from './dto/create-import.dto'
import { ImportService } from './import.service'

@ApiTags('Imports')
@Controller('imports')
export class ImportController {
  private readonly logger = new Logger(ImportController.name)

  constructor(private readonly importService: ImportService) {}

  /**
   * Endpoint for importing a single data record.
   * This is typically used for real-time or low-volume data synchronization.
   * The actual processing is asynchronous; this endpoint only validates the input
   * and queues the import task.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a single import',
    description:
      'Accepts a single data record, validates it using the configured ImportStrategy, and queues it for asynchronous processing.',
  })
  @ApiBody({ type: CreateImportDto })
  @ApiResponse({
    status: 202,
    description: 'The import task has been accepted and queued for processing.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createImport(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createImportDto: CreateImportDto,
  ) {
    this.logger.log(
      `Received single import request for table: ${createImportDto.tableName}`,
    )
    return this.importService.createWithApi(createImportDto, { invokeContext })
  }

  /**
   * Endpoint for initiating a CSV file import.
   * This endpoint accepts the location of a CSV file in S3 and allows the client
   * to specify the processing strategy ('DIRECT' for small files, 'STEP_FUNCTION' for large files).
   */
  @Post('csv')
  @ApiOperation({
    summary: 'Initiate a CSV file import',
    description:
      'Accepts the S3 location of a CSV file and an execution strategy. It will either process the file directly or trigger a Step Function workflow.',
  })
  @ApiBody({ type: CreateCsvImportDto })
  @ApiResponse({
    status: 200,
    description:
      'For DIRECT mode, returns the created import entities. For STEP_FUNCTION mode, returns the master job entity.',
  })
  @ApiResponse({
    status: 202,
    description:
      'The import task has been accepted and queued for processing (for STEP_FUNCTION mode).',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createCsvImport(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createCsvImportDto: CreateCsvImportDto,
  ) {
    this.logger.log(
      `Received CSV import request for key: ${createCsvImportDto.key} with processing mode: ${createCsvImportDto.processingMode}`,
    )
    // The service contains the routing logic to either process directly
    // or create the master job for the Step Function.
    return this.importService.handleCsvImport(createCsvImportDto, {
      invokeContext,
    })
  }
}
