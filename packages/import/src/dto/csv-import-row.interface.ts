// import { CsvImportType } from '../constants/csv-import.enum'

import { CreateCsvImportDto } from './create-csv-import.dto'

export interface ICsvRowImport<T = any> {
  BatchInput: {
    Attributes: CreateCsvImportDto
  }
  Items: T[]
}
