import {
  CommandModel,
  IDataSyncHandler,
  removeSortKeyVersion,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/prisma'

import { <%= classify(name) %>Attributes } from '../dto/<%= dasherize(name) %>-attributes.dto'

@Injectable()
export class <%= classify(name) %>DataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(<%= classify(name) %>DataSyncRdsHandler.name)

  constructor(private readonly prismaService: PrismaService) {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
    const sk = removeSortKeyVersion(cmd.sk)
    const attrs = cmd.attributes as <%= classify(name) %>Attributes
    await this.prismaService.<%= camelize(name) %>.upsert({
      where: {
        id: cmd.id,
      },
      update: {
        csk: cmd.sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        isDeleted: cmd.isDeleted || false,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
        // attributes
        attributes: attrs.value,
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
        createdAt: cmd.createdAt,
        createdBy: cmd.createdBy,
        createdIp: cmd.createdIp,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
        // attributes
        attributes: attrs.value,
      },
    })
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
}
