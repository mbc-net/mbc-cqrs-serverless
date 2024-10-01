import request from 'supertest'

import { config } from './config'
import { getItem, getTableName, TableType } from './dynamo-client'
import { syncDataFinished } from './utils'

const API_PATH = '/api/testing'

describe('Publish', () => {
  it('should be stored correct data in DDB', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish',
      id: 'TEST#publish',
      name: 'testing',
      version: 0,
      code: 'publish',
      type: 'TEST',
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(201)

    await syncDataFinished('testing-table', { pk: 'TEST', sk: 'publish@1' })

    const data = await getItem(getTableName('testing-table', TableType.DATA), {
      pk: 'TEST',
      sk: 'publish',
    })

    expect(data).toMatchObject({ ...payload, version: 1 })
  }, 40000)

  it('should return invalid input version', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish_1',
      id: 'TEST#publish_1',
      name: 'testing',
      version: 1,
      code: 'publish_1',
      type: 'TEST',
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(400)
    expect(res.body?.message).toEqual(
      'Invalid input version. The input version must be equal to the latest version',
    )
  }, 40000)

  it('should return the conditional request failed', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish_2',
      id: 'TEST#publish_2',
      name: 'testing',
      version: 0,
      code: 'publish_2',
      type: 'TEST',
    }

    await request(config.apiBaseUrl).post(API_PATH).send(payload)

    await syncDataFinished('testing-table', { pk: 'TEST', sk: 'publish_2@1' })

    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(409)
    expect(res.body?.message).toEqual(
      'ConditionalCheckFailedException: The conditional request failed',
    )
  }, 80000)
})
