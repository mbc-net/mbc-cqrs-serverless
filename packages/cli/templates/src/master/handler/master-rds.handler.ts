import {
  CommandModel,
  IDataSyncHandler,
  removeSortKeyVersion,
} from '@mbc-cqrs-severless/core'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/prisma'

@Injectable()
export class MasterDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(MasterDataSyncRdsHandler.name)

  constructor(private readonly prismaService: PrismaService) {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
    const sk = removeSortKeyVersion(cmd.sk)
    await this.prismaService.master.upsert({
      where: {
        id: cmd.id,
      },
      update: {
        csk: cmd.sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        atttributesMaster: cmd.attributes?.master,
        isDeleted: cmd.isDeleted || false,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
      },
      create: {
        id: cmd.id,
        cpk: cmd.pk,
        csk: cmd.sk,
        pk: cmd.pk,
        sk,
        masterTypeCode: sk.substring(0, sk.indexOf('#')),
        masterCode: sk.substring(sk.indexOf('#') + 1),
        code: sk,
        name: cmd.name,
        version: cmd.version,
        tenantCode: cmd.tenantCode,
        seq: cmd.seq,
        atttributesMaster: cmd.attributes?.master,
        createdAt: cmd.createdAt,
        createdBy: cmd.createdBy,
        createdIp: cmd.createdIp,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
      },
    })
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
}
