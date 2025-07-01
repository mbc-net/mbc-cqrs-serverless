import {
  DetailKey,
  extractInvokeContext,
  getAuthorizerClaims,
  HEADER_TENANT_CODE,
  IInvoke,
  KEY_SEPARATOR,
  UserContext,
} from '@mbc-cqrs-serverless/core'
import { TaskEntity, TaskService } from '@mbc-cqrs-serverless/task'
import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common'

@Injectable()
export class MyTaskService {
  constructor(private readonly taskService: TaskService) {}

  async getSfnTaskParentBySettingCode(
    masterSettingCode: string,
    invokeContext: IInvoke,
  ) {
    const userContext = this.getUserContext(invokeContext)
    if (!masterSettingCode) {
      throw new BadRequestException('Must provide master setting code')
    }
    const items = await this.listAllItemsByPk(
      userContext.tenantCode,
      'SFN_TASK',
      {
        sk: {
          skExpession: 'begins_with(sk, :code)',
          skAttributeValues: {
            ':code': `MASTER_COPY_${masterSettingCode}`,
          },
        },
        order: 'desc',
      },
    )

    return items.filter((item) => this.isParentTask(item.sk))
  }

  async getSfnChildTask(key: DetailKey) {
    return await this.taskService.getAllSubTask(key)
  }

  private async listAllItemsByPk(
    tenantCode: string,
    type: string,
    options?: {
      sk?: {
        skExpession: string
        skAttributeValues: Record<string, string>
        skAttributeNames?: Record<string, string>
      }
      order?: 'asc' | 'desc'
    },
  ): Promise<TaskEntity[]> {
    const allItems: TaskEntity[] = []
    let lastSk: string | undefined = undefined

    do {
      const result = await this.taskService.listItemsByPk(tenantCode, type, {
        ...options,
        startFromSk: lastSk,
      })

      allItems.push(...result.items)
      lastSk = result.lastSk
    } while (lastSk)

    return allItems
  }

  private isParentTask(sk: string) {
    return sk.split(KEY_SEPARATOR).length === 2
  }

  getUserContext = (ctx: IInvoke | ExecutionContext): UserContext => {
    if ('getHandler' in ctx) {
      ctx = extractInvokeContext(ctx)
    }
    const claims = getAuthorizerClaims(ctx)

    const userId = claims.sub
    const tenantCode =
      claims['custom:tenant_code'] ||
      (ctx?.event?.headers || {})[HEADER_TENANT_CODE]
    const tenantRole = claims['custom:user_type']
    return {
      userId,
      tenantRole,
      tenantCode,
    }
  }
}
