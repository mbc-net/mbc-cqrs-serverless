import {
  DataEntity,
  DetailKey,
  DynamoDbService,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  masterPk,
  seqPk,
  toISOStringWithTimezone,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import {
  GenerateFormattedSequenceDto,
  GenSequenceDto,
  SequenceParamsDto,
} from './dto/gen-sequence.dto'
import { SequenceEntity } from './entities/sequence.entity'
import { RotateByEnum } from './enums/rotate-by.enum'
import { FiscalYearOptions } from './interfaces/fiscal-year.interface'
import { ISequenceService } from './interfaces/sequence-service.interface'
import { SequenceMasterDataProvider } from './sequence-master-factory'

@Injectable()
export class SequencesService implements ISequenceService {
  private readonly logger = new Logger(SequencesService.name)
  private readonly tableName: string

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly masterDataProvider: SequenceMasterDataProvider,
  ) {
    this.tableName = dynamoDbService.getTableName('sequences')
    this.logger.debug('tableName: ' + this.tableName)
  }

  /**
   * @deprecated This method is deprecated at V0.2.
   */
  async getCurrentSequence(key: DetailKey): Promise<DataEntity> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  /**
   * @deprecated This method is deprecated at V0.2.
   * Seq data structure
   * - pk: SEQ#tenantCode
   * - sk: typeCode#rotateValue ( e.x: `user#20230401` )
   * - code: typeCode#rotateValue
   * - name: rotateBy ( e.x: `daily` )
   * - tenant_code: tenantCode
   * - type: typeCode
   * - seq: sequence value ( atomic counter )
   */
  async genNewSequence(
    dto: GenSequenceDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<DataEntity> {
    const rotateVal = this.getRotateValue(dto.rotateBy, dto.date)
    const pk = `SEQ${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `${dto.typeCode}${KEY_SEPARATOR}${rotateVal}`

    const sourceIp =
      options?.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)
    const userId = userContext.userId || 'system'
    const now = new Date()
    const item = await this.dynamoDbService.updateItem(
      this.tableName,
      { pk, sk },
      {
        set: {
          code: sk,
          name: dto.rotateBy || 'none',
          tenantCode: dto.tenantCode,
          type: dto.typeCode,
          seq: { ifNotExists: 0, incrementBy: 1 },
          requestId: options.invokeContext?.context?.awsRequestId,
          createdAt: { ifNotExists: now },
          createdBy: { ifNotExists: userId },
          createdIp: { ifNotExists: sourceIp },
          updatedAt: now,
          updatedBy: userId,
          updatedIp: sourceIp,
        },
      },
    )

    return item
  }

  /**
   * Seq data structure
   * - pk: SEQ#tenantCode
   * - sk: typeCode#code1#code2#code3#code4#code5rotateValue ( e.x: `user#20230401` )
   * - code: typeCode#rotateValue
   * - name: rotateBy ( e.x: `daily` )
   * - tenant_code: tenantCode
   * - type: typeCode
   * - seq: sequence value ( atomic counter )
   *  - requestId: requestId
   * - createdAt: createdAt
   * - createdBy: createdBy
   * - createdIp: createdIp
   * - attributes: {
   *    formatted_no: formattedNo ( e.x: `2023-04-01-0001` )
   *    fiscal_year: fiscalYear
   *    issued_at: issuedAt
   * }
   */

  async generateSequenceItem(
    dto: GenerateFormattedSequenceDto,
    options?: { invokeContext: IInvoke },
  ): Promise<SequenceEntity> {
    const { date, rotateBy, tenantCode, params, typeCode } = dto

    const generalMasterPk = masterPk(tenantCode)
    const generalMasterSk = `SEQ${KEY_SEPARATOR}${typeCode}`
    this.logger.log('general master pk: ', generalMasterPk)
    this.logger.log('general master sk: ', generalMasterSk)
    const masterData = await this.masterDataProvider.getData({
      pk: generalMasterPk,
      sk: generalMasterSk,
    })
    // Get master data for the tenant
    const { format, registerDate, startMonth } = masterData
    const pk = seqPk(tenantCode)
    // Construct the sort key for the sequence
    let sk = [
      typeCode,
      params?.code1,
      params?.code2,
      params?.code3,
      params?.code4,
      params?.code5,
    ]
      .filter(Boolean)
      .join(KEY_SEPARATOR)

    const now = new Date()
    const issuedAt = toISOStringWithTimezone(date || now)
    const nowFiscalYear = this.getFiscalYear({
      now: date || now,
      registerTime: registerDate ? new Date(registerDate) : undefined,
      startMonth,
    })
    const sourceIp =
      options?.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = options ? getUserContext(options.invokeContext) : undefined
    const userId = userContext?.userId || 'system'

    const rotateVal = this.getRotateValue(rotateBy, date)
    sk = `${sk}${KEY_SEPARATOR}${rotateVal}`

    const item = await this.dynamoDbService.updateItem(
      this.tableName,
      { pk, sk },
      {
        set: {
          code: sk,
          name: dto.rotateBy || 'none',
          tenantCode: dto.tenantCode,
          type: typeCode,
          seq: { ifNotExists: 0, incrementBy: 1 },
          requestId: options?.invokeContext?.context?.awsRequestId,
          createdAt: { ifNotExists: now },
          createdBy: { ifNotExists: userId },
          createdIp: { ifNotExists: sourceIp },
          updatedAt: now,
          updatedBy: userId,
          updatedIp: sourceIp,
        },
      },
    )

    const formatDict = this.createFormatDict(
      nowFiscalYear,
      item.seq,
      date || now,
      { ...params },
    )
    const formattedNo = this.createFormattedNo(format, formatDict)
    return new SequenceEntity({
      id: generateId(item.pk, item.sk),
      no: item.seq,
      formattedNo: formattedNo,
      issuedAt: new Date(issuedAt),
    })
  }

  getRotateValue(rotateBy?: RotateByEnum, forDate?: Date) {
    const date = forDate || new Date()

    switch (rotateBy) {
      case RotateByEnum.FISCAL_YEARLY:
        const year = date.getFullYear()
        // new fiscal year from April
        return date.getMonth() < 3 ? (year - 1).toString() : year.toString()

      case RotateByEnum.YEARLY:
        return date.getFullYear().toString()

      case RotateByEnum.MONTHLY:
        return (
          date.getFullYear().toString() +
          (date.getMonth() + 1).toString().padStart(2, '0')
        )

      case RotateByEnum.DAILY:
        return (
          date.getFullYear().toString() +
          (date.getMonth() + 1).toString().padStart(2, '0') +
          date.getDate().toString().padStart(2, '0')
        )

      default:
        return RotateByEnum.NONE
    }
  }

  isIncrementNo(
    rotateBy: RotateByEnum | undefined,
    nowFiscalYear: number,
    fiscalYear: number,
    issuedAt: Date,
  ) {
    /**
     * Determine whether to increment the number (no)
     * based on rotateBy. If rotateBy matches the fiscal year, year, or month,
     * depending on the value, it will return true for incrementing.
     */

    // If rotateBy is not provided, increment
    if (!rotateBy) {
      return true
    }

    // Reset the number if fiscal year changes
    if (rotateBy === RotateByEnum.FISCAL_YEARLY) {
      if (nowFiscalYear === fiscalYear) {
        return true
      }
    }

    // Use the current date in Japan time (JST)
    const nowDate = new Date() // Assuming the server time is in JST

    // Reset the number if year changes
    if (rotateBy === RotateByEnum.YEARLY) {
      if (nowDate.getFullYear() === issuedAt.getFullYear()) {
        return true
      }
    }

    // Reset the number if month changes
    if (rotateBy === RotateByEnum.MONTHLY) {
      if (nowDate.getFullYear() === issuedAt.getFullYear()) {
        if (nowDate.getMonth() === issuedAt.getMonth()) {
          return true
        }
      }
    }

    return false
  }

  getFiscalYear(options: FiscalYearOptions): number {
    /**
     * Calculates the fiscal year based on the provided `now` and `registerTime`.
     *
     * - If `registerTime` is provided, the fiscal year will be calculated starting from
     *   the month of the registration date (`registerTime`).
     * - If `registerTime` is not provided, the fiscal year will start from the `startMonth` (default is April).
     *
     * The fiscal year calculation considers the following:
     * - The default start month is April (month 4).
     * - The reference year for the fiscal year calculation is 1953.
     */

    const { now, startMonth = 4, registerTime } = options


    const effectiveStartMonth = registerTime
      ? registerTime.getMonth() + 1
      : startMonth ?? 4
    const referenceYear = registerTime ? registerTime.getFullYear() : 1953 // Reference year

    // Determine the current fiscal year
    const fiscalYear =
      now.getMonth() + 1 < effectiveStartMonth
        ? now.getFullYear() - 1
        : now.getFullYear()

    // Return the fiscal year number starting from `referenceYear`
    return fiscalYear - referenceYear + 1
  }

  createFormatDict(
    fiscalYear: number,
    fixNo: number,
    now: Date,
    sequenceParams?: SequenceParamsDto,
  ) {
    return {
      ...sequenceParams,
      fiscal_year: fiscalYear,
      no: fixNo,
      month: now.getMonth() + 1,
      day: now.getDate(),
      date: now,
    }
  }

  createFormattedNo(format: string, formatDict: SequenceParamsDto) {
    let result = ''

    const words = format.split('%%')
    for (const word of words) {
      if (word.includes('#')) {
        const wordList = word.split('#')
        if (formatDict[wordList[0]]) {
          const key = wordList[0]
          const value: string = formatDict[key].toString()

          const paddingInfo = this.extractPaddingInfo(wordList[1])

          const paddingValue = value.padStart(
            paddingInfo.paddingNumber,
            paddingInfo.paddingValue,
          )

          result += paddingValue
        } else {
          result += word
        }
      } else {
        if (formatDict[word]) {
          result += formatDict[word].toString()
        } else {
          result += word
        }
      }
    }

    return result
  }

  extractPaddingInfo(str: string) {
    const regex = /:(\d)>(\d)/
    const match = str.match(regex)

    return {
      paddingValue: match[1],
      paddingNumber: parseInt(match[2], 10),
    }
  }
}
