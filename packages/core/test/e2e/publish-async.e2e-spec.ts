import request from 'supertest'

import { config } from './config'
import { getItem, getTableName, TableType } from './dynamo-client'
import { syncDataFinished } from './utils'

const API_PATH = '/api/testing'

describe('Publish', () => {
  it('should be stored correct data in the command DDB table', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish#command',
      id: 'TEST#publish#command',
      name: 'testing#command',
      version: 0,
      code: 'publish#command',
      type: 'TEST',
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(201)

    await syncDataFinished('testing_table', {
      pk: payload.pk,
      sk: `${payload.sk}@1`,
    })

    const data = await getItem(
      getTableName('testing_table', TableType.COMMAND),
      {
        pk: payload.pk,
        sk: `${payload.sk}@1`,
      },
    )

    console.log('data', data)

    expect(data).toMatchObject({
      ...payload,
      version: 1,
      sk: `${payload.sk}@1`,
    })
  }, 40000)

  it('should be stored correct data in the data DDB table', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish#data',
      id: 'TEST#publish#data',
      name: 'testing#data',
      version: 0,
      code: 'publish#data',
      type: 'TEST',
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(201)

    await syncDataFinished('testing_table', {
      pk: payload.pk,
      sk: `${payload.sk}@1`,
    })

    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })

    expect(data).toMatchObject({ ...payload, version: 1 })
  }, 40000)

  it('should be stored correct data in the history DDB table', async () => {
    // Arrange
    const payload = {
      pk: 'TEST',
      sk: 'publish#history',
      id: 'TEST#publish#history',
      name: 'testing#history',
      version: 0,
      code: 'publish#history',
      type: 'TEST',
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    await syncDataFinished('testing_table', {
      pk: payload.pk,
      sk: `${payload.sk}@1`,
    })

    // Assert
    expect(res.statusCode).toEqual(201)

    const data = await getItem(
      getTableName('testing_table', TableType.HISTORY),
      {
        pk: payload.pk,
        sk: `${payload.sk}@1`,
      },
    )

    expect(data).toBeUndefined()
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

    await syncDataFinished('testing_table', {
      pk: payload.pk,
      sk: `${payload.sk}@1`,
    })

    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(409)
    expect(res.body?.message).toEqual(
      'ConditionalCheckFailedException: The conditional request failed',
    )
  }, 80000)
})
