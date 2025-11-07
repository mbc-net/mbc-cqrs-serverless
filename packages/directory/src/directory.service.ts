import { CopyObjectCommand } from '@aws-sdk/client-s3'
import {
  CommandPartialInputModel,
  CommandService,
  DataService,
  DetailDto,
  generateId,
  getUserContext,
  IInvoke,
  S3Service,
  VER_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ulid } from 'ulid'

import {
  DirectoryAttributes,
  FilePermission,
  FileRole,
  PermissionDto,
} from './dto/directory-attributes.dto'
import { DirectoryCommandDto } from './dto/directory-command.dto'
import { DirectoryCopyDto } from './dto/directory-copy.dto'
import { DirectoryCreateDto } from './dto/directory-create.dto'
import { DirectoryDetailDto } from './dto/directory-detail.dto'
import { DirectoryMoveDto } from './dto/directory-move.dto'
import { DirectoryRenameDto } from './dto/directory-rename.dto'
import { DirectoryUpdateDto } from './dto/directory-update.dto'
import { DynamoService } from './dynamodb.service'
import { DirectoryDataEntity } from './entity/directory-data.entity'
import { DirectoryDataListEntity } from './entity/directory-data-list.entity'
import { parsePk } from './helpers'

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    private readonly s3Service: S3Service,
    private readonly customDynamoService: DynamoService,
  ) {}

  async create(
    createDto: DirectoryCreateDto,
    opts: { invokeContext: IInvoke },
  ) {
    const { tenantCode } = getUserContext(opts.invokeContext)
    const pk = `DIRECTORY${KEY_SEPARATOR}${tenantCode}`
    const sk = ulid()

    const attrs = createDto.attributes as DirectoryAttributes

    const parentId = attrs.parentId
    const ancestors = attrs.ancestors

    const isRoot = !parentId && ancestors.length === 0
    let newAncestors = []

    if (!isRoot) {
      const parenDto = { pk, sk: parentId }
      const allowPermissions = [
        FileRole.WRITE,
        FileRole.CHANGE_PERMISSION,
        FileRole.TAKE_OWNERSHIP,
      ]
      const user = { email: attrs.owner.email, tenant: tenantCode }

      const canWrite = await this.hasPermission(
        parenDto,
        allowPermissions,
        user,
      )

      if (!canWrite) {
        throw new ForbiddenException(
          'You do not have permission to create items in this folder.',
        )
      }

      const parentAttrs = await this.getItemAttributes(parenDto)
      const parentAncestors = parentAttrs.ancestors || []
      newAncestors = [...parentAncestors, parentId]
    }

    const directory = new DirectoryCommandDto({
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: sk,
      type: createDto.type,
      version: VERSION_FIRST,
      name: createDto.name,
      attributes: { ...createDto.attributes, ancestors: newAncestors },
    })
    const item = await this.commandService.publishAsync(directory, opts)

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async copy(
    detailDto: DetailDto,
    copyDto: DirectoryCopyDto,
    opts: { invokeContext: IInvoke },
  ) {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode, userId } = userContext
    const { path, email, parentId } = copyDto

    const data = (await this.dataService.getItem(
      detailDto,
    )) as DirectoryDataEntity

    if (!data) {
      throw new NotFoundException('Directory not found!')
    }

    const pk = `DIRECTORY${KEY_SEPARATOR}${tenantCode}`
    const sk = ulid()
    const attrs = data.attributes as DirectoryAttributes
    let newAncestors = []

    if (parentId) {
      const parenDto = { pk, sk: parentId }
      const parentAttrs = await this.getItemAttributes(parenDto)
      const parentAncestors = parentAttrs.ancestors || []
      newAncestors = [...parentAncestors, parentId]
    }

    const oldKey = data.attributes.s3Key
    const s3Key = `${path}/${data.name}`

    await this.s3Service.client.send(
      new CopyObjectCommand({
        Bucket: this.s3Service.privateBucket,
        CopySource: encodeURIComponent(
          `${this.s3Service.privateBucket}/${oldKey}`,
        ),
        Key: s3Key,
      }),
    )

    const directory = new DirectoryCommandDto({
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: sk,
      type: data.type,
      version: VERSION_FIRST,
      name: data.name,
      attributes: {
        ...attrs,
        s3Key: s3Key,
        ancestors: newAncestors,
        parentId: parentId,

        owner: { email: email, ownerId: userId },
      },
    })
    const item = await this.commandService.publishAsync(directory, opts)

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async move(
    detailDto: DetailDto,
    copyDto: DirectoryMoveDto,
    opts: { invokeContext: IInvoke },
  ) {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode } = userContext
    const { parentId } = copyDto

    const data = (await this.dataService.getItem(
      detailDto,
    )) as DirectoryDataEntity

    if (!data) {
      throw new NotFoundException('Directory not found!')
    }

    const allowPermissions = [
      FileRole.WRITE,
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]
    const itemDto = { pk: data.pk, sk: data.sk }
    const user = { email: copyDto.email, tenant: tenantCode }
    const canModify = await this.hasPermission(itemDto, allowPermissions, user)

    if (!canModify) {
      throw new ForbiddenException(
        'You do not have permission to modify this item.',
      )
    }

    const pk = `DIRECTORY${KEY_SEPARATOR}${tenantCode}`
    const sk = ulid()
    const attrs = data.attributes as DirectoryAttributes
    let newAncestors = []

    if (parentId) {
      const parenDto = { pk, sk: parentId }
      const parentAttrs = await this.getItemAttributes(parenDto)
      const parentAncestors = parentAttrs.ancestors || []
      newAncestors = [...parentAncestors, parentId]
    }

    if (newAncestors.includes(data.sk)) {
      throw new BadRequestException(
        'Cannot move a folder into one of its subfolders.',
      )
    }

    const directory = new DirectoryCommandDto({
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: sk,
      type: data.type,
      version: VERSION_FIRST,
      name: data.name,
      attributes: { ...attrs, ancestors: newAncestors, parentId: parentId },
    })
    const item = await this.commandService.publishAsync(directory, opts)

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async getItemAttributes(detailDto: DetailDto): Promise<DirectoryAttributes> {
    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Directory not found!')
    }
    this.logger.debug('item:', item)

    return item.attributes as DirectoryAttributes
  }

  async getItem(detailDto: DetailDto): Promise<DirectoryDataEntity> {
    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Directory not found!')
    }
    this.logger.debug('item:', item)

    return item as DirectoryDataEntity
  }

  async hasPermission(
    itemId: DetailDto,
    requiredRole: FileRole[],
    user?: { email?: string; tenant?: string },
  ): Promise<boolean> {
    const effectiveRole = await this.getEffectiveRole(itemId, user)
    if (!effectiveRole) {
      return false // No permission found
    }

    return requiredRole.includes(effectiveRole)
  }

  async getEffectiveRole(
    itemId: DetailDto,
    user?: { email?: string; tenant?: string },
  ): Promise<FileRole | null> {
    let attributes: DirectoryAttributes
    let item: DirectoryDataEntity
    try {
      item = await this.getItem(itemId)
      attributes = item.attributes as DirectoryAttributes
    } catch (e) {
      return null
    }

    const { permission, parentId, inheritance, expirationTime } = attributes

    if (permission) {
      const now = Date.now()
      const expirationDate = new Date(expirationTime)
      const expirationTimestamp = expirationDate.getTime()
      const isExpired = expirationTimestamp <= now
      if (isExpired) {
        return null
      }

      const role = this.checkPermissionObject(permission, item.tenantCode, user)
      if (role) {
        return role
      }
    }

    if (inheritance === false) {
      return null
    }

    if (!parentId) {
      return null
    }

    const parentDto = { pk: itemId.pk, sk: parentId }

    return this.getEffectiveRole(parentDto, user)
  }

  checkPermissionObject(
    permission: PermissionDto,
    tenantCode: string,
    user?: { email?: string; tenant?: string },
  ): FileRole | null {
    switch (permission.type) {
      case FilePermission.GENERAL:
        return permission.role

      case FilePermission.DOMAIN:
        const requiredDomain = permission.domain?.email
        const userDomain = user.email.split('@')[1]
        if (requiredDomain && userDomain === requiredDomain) {
          return permission.role
        }
        break

      case FilePermission.RESTRICTED:
        const permUser = permission.users.find(
          (item) => item.email === user.email,
        )
        if (permUser) {
          return permUser.role
        }
        break

      case FilePermission.TENANT:
        if (tenantCode === user.tenant) {
          return permission.role
        }
        break
    }

    return null
  }

  async findOne(
    detailDto: DetailDto,
    opts: { invokeContext: IInvoke },
    queryDto: DirectoryDetailDto,
  ): Promise<DirectoryDataEntity> {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode: tenant } = userContext

    const { email } = queryDto
    const allowPermissions = [
      FileRole.READ,
      FileRole.WRITE,
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]

    const user = { email: email, tenant: tenant }
    const canRead = await this.hasPermission(detailDto, allowPermissions, user)

    if (!canRead) {
      throw new ForbiddenException(
        'You do not have permission to read this item.',
      )
    }

    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Directory not found!')
    }
    this.logger.debug('item:', item)

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async findHistory(
    detailDto: DetailDto,
    opts: { invokeContext: IInvoke },
    queryDto: DirectoryDetailDto,
  ): Promise<DirectoryDataListEntity> {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode: tenant } = userContext

    const { email } = queryDto
    const allowPermissions = [
      FileRole.READ,
      FileRole.WRITE,
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]

    const user = { email: email, tenant: tenant }
    const canRead = await this.hasPermission(detailDto, allowPermissions, user)

    if (!canRead) {
      throw new ForbiddenException(
        'You do not have permission to read this item.',
      )
    }

    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Directory not found!')
    }

    this.logger.debug('item:', item)

    const query = {
      skExpession: 'begins_with(sk, :typeCode)',
      skAttributeValues: { ':typeCode': `${item.code}${VER_SEPARATOR}` },
    }

    const table = `${process.env.NODE_ENV}-${process.env.APP_NAME}-directory-history`
    const directoryHistories = await this.customDynamoService.listItemsByPk(
      table,
      item.pk,
      query,
    )

    const directoryHistory = directoryHistories.items?.sort(
      (a, b) => b.version - a.version,
    )
    const result = [item, ...directoryHistory]

    return new DirectoryDataListEntity({
      total: result.length,
      items: result.map(
        (item) => new DirectoryDataEntity(item as DirectoryDataEntity),
      ),
    })
  }

  async restoreHistoryItem(
    detailDto: DetailDto,
    version: string,
    queryDto: DirectoryDetailDto,
    opts: { invokeContext: IInvoke },
  ): Promise<DirectoryDataEntity> {
    const item = await this.commandService.getItem({
      pk: detailDto.pk,
      sk: `${detailDto.sk}${VER_SEPARATOR}${version}`,
    })
    if (!item) {
      throw new NotFoundException()
    }

    const latestItem = await this.dataService.getItem(detailDto)

    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode: tenant } = userContext
    const { email } = queryDto
    const allowPermissions = [
      FileRole.WRITE,
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]

    const user = { email: email, tenant: tenant }
    const canWrite = await this.hasPermission(detailDto, allowPermissions, user)

    if (!canWrite) {
      throw new ForbiddenException(
        'You do not have permission to write this item.',
      )
    }

    const cmdDto: DirectoryCommandDto = {
      pk: detailDto.pk,
      sk: detailDto.sk,
      version: latestItem.version,
      name: item.name,
      id: item.id,
      tenantCode: item.tenantCode,
      code: item.code,
      type: item.type,
      attributes: {
        ...item.attributes,
        owner: {
          email: item.attributes.owner.email,
          ownerId: item.attributes.owner.ownerId,
        },
      },
    }
    const command = await this.commandService.publishAsync(cmdDto, opts)

    return new DirectoryDataEntity(command as DirectoryDataEntity)
  }

  async restoreTemporary(
    detailDto: DetailDto,
    queryDto: DirectoryDetailDto,
    opts: { invokeContext: IInvoke },
  ): Promise<DirectoryDataEntity> {
    const data = (await this.dataService.getItem(
      detailDto,
    )) as DirectoryDataEntity

    if (!data) {
      throw new NotFoundException('Directory not found!')
    }

    if (!data.isDeleted) {
      throw new BadRequestException('Directory is not deleted!')
    }

    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode: tenant } = userContext

    const { email } = queryDto
    const allowPermissions = [
      FileRole.WRITE,
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]

    const user = {
      email: email,
      tenant: tenant,
    }

    const canWrite = await this.hasPermission(detailDto, allowPermissions, user)
    if (!canWrite) {
      throw new ForbiddenException(
        'You do not have permission to write this item.',
      )
    }

    const cmdDto = new DirectoryCommandDto({
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      name: data.name,
      isDeleted: false,
      attributes: {
        ...data.attributes,
      },
      code: data.code,
      tenantCode: data.tenantCode,
      type: data.type,
    })

    const item = await this.commandService.publishPartialUpdateAsync(
      cmdDto,
      opts,
    )

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async update(
    detailDto: DetailDto,
    updateDto: DirectoryUpdateDto,
    opts: { invokeContext: IInvoke },
  ): Promise<DirectoryDataEntity> {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode: tenant } = userContext

    const { tenantCode } = parsePk(detailDto.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    const data = (await this.dataService.getItem(
      detailDto,
    )) as DirectoryDataEntity

    if (!data) {
      throw new NotFoundException('Directory not found!')
    }

    const allowPermissions = [
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]

    if (!updateDto.attributes?.permission) {
      allowPermissions.push(FileRole.WRITE)
    }

    const itemDto = { pk: data.pk, sk: data.sk }
    const attrs = updateDto.attributes as DirectoryAttributes
    const user = { email: updateDto.email, tenant: tenant }
    const canModify = await this.hasPermission(itemDto, allowPermissions, user)

    if (!canModify) {
      throw new ForbiddenException(
        'You do not have permission to modify this item.',
      )
    }

    if (attrs && attrs.parentId !== data.attributes.parentId) {
      throw new BadRequestException(
        'Cannot change parentId with this API. Please use the /move endpoint.',
      )
    }

    const commandDto = new DirectoryCommandDto({
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      name: updateDto.name ?? data.name,
      isDeleted: updateDto.isDeleted ?? data.isDeleted,
      attributes: { ...data.attributes, ...attrs },
    })

    const item = await this.commandService.publishPartialUpdateAsync(
      commandDto,
      opts,
    )

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async rename(
    detailDto: DetailDto,
    updateDto: DirectoryRenameDto,
    opts: { invokeContext: IInvoke },
  ): Promise<DirectoryDataEntity> {
    const { tenantCode: tenant } = getUserContext(opts.invokeContext)

    const data = (await this.dataService.getItem(
      detailDto,
    )) as DirectoryDataEntity

    if (!data) {
      throw new NotFoundException('Directory not found!')
    }

    const allowPermissions = [
      FileRole.WRITE,
      FileRole.CHANGE_PERMISSION,
      FileRole.TAKE_OWNERSHIP,
    ]
    const itemDto = { pk: data.pk, sk: data.sk }
    const user = { email: updateDto.email, tenant: tenant }
    const canModify = await this.hasPermission(itemDto, allowPermissions, user)

    if (!canModify) {
      throw new ForbiddenException(
        'You do not have permission to modify this item.',
      )
    }

    const commandDto = new DirectoryCommandDto({
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      name: updateDto.name ?? data.name,
      attributes: { ...data.attributes },
    })

    const item = await this.commandService.publishPartialUpdateAsync(
      commandDto,
      opts,
    )

    return new DirectoryDataEntity(item as DirectoryDataEntity)
  }

  async remove(
    key: DetailDto,
    opts: { invokeContext: IInvoke },
    queryDto: DirectoryDetailDto,
  ) {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode: tenant } = userContext
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    const data = (await this.dataService.getItem(key)) as DirectoryDataEntity
    if (!data) {
      throw new NotFoundException()
    }

    const allowPermissions = [FileRole.DELETE, FileRole.TAKE_OWNERSHIP]
    const itemDto = { pk: data.pk, sk: data.sk }
    const user = { email: queryDto.email, tenant: tenant }
    const canModify = await this.hasPermission(itemDto, allowPermissions, user)

    if (!canModify) {
      throw new ForbiddenException(
        'You do not have permission to modify this item.',
      )
    }

    const commandDto: CommandPartialInputModel = {
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      isDeleted: true,
    }
    const item = await this.commandService.publishPartialUpdateAsync(
      commandDto,
      opts,
    )

    return new DirectoryDataEntity(item as any)
  }
}
