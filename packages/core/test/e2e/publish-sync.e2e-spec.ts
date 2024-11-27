import request from 'supertest'

import { config } from './config'
import { getItem, getTableName, TableType } from './dynamo-client'

const API_PATH = '/api/testing/sync'

describe('publishSync', () => {
  it('should be stored correct data in the data DDB table', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish-sync#data',
      id: 'TEST#publish-sync#data',
      name: 'testing#data',
      version: 0,
      code: 'publish-sync#data',
      type: 'TEST',
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(201)

    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })

    console.log('data', data)

    expect(data).toMatchObject({
      ...payload,
      version: 1,
    })
  }, 40000)

  it('should return invalid input version', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish-sync_1',
      id: 'TEST#publish-sync_1',
      name: 'testing',
      version: 1,
      code: 'publish-sync_1',
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
})
