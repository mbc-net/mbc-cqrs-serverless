import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { TaskStatusEnum } from '../enums/status.enum'

/**
 * Task data structure
 * - pk: TASK#tenantCode
 * - sk: taskType#uuid#order
 * - code: taskType#uuid
 * - name: name || taskType
 * - tenant_code: tenantCode
 * - status: TASK_STATUS
 * - attributes
 *    - result
 *    - error
 */
export class SubTaskEntity extends CommandEntity {
  status?: TaskStatusEnum
  attributes?: {
    result?: any
    error?: any
  }

  constructor(partial: Partial<SubTaskEntity>) {
    super()
    Object.assign(this, partial)
  }
}
