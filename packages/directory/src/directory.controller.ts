import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { DetailKeys } from '@mbc-cqrs-serverless/master'
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { DirectoryService } from './directory.service'
import { DirectoryFileService } from './directory-file.service'
import { DirectoryMoveDto } from './dto'
import { DirectoryCopyDto } from './dto/directory-copy.dto'
import { DirectoryCreateDto } from './dto/directory-create.dto'
import { DirectoryDetailDto } from './dto/directory-detail.dto'
import { DirectoryRenameDto } from './dto/directory-rename.dto'
import {
  DirectoryUpdateDto,
  DirectoryUpdatePermissionDto,
} from './dto/directory-update.dto'
import { GenUploadFileDto } from './dto/upload-file.dto'
import { GenViewFileDto } from './dto/view-file.dto'
import { DirectoryDataEntity } from './entity/directory-data.entity'
import { DirectoryDataListEntity } from './entity/directory-data-list.entity'
import { GenUploadEntity } from './entity/upload.entity'
import { GenViewEntity } from './entity/view.entity'

@Controller('api/directory')
@ApiTags('directory')
export class DirectoryController {
  private readonly logger = new Logger(DirectoryController.name)

  constructor(
    private readonly directoryService: DirectoryService,
    private readonly directoryFileService: DirectoryFileService,
  ) {}

  @Post('/')
  async create(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: DirectoryCreateDto,
  ): Promise<DirectoryDataEntity> {
    this.logger.debug('createDto:', createDto)
    return this.directoryService.create(createDto, { invokeContext })
  }

  @Get('/summary')
  async getTenantFileSizeSummary() {
    return this.directoryService.getTenantFileSizeSummary()
  }

  @Get('/:id')
  async findOne(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Query() queryDto: DirectoryDetailDto,
  ): Promise<DirectoryDataEntity> {
    return this.directoryService.findOne(detailDto, { invokeContext }, queryDto)
  }

  @Get('/:id/history')
  async findHistory(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Query() queryDto: DirectoryDetailDto,
  ): Promise<DirectoryDataListEntity> {
    return this.directoryService.findHistory(
      detailDto,
      { invokeContext },
      queryDto,
    )
  }

  @Post('/:id/history/:version/restore')
  async restore(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() queryDto: DirectoryDetailDto,
    @Param('version') version: string,
  ): Promise<DirectoryDataEntity> {
    return this.directoryService.restoreHistoryItem(
      detailDto,
      version,
      queryDto,
      { invokeContext },
    )
  }

  @Put('/:id/restore')
  async restoreTemporary(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() queryDto: DirectoryDetailDto,
  ): Promise<DirectoryDataEntity> {
    return this.directoryService.restoreTemporary(detailDto, queryDto, {
      invokeContext,
    })
  }

  @Patch('/:id')
  async update(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() updateDto: DirectoryUpdateDto,
  ) {
    this.logger.debug('updateDto:', updateDto)
    return this.directoryService.update(detailDto, updateDto, { invokeContext })
  }

  @Patch('/:id/permission')
  async updatePermission(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() updateDto: DirectoryUpdatePermissionDto,
  ) {
    this.logger.debug('updateDto:', updateDto)
    return this.directoryService.updatePermission(detailDto, updateDto, {
      invokeContext,
    })
  }

  @Patch('/:id/rename')
  async rename(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() updateDto: DirectoryRenameDto,
  ) {
    this.logger.debug('renameDto:', updateDto)
    return this.directoryService.rename(detailDto, updateDto, { invokeContext })
  }

  @Patch('/:id/copy')
  async copy(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() updateDto: DirectoryCopyDto,
  ) {
    this.logger.debug('copyDto:', updateDto)
    return this.directoryService.copy(detailDto, updateDto, { invokeContext })
  }

  @Patch('/:id/move')
  async move(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Body() updateDto: DirectoryMoveDto,
  ) {
    this.logger.debug('moveDto:', updateDto)
    return this.directoryService.move(detailDto, updateDto, { invokeContext })
  }

  @Delete('/:id')
  async remove(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Query() queryDto: DirectoryDetailDto,
  ) {
    return this.directoryService.remove(detailDto, { invokeContext }, queryDto)
  }

  @Delete('/:id/bin')
  async removeFile(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @DetailKeys() detailDto: DetailDto,
    @Query() queryDto: DirectoryDetailDto,
  ) {
    return this.directoryService.removeFile(
      detailDto,
      { invokeContext },
      queryDto,
    )
  }

  @Post('/file/view')
  async genViewUrl(@Body() dto: GenViewFileDto): Promise<GenViewEntity> {
    this.logger.debug('genViewUrl:', dto)
    return await this.directoryFileService.genViewUrl(dto.key, dto.filename)
  }

  @Post('/file')
  async genUploadDirectoryUrl(
    @Body() genUploadDto: GenUploadFileDto,
  ): Promise<GenUploadEntity> {
    this.logger.debug('genUploadDto:', genUploadDto)

    return await this.directoryFileService.genUploadDirectoryUrl(genUploadDto)
  }
}
