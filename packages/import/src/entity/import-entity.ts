import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { ImportStatusEnum } from '../enum/import-status.enum'

/**
 * Import data structure
 * - pk: TASK#tenantCode
 * - sk: taskType#uuid
 * - code: taskType#uuid
 * - name: name || taskType
 * - tenant_code: tenantCode
 * - type: taskType
 * - status: ImportStatusEnum
 * - input: taskInput
 * - attributes
 */
export class ImportEntity extends CommandEntity {
  status?: ImportStatusEnum
  attributes: Record<string, any>
  result?: Record<string, any>

  constructor(partial: Partial<ImportEntity>) {
    super()
    Object.assign(this, partial)
  }
}
