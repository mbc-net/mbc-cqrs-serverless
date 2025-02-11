import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { TaskStatusEnum } from '../enums/status.enum'

/**
 * Task data structure
 * - pk: TASK#tenantCode
 * - sk: taskType#uuid
 * - code: taskType#uuid
 * - name: name || taskType
 * - tenant_code: tenantCode
 * - type: taskType
 * - status: TASK_STATUS
 * - input: taskInput
 * - attributes
 *    - result
 *    - error
 */
export class TaskEntity extends CommandEntity {
  status?: TaskStatusEnum
  input: Record<string, any>
  attributes?: {
    result?: any
    error?: any
    subTaskCount?: number
    subTaskFailedCount?: number
    subTaskRunningCount?: number
    subTaskSucceedCount?: number
    subTasks?: any
  }

  constructor(partial: Partial<TaskEntity>) {
    super()
    Object.assign(this, partial)
  }
}
