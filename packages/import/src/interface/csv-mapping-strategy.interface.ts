/**
 * Defines the contract for transforming a raw CSV row into a standard
 * validated attributes DTO for a specific table.
 */
export interface ICsvMappingStrategy<TAttributesDto extends object> {
  /**
   * Maps a single row from a CSV file to the target attributes DTO.
   * This method should also perform any necessary validation.
   * @param csvRow A key-value object representing one row from the CSV file.
   * @returns A promise that resolves with the strongly-typed attributes DTO.
   * @throws {BadRequestException} if the row data is invalid.
   */
  mapCsvRow(csvRow: Record<string, any>): Promise<TAttributesDto>
}
