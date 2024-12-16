import { TableType } from '../commands'

/**
 * Interface defining the TTL service.
 */
export interface ITtlService {
  /**
   * Calculates the Unix timestamp TTL based on the given type, tenant code, and optional start date.
   *
   * @param {TableType} type - The table type.
   * @param {string} [tenantCode] - (Optional) The tenant code.
   * @param {Date} [startDate] - (Optional) The start date. Defaults to the current date if not provided.
   * @returns {Promise<number | null>} The TTL as a Unix timestamp or `null` if no configuration is found.
   */
  calculateTtl(
    type: TableType,
    tenantCode?: string,
    startDate?: Date,
  ): Promise<number | null>

  /**
   * Retrieves the TTL configuration for the given table type and tenant code.
   *
   * @param {TableType} type - The table type.
   * @param {string} [tenantCode] - (Optional) The tenant code.
   * @returns {Promise<number | null>} The number of days configured for TTL or `null` if no configuration is found.
   */
  getTtlConfiguration(
    type: TableType,
    tenantCode?: string,
  ): Promise<number | null>

  /**
   * Calculates the Unix timestamp for the given number of days from a start date.
   *
   * @param {number} days - The number of days to calculate the TTL.
   * @param {Date} [startDate] - (Optional) The start date. Defaults to the current date if not provided.
   * @returns {number} The TTL as a Unix timestamp.
   * @throws {Error} An error if the number of days is less than or equal to zero.
   */
  calculateUnixTime(days: number, startDate?: Date): number
}
