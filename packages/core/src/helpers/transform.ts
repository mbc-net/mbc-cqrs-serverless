import { CommandModel, DataModel } from '../interfaces'
import { removeSortKeyVersion } from './key'

/**
 * Transform a CommandModel into a DataModel.
 *
 * Shared by DataService.publish and Repository.
 */
export function transformCommandToData(
  cmd: CommandModel,
  existing?: DataModel,
): DataModel {
  return {
    ...existing,
    pk: cmd.pk,
    sk: removeSortKeyVersion(cmd.sk),
    id: cmd.id,
    code: cmd.code,
    name: cmd.name,
    version: cmd.version,
    tenantCode: cmd.tenantCode,
    type: cmd.type,
    seq: cmd.seq,
    attributes: cmd.attributes,
    cpk: cmd.pk,
    csk: cmd.sk,
    isDeleted: cmd.isDeleted,
    ttl: cmd.ttl,
    requestId: cmd.requestId,
    createdAt: existing?.createdAt ?? cmd.createdAt,
    updatedAt: cmd.updatedAt,
    createdBy: existing?.createdBy ?? cmd.createdBy,
    updatedBy: cmd.updatedBy,
    createdIp: existing?.createdIp ?? cmd.createdIp,
    updatedIp: cmd.updatedIp,
  }
}
