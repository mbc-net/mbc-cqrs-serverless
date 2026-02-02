import { DetailKey } from './detail-key.interface'

/**
 * Interface for master data providers.
 * Implement this to create custom data sources for master data lookup.
 */
export interface IMasterDataProvider {
  /**
   * Get the data for a specific key.
   * @param key - The key to identify the data.
   * @returns A promise that resolves to the data.
   */
  getData(key: DetailKey): Promise<any>
}
