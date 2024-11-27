import { DetailKey } from './detail-key.interface'

export interface IMasterDataProvider {
  /**
   * Get the data for a specific key.
   * @param key - The key to identify the data.
   * @returns A promise that resolves to the data.
   */
  getData(key: DetailKey): Promise<any>
}
