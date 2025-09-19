import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { ImportStatusEnum } from '../enum/import-status.enum'

/**
 * Import data structure
 * - pk: {IMPORT|CSV_IMPORT}#tenantCode
 * - sk: tableName#uuid
 * - code: tableName#uuid
 * - name: name || tableName
 * - tenant_code: tenantCode
 * - type: CSV_MASTER_JOB | tableName
 * - status: ImportStatusEnum
 * - attributes: ImportEntity attributes
 * - result: ImportEntity result
 */
export class ImportEntity extends CommandEntity {
  status?: ImportStatusEnum
  attributes: Record<string, any>
  result?: Record<string, any>

  // --- ADDED FOR CSV JOB TRACKING ---
  totalRows?: number
  processedRows?: number
  succeededRows?: number
  failedRows?: number
  // ------------------------------------

  constructor(partial: Partial<ImportEntity>) {
    super()
    Object.assign(this, partial)
  }
}
