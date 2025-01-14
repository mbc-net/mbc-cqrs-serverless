import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { TABLE_NAME } from './constants'
// Path to the JSON file
const jsonFilePath = resolve(
  __dirname,
  '../../../../prisma/dynamodbs/cqrs.json',
) // Replace with your actual file name

try {
  // Read the JSON file
  const rawData = readFileSync(jsonFilePath, 'utf-8')
  const jsonData = JSON.parse(rawData)

  // Ensure jsonData is an array
  if (!Array.isArray(jsonData)) {
    throw new Error('The JSON content is not an array.')
  }

  // Add "master" to the array if it doesn't exist
  if (!jsonData.includes(TABLE_NAME)) {
    jsonData.push(TABLE_NAME)
  }

  // Write the updated JSON back to the file
  writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8')
} catch (error) {}
