import {
  DataEntity,
  DetailKey,
  DynamoDbService,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  toISOStringWithTimezone,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { GenSequenceDto, SequenceParamsDto } from './dto/gen-sequence.dto'
import { RotateByEnum } from './enums/rotate-by.enum'
import { ISequenceService } from './interfaces/sequence-service.interface'

@Injectable()
export class SequencesService implements ISequenceService {
  private readonly logger = new Logger(SequencesService.name)
  private readonly tableName: string

  constructor(private readonly dynamoDbService: DynamoDbService) {
    this.tableName = dynamoDbService.getTableName('sequences')
    this.logger.debug('tableName: ' + this.tableName)
  }

  async getCurrentSequence(key: DetailKey): Promise<DataEntity> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  /**
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
    opts: { invokeContext: IInvoke },
  ): Promise<DataEntity> {
    const {
      date,
      rotateBy,
      format = '%%no%%',
      tenantCode,
      params,
      registerDate,
    } = dto
    const pk = `SEQ${KEY_SEPARATOR}${tenantCode}`
    let sk = [
      params.code1,
      params.code2,
      params.code3,
      params.code4,
      params.code5,
    ]
      .filter(Boolean)
      .join(KEY_SEPARATOR)

    const now = new Date()
    const issuedAt = toISOStringWithTimezone(date || now)
    const nowFiscalYear = this.getFiscalYear(date || now, registerDate)
    const sourceIp = opts.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(opts.invokeContext)
    const userId = userContext.userId || 'system'

    // Helper function for building the update data
    const buildUpdateData = (seq: number, formattedNo: string, sk: string) => ({
      set: {
        code: sk,
        name: rotateBy || 'none',
        tenantCode,
        type: params.code1,
        seq,
        requestId: opts.invokeContext?.context?.awsRequestId,
        createdAt: { ifNotExists: now },
        createdBy: { ifNotExists: userId },
        createdIp: { ifNotExists: sourceIp },
        attributes: {
          formatted_no: formattedNo,
          fiscal_year: nowFiscalYear,
          issued_at: issuedAt,
        },
        updatedAt: now,
        updatedBy: userId,
        updatedIp: sourceIp,
      },
    })

    const sequenceData = await this.dynamoDbService.getItem(this.tableName, {
      pk,
      sk,
    })
    let fixNo = 0
    let rotateSequenceData = null

    // Handle rotating sequence data if date is provided
    if (date) {
      const rotateSortKeyVal = this.getRotateValue(rotateBy, date)
      rotateSequenceData = await this.dynamoDbService.getItem(this.tableName, {
        pk,
        sk: `${sk}${KEY_SEPARATOR}${rotateSortKeyVal}`,
      })
      fixNo = rotateSequenceData ? rotateSequenceData.seq + 1 : 1
    } else if (!date && sequenceData) {
      fixNo = this.isIncrementNo(
        rotateBy,
        nowFiscalYear,
        sequenceData.attributes.fiscal_year,
        new Date(sequenceData.issuedAt),
      )
        ? sequenceData.seq + 1
        : 1
    }

    const formatDict = this.createFormatDict(
      params,
      nowFiscalYear,
      fixNo,
      date || now,
    )
    const formattedNo = this.createFormattedNo(format, formatDict)

    // Common update operation
    if (rotateSequenceData) {
      return await this.dynamoDbService.updateItem(
        this.tableName,
        { pk: rotateSequenceData.pk, sk: rotateSequenceData.sk },
        buildUpdateData(fixNo, formattedNo, sk),
      )
    }

    // Non-rotate logic
    if (date) {
      const rotateSortKeyVal = this.getRotateValue(rotateBy, date)
      sk = `${sk}${KEY_SEPARATOR}${rotateSortKeyVal}`
    }

    return await this.dynamoDbService.updateItem(
      this.tableName,
      { pk, sk },
      buildUpdateData(fixNo, formattedNo, sk),
    )
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

  getFiscalYear(now: Date, registerDate?: Date) {
    /**
     * This function calculates the fiscal year for MELTEC.
     * Fiscal year is from April to March.
     * Example: November 2021 → 68th fiscal year.
     */

    // If registerDate is provided, calculate the fiscal year period (期)
    if (registerDate) {
      const registerYear = registerDate.getFullYear() // Registration year
      const registerMonth = registerDate.getMonth() + 1 // Registration month (1 - 12)

      const nowYear = now.getFullYear() // Current year
      const nowMonth = now.getMonth() + 1 // Current month (1 - 12)

      let fiscalYearPeriod

      // If current month is before the registration month, fiscal year will be in the previous year
      if (nowMonth < registerMonth) {
        fiscalYearPeriod = nowYear - registerYear
      } else {
        fiscalYearPeriod = nowYear - registerYear + 1
      }

      return fiscalYearPeriod
    }
    let year = now.getFullYear()

    // If the month is January, February, or March, subtract 1 from the year
    if (now.getMonth() + 1 <= 3) {
      year -= 1
    }
    // Subtract 1953 because 2021 corresponds to the 68th fiscal year
    return year - 1953
  }

  createFormatDict(
    sequenceParams: SequenceParamsDto,
    fiscalYear: number,
    fixNo: number,
    now: Date,
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
