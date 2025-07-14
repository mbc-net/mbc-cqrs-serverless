import {
  CommandModel,
  IDataSyncHandler,
  KEY_SEPARATOR,
  removeSortKeyVersion,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'
import { DATA_SK_PREFIX, SETTING_SK_PREFIX } from 'src/helpers/id'
import { PrismaService } from 'src/prisma'

import { MasterCommandEntity } from '../entity/master-command.entity'

@Injectable()
export class MasterDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(MasterDataSyncRdsHandler.name)

  constructor(private readonly prismaService: PrismaService) {}

  async up(cmd: MasterCommandEntity): Promise<any> {
    const sk = removeSortKeyVersion(cmd.sk)
    const skSplit = sk.split(KEY_SEPARATOR)

    const masterType =
      skSplit[0] === SETTING_SK_PREFIX ? SETTING_SK_PREFIX : DATA_SK_PREFIX
    const masterTypeCode = skSplit[0]
    await this.prismaService.master.upsert({
      where: {
        id: cmd.id,
      },
      update: {
        csk: cmd.sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
        isDeleted: cmd.isDeleted || false,

        attributes: cmd.attributes as object,
      },
      create: {
        id: cmd.id,
        cpk: cmd.pk,
        csk: cmd.sk,
        pk: cmd.pk,
        sk,
        masterType,
        masterTypeCode,
        masterCode: skSplit[1],
        tenantCode: cmd.tenantCode,
        code: sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        createdAt: cmd.createdAt,
        createdBy: cmd.createdBy,
        createdIp: cmd.createdIp,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
        isDeleted: cmd.isDeleted || false,

        attributes: cmd.attributes as object,
      },
    })
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
}
