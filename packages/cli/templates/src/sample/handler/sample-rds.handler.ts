import {
  CommandModel,
  IDataSyncHandler,
  removeSortKeyVersion,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/prisma'

@Injectable()
export class SampleDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(SampleDataSyncRdsHandler.name)

  constructor(private readonly prismaService: PrismaService) {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
    const sk = removeSortKeyVersion(cmd.sk)
    await this.prismaService.sample.upsert({
      where: {
        id: cmd.id,
      },
      update: {
        csk: cmd.sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        attributes: cmd.attributes?.value,
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
        code: sk,
        name: cmd.name,
        version: cmd.version,
        tenantCode: cmd.tenantCode,
        seq: cmd.seq,
        attributes: cmd.attributes?.value,
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
