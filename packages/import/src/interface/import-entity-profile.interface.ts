import { Type } from '@nestjs/common'

import type { ImportPublishMode } from '../constant/import-publish'
import { IImportStrategy } from './import-strategy.interface'
import { IProcessStrategy } from './processing-strategy.interface'

/**
 * Defines the complete import configuration for a single entity type (tableName).
 * This unified profile groups all related strategies and validators.
 */

export interface ImportEntityProfile {
  /**
   * A unique identifier for this data type (e.g., 'policies', 'users').
   */
  tableName: string

  /**
   * The class that implements the initial import logic (transform & validate).
   * Must be a class that adheres to the IImportStrategy interface.
   */
  importStrategy: Type<IImportStrategy<any, any>>

  /**
   * The class that implements the business processing logic (compare & map).
   * Must be a class that adheres to the IProcessStrategy interface.
   */
  processStrategy: Type<IProcessStrategy<any, any>>

  /**
   * How commands are published for this entity. Defaults to ASYNC when omitted.
   * @see ImportPublishMode
   */
  publishMode?: ImportPublishMode
}
