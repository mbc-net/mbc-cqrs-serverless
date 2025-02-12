import { IInvoke } from '@mbc-cqrs-serverless/core'

import { CreateTaskDto } from '../dto'
import { TaskEntity, TaskListEntity } from '../entity'
import { TaskQueueEvent } from '../event'

export interface ITaskService {
  /**
   * Creates a task and stores it in DynamoDB.
   *
   * @param dto - The data transfer object containing task details.
   * @param options - Additional options including invocation context.
   * @returns A promise that resolves to the created task entity.
   */
  createTask(
    dto: CreateTaskDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<TaskEntity>

  /**
   * Creates a Step Function task and stores it in DynamoDB.
   *
   * @param dto - The data transfer object containing task details.
   * @param options - Additional options including invocation context.
   * @returns A promise that resolves to the created task entity.
   */
  createStepFunctionTask(
    dto: CreateTaskDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<TaskEntity>

  /**
   * Creates sub task for Step Function task and stores it in DynamoDB.
   *
   * @param event - The data transfer object containing task details.
   * @param options - Additional options including invocation context.
   * @returns A promise that resolves to the created task entity.
   */
  createSubTask(event: TaskQueueEvent): Promise<TaskEntity[]>

  /**
   * Retrieves a list of task from DynamoDB.
   *
   * @param tenantCode - The tenant code used to construct the partition key.
   * @param type - The type of task, must be either "TASK" or "SFN_TASK".
   * @param options - Additional query parameters, including sort key conditions, pagination, and ordering.
   * @returns A promise that resolves to a list of task entities.
   */
  listItemsByPk(
    tenantCode: string,
    type?: string,
    options?: {
      sk?: {
        skExpession: string
        skAttributeValues: Record<string, string>
        skAttributeNames?: Record<string, string>
      }
      startFromSk?: string
      limit?: number
      order?: 'asc' | 'desc'
    },
  ): Promise<TaskListEntity>
}
