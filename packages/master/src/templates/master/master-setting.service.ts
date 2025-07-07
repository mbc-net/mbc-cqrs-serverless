import { DataService, getUserContext, IInvoke } from '@mbc-cqrs-serverless/core'
import { DataCopyMode, MasterCopyDto } from '@mbc-cqrs-serverless/master'
import { TaskService } from '@mbc-cqrs-serverless/task'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import { MASTER_COPY_SK_PREFIX, parseId } from './helpers'

@Injectable()
export class CustomMasterSettingService {
  private readonly logger = new Logger(CustomMasterSettingService.name)

  constructor(
    private readonly dataService: DataService,
    private readonly taskService: TaskService,
  ) {}

  async copy(
    masterCopyDto: MasterCopyDto,
    opts: { invokeContext: IInvoke },
  ): Promise<any> {
    this.logger.debug('cmd:', JSON.stringify(masterCopyDto))

    const userContext = getUserContext(opts.invokeContext)

    const { masterSettingId, targetTenants, dataCopyOption } = masterCopyDto

    if (dataCopyOption?.mode === DataCopyMode.PARTIAL) {
      if (!dataCopyOption.id?.length) {
        throw new BadRequestException('Must provide ID when mode is PARTIAL.')
      }
    }

    const setting = await this.dataService.getItem(parseId(masterSettingId))

    if (!setting || setting.isDeleted) {
      throw new BadRequestException('Master setting does not exist')
    }

    const item = targetTenants.map((tenant) => ({
      ...masterCopyDto,
      targetTenants: [tenant],
    }))

    const taskItem = await this.taskService.createStepFunctionTask(
      {
        input: item,
        taskType: `${MASTER_COPY_SK_PREFIX}_${masterSettingId.split('#').at(-1)}`,
        tenantCode: userContext.tenantCode,
      },
      opts,
    )

    return taskItem
  }
}
