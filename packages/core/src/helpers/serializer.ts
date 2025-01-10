import { CommandEntity, DataEntity } from '../interfaces';

export interface SerializerOptions {
  keepAttributes?: boolean;
  flattenDepth?: number;
}

/**
 * Converts internal DynamoDB structure to external flat structure
 * @param item Internal item (CommandEntity or DataEntity)
 * @param options Serialization options
 * @returns Flattened external structure
 */
export function serializeToExternal<T extends CommandEntity | DataEntity>(
  item: T | null | undefined,
  options: SerializerOptions = {}
): Record<string, any> | null {
  if (!item) return null;

  const result: Record<string, any> = {
    id: `${item.pk}#${item.sk}`,
    code: item.sk,
    name: item.name,
  };

  // Copy first level properties
  Object.keys(item).forEach(key => {
    if (key !== 'attributes' && typeof item[key] !== 'undefined') {
      result[key] = item[key];
    }
  });

  // Handle attributes
  if (item.attributes) {
    Object.entries(item.attributes).forEach(([key, value]) => {
      result[key] = value;
    });
  }

  return result;
}

/**
 * Converts external flat structure to internal DynamoDB structure
 * @param data External flat structure
 * @param EntityClass Entity class to instantiate (CommandEntity or DataEntity)
 * @returns Internal structure
 */
export function deserializeToInternal<T extends CommandEntity | DataEntity>(
  data: Record<string, any> | null | undefined,
  EntityClass: new () => T
): T | null {
  if (!data) return null;

  const [pk, sk] = (data.id || '').split('#');
  const entity = new EntityClass();
  const attributes: Record<string, any> = {};
  
  // Set basic properties
  entity.pk = pk;
  entity.sk = sk || data.code;
  entity.name = data.name;

  // Copy entity-specific fields first
  ['version', 'tenantCode', 'type', 'isDeleted', 'status', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'createdIp', 'updatedIp'].forEach(key => {
    if (key in data) {
      entity[key] = data[key];
    }
  });

  // Separate remaining fields into attributes
  Object.keys(data).forEach(key => {
    if (!['id', 'code', 'pk', 'sk', 'name', 'version', 'tenantCode', 'type', 'isDeleted', 'status', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'createdIp', 'updatedIp'].includes(key)) {
      if (key in entity) {
        entity[key] = data[key];
      } else {
        attributes[key] = data[key];
      }
    }
  });

  entity.attributes = attributes;
  return entity;
}
