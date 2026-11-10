import { CustomDecorator, SetMetadata } from '@nestjs/common'

export const MASTER_ROUTE_METADATA = 'master:route'

export interface MasterRouteOptions {
  /** The route only reads data, even though it is not a GET (e.g. check-exist). */
  read?: boolean
  targetsCommon?: boolean
}

export const MasterRoute = (options: MasterRouteOptions): CustomDecorator =>
  SetMetadata(MASTER_ROUTE_METADATA, options)
