import {
  DataModel,
  DataService,
  DynamoDbService,
  EventHandler,
  extractInvokeContext,
  IEventHandler,
  IInvoke,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { RotateByEnum, SequencesService } from '@mbc-cqrs-serverless/sequence'
import { Inject, Logger } from '@nestjs/common'
import { chunk } from 'lodash'

import { DATA_SK_PREFIX } from '../constants'
import { CopyType, DataCopyMode, DataCopyOptionDto } from '../dto'
import {
  generateMasterPk,
  genSequenceSk,
  parseId,
  sequencePk,
} from '../helpers'
import { PRISMA_SERVICE } from '../master.module-definition'
import { MasterDataService, MasterSettingService } from '../services'
import { MasterSfnTaskEvent } from './master-sfn-task.event'

const BATCH_SIZE = 100

@EventHandler(MasterSfnTaskEvent)
export class MasterSfnTaskEventHandler
  implements IEventHandler<MasterSfnTaskEvent>
{
  private readonly logger = new Logger(MasterSfnTaskEventHandler.name)
  private sequenceTableName

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    @Inject(PRISMA_SERVICE)
    private readonly prismaService: any,
    private readonly masterSettingService: MasterSettingService,
    private readonly masterDataService: MasterDataService,
    private readonly dataService: DataService,
    private readonly sequencesService: SequencesService,
  ) {
    this.sequenceTableName = this.dynamoDbService.getTableName('sequences')
  }

  async execute(event: MasterSfnTaskEvent): Promise<any> {
    const invokeContext = extractInvokeContext()
    const masterCopyDto = event.input?.input

    this.logger.debug('sfn-event:masterCopyDto:', masterCopyDto)

    const { masterSettingId, targetTenants, copyType, dataCopyOption } =
      masterCopyDto
    const targetTenant = `${targetTenants[0]}`

    const setting = await this.fetchSetting(masterSettingId)
    const masterCode = this.getMasterCodeFromSetting(setting)
    if (copyType === CopyType.SETTING_ONLY || copyType === CopyType.BOTH) {
      await this.copySettingToTenant(setting, targetTenant, invokeContext)
    }

    if (copyType === CopyType.DATA_ONLY || copyType === CopyType.BOTH) {
      const isCopySequence = await this.shouldCopySequence(
        setting,
        targetTenant,
      )
      if (isCopySequence) {
        await this.copySeqToTenant(setting, targetTenant)
      }

      const dataToCopy = await this.fetchMasterData(masterCode, dataCopyOption)

      await this.copyDataToTenant(dataToCopy, targetTenant, invokeContext)
    }

    this.logger.debug('Completed copy process for tenant:', targetTenant)
    return { message: 'Copy successfully', event }
  }

  private async fetchSetting(id: string) {
    const setting = await this.dataService.getItem(parseId(id))
    this.logger.debug('sfn-event-setting', setting)
    return setting
  }

  private async fetchMasterData(
    masterCode: string,
    dataCopyOption?: DataCopyOptionDto,
    tenant: string = 'meltec',
  ): Promise<any[]> {
    const where: any = {
      masterType: DATA_SK_PREFIX,
      masterTypeCode: masterCode,
      pk: `MASTER${KEY_SEPARATOR}${tenant}`,
    }

    if (dataCopyOption?.mode === DataCopyMode.PARTIAL) {
      where.id = { in: dataCopyOption.id }
    }

    this.logger.debug('sfn-event-whereCondition', where)
    const data = await this.prismaService.master.findMany({ where })
    this.logger.debug('sfn-event-dataToCopy', data.length)
    return data
  }

  private async copySettingToTenant(
    setting: DataModel,
    tenantCode: string,
    invokeContext: IInvoke,
  ) {
    const sk = setting.sk
    const pk = generateMasterPk(tenantCode)
    const masterCode = this.getMasterCodeFromSetting(setting)

    const tenantSetting = await this.dataService.getItem({ pk, sk })

    this.logger.debug(
      'sfn-event-copySettingToTenant-tenantSetting',
      tenantSetting,
    )

    if (tenantSetting && tenantSetting.isDeleted === false) {
      this.logger.debug('sfn-event-copySettingToTenant-updateSetting', {
        pk,
        sk,
      })

      await this.masterSettingService.updateSetting(
        { pk, sk },
        {
          name: setting.name,
          code: masterCode,
          settingValue: setting.attributes as object,
          tenantCode,
        },
        {
          invokeContext,
        },
      )
    } else {
      this.logger.debug('sfn-event-copySettingToTenant-createTenantSetting', {
        pk,
        sk,
      })

      await this.masterSettingService.createTenantSetting(
        {
          name: setting.name,
          code: masterCode,
          settingValue: setting.attributes,
          tenantCode,
        },
        { invokeContext },
      )
    }
  }

  private async copyDataToTenant(
    dataToCopy,
    tenantCode: string,
    invokeContext: IInvoke,
  ) {
    const chunks = chunk(dataToCopy, BATCH_SIZE)
    for (const batch of chunks) {
      await Promise.all(
        batch.map(async (data: any) => {
          const parts = data.sk.split(KEY_SEPARATOR)
          const sk =
            parts.length > 1 && parts[1].trim() === ''
              ? `${data.sk}${data.masterCode}`
              : data.sk
          const pk = generateMasterPk(tenantCode)

          const tenantData = await this.dataService.getItem({ pk, sk })

          this.logger.debug('sfn-event-copyDataToTenant-tenantData', tenantData)

          // des tenant data is exist and not deleted => update des data same as src data
          if (tenantData && tenantData.isDeleted === false) {
            this.logger.debug('sfn-event-copyDataToTenant-update', { pk, sk })

            return this.masterDataService.update(
              { pk, sk },
              {
                name: data.name,
                attributes: data.attributes as object,
                isDeleted: data.isDeleted,
                seq: data.seq,
              },
              {
                invokeContext,
              },
            )
          }

          // src data is deleted => do nothing
          if (data.isDeleted === true) return

          // src data is exist => create des data
          return this.masterDataService.create(
            {
              code: data.masterCode,
              tenantCode,
              name: data.name,
              settingCode: data.masterTypeCode,
              attributes: data.attributes as object,
              seq: data.seq,
            },
            { invokeContext },
          )
        }),
      )
    }
  }

  private async shouldCopySequence(
    setting: DataModel,
    tenantCode: string,
  ): Promise<boolean> {
    const fields = setting?.attributes?.['fields'] || []
    const codeField = fields.find((f) => f.physicalName === 'code')
    if (codeField?.dataType !== 'auto_number') {
      this.logger.debug('Sequence not required: code field not auto_number')
      return false
    }

    const jcciSeqKey = this.generateSequenceKey(tenantCode, setting)
    const { seq: jcciSeq = 0 } =
      (await this.sequencesService.getCurrentSequence(jcciSeqKey)) ?? {}
    this.logger.debug('sfn-event-shouldCopySequence-jcciSeq', {
      jcciSeqKey,
      jcciSeq,
    })

    if (jcciSeq === 0) {
      this.logger.debug('Skipping sequence copy: JCCI sequence is 0')
      return false
    }

    const tenantSeqKey = this.generateSequenceKey(tenantCode, setting)
    const { seq: tenantSeq } =
      (await this.sequencesService.getCurrentSequence(tenantSeqKey)) ?? {}
    this.logger.debug('sfn-event-shouldCopySequence-tenantSeq', {
      tenantSeqKey,
      tenantSeq,
    })

    if (tenantSeq === undefined || tenantSeq === null) {
      this.logger.debug('Tenant sequence missing: copying sequence required')
      return true
    }

    if (jcciSeq > tenantSeq) {
      this.logger.debug('Tenant sequence is behind: copying required')
      return true
    }

    this.logger.debug('Tenant sequence is up to date or ahead: no copy needed')
    return false
  }

  private async copySeqToTenant(setting: DataModel, tenantCode: string) {
    const fields = setting?.attributes?.['fields'] || []
    const codeField = fields.find((f) => f.physicalName === 'code')
    const typeCode = codeField.formatCode ?? codeField.dataFormat

    const jcciSeqKey = this.generateSequenceKey(tenantCode, setting)
    const { seq: jcciSeq = 0 } =
      (await this.sequencesService.getCurrentSequence(jcciSeqKey)) ?? {}

    const tenantSeqKey = this.generateSequenceKey(tenantCode, setting)
    const { seq: tenantSeq = 0 } =
      (await this.sequencesService.getCurrentSequence(tenantSeqKey)) ?? {}

    const distance = jcciSeq - tenantSeq
    this.logger.debug('Copying sequence gap:', {
      jcciSeq,
      tenantSeq,
      distance,
    })

    this.logger.debug('putItem', {
      pk: tenantSeqKey.pk,
      sk: tenantSeqKey.sk,
      code: tenantSeqKey.sk,
      name: tenantSeqKey.sk.split(KEY_SEPARATOR).at(-1),
      seq: jcciSeq,
      tenantCode,
      type: typeCode,
    })

    this.logger.debug('this.sequenceTableName', this.sequenceTableName)

    await this.dynamoDbService.putItem(this.sequenceTableName, {
      pk: tenantSeqKey.pk,
      sk: tenantSeqKey.sk,
      code: tenantSeqKey.sk,
      name: tenantSeqKey.sk.split(KEY_SEPARATOR).at(-1),
      seq: jcciSeq,
      tenantCode,
      type: typeCode,
    })
  }

  private generateSequenceKey(tenantCode: string, setting: DataModel) {
    const fields = setting?.attributes?.['fields'] || []
    const codeField = fields.find((f) => f.physicalName === 'code')
    const seqSk = codeField.formatCode ?? codeField.dataFormat

    const pk = sequencePk(tenantCode)
    const masterCode = this.getMasterCodeFromSetting(setting)
    const sk = genSequenceSk(seqSk, masterCode, RotateByEnum.NONE)

    return { pk, sk }
  }

  private getMasterCodeFromSetting(setting: DataModel): string {
    const parts = setting.sk.split(KEY_SEPARATOR)
    return parts[1]
  }
}
