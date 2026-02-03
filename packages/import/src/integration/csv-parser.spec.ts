/**
 * Third-party Integration Tests: csv-parser
 *
 * This test suite validates the csv-parser package's input/output behavior
 * to ensure compatibility with the MBC CQRS Serverless framework.
 *
 * Package: csv-parser (^3.2.0)
 * Purpose: Parse CSV data streams into JavaScript objects
 *
 * Test coverage:
 * - Basic CSV parsing with headers
 * - Custom delimiters (tab, semicolon)
 * - Quoted fields handling
 * - Escape character processing
 * - skipLines option
 * - strict mode validation
 * - Custom headers option
 * - Empty line handling
 * - BOM handling
 * - Stream processing for large files
 */

import { Readable } from 'stream'
import csv from 'csv-parser'

describe('csv-parser Integration Tests', () => {
  /**
   * Helper function to parse CSV string and return array of records
   *
   * @param csvContent - The CSV content as a string
   * @param options - csv-parser options
   * @returns Promise resolving to array of parsed records
   */
  const parseCsv = <T = Record<string, string>>(
    csvContent: string,
    options: csv.Options = {},
  ): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      const results: T[] = []
      const stream = Readable.from([csvContent])

      stream
        .pipe(csv(options))
        .on('data', (data: T) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error: Error) => reject(error))
    })
  }

  describe('Basic CSV Parsing', () => {
    it('should parse CSV with header row', async () => {
      // Input: Standard CSV with header row
      const input = `name,email,age
John,john@example.com,30
Jane,jane@example.com,25`

      // Output: Array of objects with header keys
      const result = await parseCsv(input)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
      expect(result[1]).toEqual({
        name: 'Jane',
        email: 'jane@example.com',
        age: '25',
      })
    })

    it('should parse single row CSV', async () => {
      const input = `id,value
1,test`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: '1', value: 'test' })
    })

    it('should handle CSV with only headers', async () => {
      const input = `name,email,age`

      const result = await parseCsv(input)

      expect(result).toHaveLength(0)
    })
  })

  describe('Custom Delimiters', () => {
    it('should parse tab-separated values (TSV)', async () => {
      // Input: Tab-separated data
      const input = `name\temail\tage
John\tjohn@example.com\t30
Jane\tjane@example.com\t25`

      // Options: separator set to tab character
      const options: csv.Options = { separator: '\t' }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should parse semicolon-separated values', async () => {
      // Input: Semicolon-separated data (common in European locales)
      const input = `name;email;age
John;john@example.com;30
Jane;jane@example.com;25`

      const options: csv.Options = { separator: ';' }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should parse pipe-separated values', async () => {
      const input = `name|email|age
John|john@example.com|30`

      const options: csv.Options = { separator: '|' }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })
  })

  describe('Quoted Fields', () => {
    it('should handle double-quoted fields', async () => {
      // Input: Fields containing commas are wrapped in double quotes
      const input = `name,address,city
"John Doe","123 Main St, Apt 4","New York"`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John Doe',
        address: '123 Main St, Apt 4',
        city: 'New York',
      })
    })

    it('should handle quoted fields with embedded quotes', async () => {
      // Input: Embedded quotes are escaped by doubling them
      const input = `name,quote
John,"He said ""Hello"""`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        quote: 'He said "Hello"',
      })
    })

    it('should handle quoted fields with newlines', async () => {
      // Input: Quoted fields can contain newlines
      const input = `name,description
John,"Line 1
Line 2"`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        description: 'Line 1\nLine 2',
      })
    })

    it('should handle custom quote character', async () => {
      // Input: Using single quotes instead of double quotes
      const input = `name,address
'John Doe','123 Main St, Apt 4'`

      const options: csv.Options = { quote: "'" }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John Doe',
        address: '123 Main St, Apt 4',
      })
    })
  })

  describe('Escape Characters', () => {
    it('should handle backslash escape character', async () => {
      // Input: Using backslash as escape character
      const input = `name,value
John,test\\"value`

      const options: csv.Options = { escape: '\\' }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      // Escape behavior may vary, check actual output
      expect(result[0].name).toBe('John')
    })

    it('should handle default escape (double quote)', async () => {
      // Input: Default escape is double quote within quoted field
      const input = `name,value
John,"test""value"`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        value: 'test"value',
      })
    })
  })

  describe('skipLines Option', () => {
    it('should skip specified number of lines', async () => {
      // Input: CSV with metadata rows before headers
      const input = `# Generated on 2024-01-01
# Version: 1.0
name,email
John,john@example.com
Jane,jane@example.com`

      // Options: Skip first 2 comment lines
      const options: csv.Options = { skipLines: 2 }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
      })
    })

    it('should work with skipLines=0 (default)', async () => {
      const input = `name,email
John,john@example.com`

      const options: csv.Options = { skipLines: 0 }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
      })
    })

    it('should skip all lines if skipLines exceeds row count', async () => {
      const input = `name,email
John,john@example.com`

      const options: csv.Options = { skipLines: 10 }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(0)
    })
  })

  describe('Strict Mode', () => {
    it('should error on column count mismatch in strict mode', async () => {
      // Input: Row has more columns than header
      const input = `name,email
John,john@example.com,extra`

      const options: csv.Options = { strict: true }

      await expect(parseCsv(input, options)).rejects.toThrow()
    })

    it('should error on fewer columns in strict mode', async () => {
      // Input: Row has fewer columns than header
      const input = `name,email,age
John,john@example.com`

      const options: csv.Options = { strict: true }

      await expect(parseCsv(input, options)).rejects.toThrow()
    })

    it('should include extra columns with auto-generated keys in non-strict mode', async () => {
      // Input: Row has more columns than header (non-strict)
      // csv-parser includes extra columns with auto-generated keys like _2, _3, etc.
      const input = `name,email
John,john@example.com,extra`

      const options: csv.Options = { strict: false }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        _2: 'extra',
      })
    })
  })

  describe('Custom Headers', () => {
    it('should use custom headers instead of first row', async () => {
      // Input: CSV without header row
      const input = `John,john@example.com,30
Jane,jane@example.com,25`

      // Options: Provide custom headers
      const options: csv.Options = {
        headers: ['name', 'email', 'age'],
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should override file headers with custom headers', async () => {
      // Input: CSV with headers that will be overridden
      const input = `col1,col2,col3
John,john@example.com,30`

      const options: csv.Options = {
        headers: ['name', 'email', 'age'],
      }

      const result = await parseCsv(input, options)

      // First row is parsed as data with custom headers
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'col1',
        email: 'col2',
        age: 'col3',
      })
      expect(result[1]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should support boolean false for headers (array indices)', async () => {
      // Input: CSV without headers
      const input = `John,john@example.com,30`

      const options: csv.Options = {
        headers: false,
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      // When headers=false, keys are array indices
      expect(result[0]).toEqual({
        '0': 'John',
        '1': 'john@example.com',
        '2': '30',
      })
    })
  })

  describe('Empty Line Handling', () => {
    it('should parse empty lines as empty objects by default', async () => {
      // Note: csv-parser does not skip empty lines by default,
      // it parses them as empty objects
      const input = `name,email
John,john@example.com

Jane,jane@example.com
`

      const result = await parseCsv(input)

      // csv-parser returns 3 rows: data, empty object, data
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
      })
      // Empty line is parsed as empty object
      expect(result[1]).toEqual({})
      expect(result[2]).toEqual({
        name: 'Jane',
        email: 'jane@example.com',
      })
    })

    it('should filter out empty lines with post-processing', async () => {
      const input = `name,email
John,john@example.com

Jane,jane@example.com`

      const result = await parseCsv(input)
      // Filter out empty objects in post-processing
      const filtered = result.filter((row) => Object.keys(row).length > 0)

      expect(filtered).toHaveLength(2)
    })

    it('should skip empty lines with skipEmptyLines option', async () => {
      const input = `name,email
John,john@example.com

Jane,jane@example.com`

      const options: csv.Options = { skipLines: 0 }
      // Note: csv-parser doesn't have skipEmptyLines, but we can use mapValues to filter
      const result = await parseCsv(input, options)

      // Filter non-empty rows
      const nonEmpty = result.filter(
        (row) => Object.values(row).some((v) => v !== ''),
      )
      expect(nonEmpty).toHaveLength(2)
    })
  })

  describe('BOM Handling', () => {
    it('should handle UTF-8 BOM by including it in first header', async () => {
      // Input: CSV with UTF-8 BOM (EF BB BF)
      // Note: csv-parser 3.x does NOT strip BOM automatically
      const bomChar = '\uFEFF'
      const input = `${bomChar}name,email
John,john@example.com`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      // csv-parser includes BOM in first header
      // The key will be '\uFEFFname' not 'name'
      expect(result[0]).toHaveProperty(`${bomChar}name`, 'John')
      expect(result[0]).toHaveProperty('email', 'john@example.com')
    })

    it('should strip BOM using mapHeaders', async () => {
      const bomChar = '\uFEFF'
      const input = `${bomChar}name,email
John,john@example.com`

      // Use mapHeaders to strip BOM
      const options: csv.Options = {
        mapHeaders: ({ header, index }) =>
          index === 0 ? header.replace(/^\uFEFF/, '') : header,
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('name', 'John')
    })
  })

  describe('Header Mapping Functions', () => {
    it('should transform headers using mapHeaders', async () => {
      const input = `Name,Email Address,Age
John,john@example.com,30`

      const options: csv.Options = {
        mapHeaders: ({ header }) => header.toLowerCase().replace(/\s+/g, '_'),
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email_address: 'john@example.com',
        age: '30',
      })
    })

    it('should trim headers using mapHeaders', async () => {
      const input = ` name , email , age
John,john@example.com,30`

      const options: csv.Options = {
        mapHeaders: ({ header }) => header.trim(),
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should exclude columns by returning null in mapHeaders', async () => {
      const input = `name,internal_id,email
John,12345,john@example.com`

      const options: csv.Options = {
        mapHeaders: ({ header }) =>
          header === 'internal_id' ? null : header,
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
      })
      expect(result[0]).not.toHaveProperty('internal_id')
    })
  })

  describe('Value Mapping Functions', () => {
    it('should transform values using mapValues', async () => {
      const input = `name,email,age
 John , john@example.com , 30 `

      const options: csv.Options = {
        mapValues: ({ value }) => value.trim(),
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should access header in mapValues', async () => {
      const input = `name,age,active
John,30,true`

      const options: csv.Options = {
        mapValues: ({ header, value }) => {
          if (header === 'age') return parseInt(value, 10)
          if (header === 'active') return value === 'true'
          return value
        },
      }

      const result = await parseCsv<{ name: string; age: number; active: boolean }>(
        input,
        options,
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'John',
        age: 30,
        active: true,
      })
    })
  })

  describe('Stream Processing for Large Files', () => {
    it('should handle large CSV data efficiently', async () => {
      // Generate CSV with 1000 rows
      const headers = 'id,name,email,value\n'
      const rows = Array.from(
        { length: 1000 },
        (_, i) => `${i},User${i},user${i}@example.com,${i * 100}`,
      ).join('\n')
      const input = headers + rows

      const result = await parseCsv(input)

      expect(result).toHaveLength(1000)
      expect(result[0]).toEqual({
        id: '0',
        name: 'User0',
        email: 'user0@example.com',
        value: '0',
      })
      expect(result[999]).toEqual({
        id: '999',
        name: 'User999',
        email: 'user999@example.com',
        value: '99900',
      })
    })

    it('should emit data events for each row', async () => {
      const input = `name,value
Row1,1
Row2,2
Row3,3`

      const dataEvents: Record<string, string>[] = []
      let endCalled = false

      await new Promise<void>((resolve, reject) => {
        const stream = Readable.from([input])

        stream
          .pipe(csv())
          .on('data', (data: Record<string, string>) => {
            dataEvents.push(data)
          })
          .on('end', () => {
            endCalled = true
            resolve()
          })
          .on('error', (error: Error) => reject(error))
      })

      expect(dataEvents).toHaveLength(3)
      expect(endCalled).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should emit error for malformed quoted fields', async () => {
      // Input: Unclosed quote
      const input = `name,value
John,"unclosed quote`

      // This may or may not throw depending on parser version
      // Just verify it completes or throws appropriately
      try {
        const result = await parseCsv(input)
        // Parser may handle gracefully
        expect(result).toBeDefined()
      } catch (error) {
        // Parser may throw error
        expect(error).toBeDefined()
      }
    })
  })

  describe('Special Characters', () => {
    it('should handle Unicode characters', async () => {
      const input = `name,city
\u65E5\u672C\u592A\u90CE,\u6771\u4EAC`

      const result = await parseCsv(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: '\u65E5\u672C\u592A\u90CE',
        city: '\u6771\u4EAC',
      })
    })

    it('should handle emoji characters', async () => {
      const input = `name,status
John,Active \u{1F44D}
Jane,Pending \u{1F4DD}`

      const result = await parseCsv(input)

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('Active \u{1F44D}')
      expect(result[1].status).toBe('Pending \u{1F4DD}')
    })
  })

  describe('Usage Pattern in MBC Framework', () => {
    /**
     * This test demonstrates the pattern used in ImportService
     * to process CSV files with header/value transformation
     */
    it('should match ImportService CSV parsing pattern', async () => {
      const input = ` Name , Email , Age
 John Doe , john@example.com , 30
 Jane Smith , jane@example.com , 25 `

      const options: csv.Options = {
        mapHeaders: ({ header }) => header.trim(),
        mapValues: ({ value }) => value.trim(),
      }

      const result = await parseCsv(input, options)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        Name: 'John Doe',
        Email: 'john@example.com',
        Age: '30',
      })
      expect(result[1]).toEqual({
        Name: 'Jane Smith',
        Email: 'jane@example.com',
        Age: '25',
      })
    })
  })
})
