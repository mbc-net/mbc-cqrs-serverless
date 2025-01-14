import { CommandEntity, DataEntity } from '../../interfaces';
import { serializeToExternal, deserializeToInternal } from '../serializer';

describe('Serializer Helpers', () => {
  describe('serializeToExternal', () => {
    it('should convert internal structure to external format', () => {
      const internal = new CommandEntity();
      Object.assign(internal, {
        pk: 'PROJECT',
        sk: '123',
        name: 'Test Project',
        attributes: {
          details: {
            status: 'active',
            category: 'development'
          }
        }
      });

      const external = serializeToExternal(internal);
      expect(external).toEqual({
        id: 'PROJECT#123',
        code: '123',
        name: 'Test Project',
        pk: 'PROJECT',
        sk: '123',
        details: {
          status: 'active',
          category: 'development'
        }
      });
    });

    it('should handle null input', () => {
      const result = serializeToExternal(null);
      expect(result).toBeNull();
    });

    it('should handle empty attributes', () => {
      const internal = new CommandEntity();
      Object.assign(internal, {
        pk: 'PROJECT',
        sk: '123',
        name: 'Test Project'
      });

      const external = serializeToExternal(internal);
      expect(external).toEqual({
        id: 'PROJECT#123',
        code: '123',
        name: 'Test Project',
        pk: 'PROJECT',
        sk: '123'
      });
    });
  });

  describe('deserializeToInternal', () => {
    it('should convert external format to internal structure', () => {
      const external = {
        id: 'PROJECT#123',
        code: '123',
        name: 'Test Project',
        details: {
          status: 'active',
          category: 'development'
        }
      };

      const internal = deserializeToInternal(external, CommandEntity);
      expect(internal).not.toBeNull();
      if (internal) {
        expect(internal.pk).toBe('PROJECT');
        expect(internal.sk).toBe('123');
        expect(internal.name).toBe('Test Project');
        expect(internal.attributes).toEqual({
          details: {
            status: 'active',
            category: 'development'
          }
        });
      }
    });

    it('should handle null input', () => {
      const result = deserializeToInternal(null, CommandEntity);
      expect(result).toBeNull();
    });

    it('should use code as sk when id is not provided', () => {
      const external = {
        code: '123',
        name: 'Test Project'
      };

      const internal = deserializeToInternal(external, CommandEntity);
      expect(internal).not.toBeNull();
      if (internal) {
        expect(internal.sk).toBe('123');
      }
    });

    it('should preserve entity-specific fields', () => {
      const external = {
        id: 'PROJECT#123',
        code: '123',
        name: 'Test Project',
        version: 1,
        tenantCode: 'TENANT1',
        type: 'TEST'
      };

      const internal = deserializeToInternal(external, CommandEntity);
      expect(internal).not.toBeNull();
      if (internal) {
        expect(internal.version).toBe(1);
        expect(internal.tenantCode).toBe('TENANT1');
        expect(internal.type).toBe('TEST');
      }
    });
  });
});
