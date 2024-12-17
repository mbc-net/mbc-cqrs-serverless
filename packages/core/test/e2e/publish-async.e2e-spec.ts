import request from 'supertest'

import { config } from './config'
import {
  deleteItem,
  getItem,
  getTableName,
  putItem,
  TableType,
} from './dynamo-client'
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

  it('should store command, data, history with configuration TTL in ddb', async () => {
    // Arrange
    const ttlCommand = {
      pk: 'MASTER#MBC',
      sk: 'TTL#local-test-testing_table-command',
      id: 'MASTER#MBC#TTL#local-test-testing_table-command',
      code: 'MASTER#MBC#TTL#local-test-testing_table-command',
      type: 'TTL',
      name: 'TTL#local-test-testing_table-command',
      version: 0,
      attributes: {
        days: 30,
      },
    }
    const ttlHistory = {
      pk: 'MASTER#MBC',
      sk: 'TTL#local-test-testing_table-history',
      id: 'MASTER#MBC#TTL#local-test-testing_table-history',
      code: 'MASTER#MBC#TTL#local-test-testing_table-history',
      type: 'TTL',
      name: 'TTL#local-test-testing_table-history',
      version: 0,
      attributes: {
        days: 45,
      },
    }
    const ttlData = {
      pk: 'MASTER#MBC',
      sk: 'TTL#local-test-testing_table-data',
      id: 'MASTER#MBC#TTL#local-test-testing_table-data',
      code: 'MASTER#MBC#TTL#local-test-testing_table-data',
      type: 'TTL',
      name: 'TTL#local-test-testing_table-data',
      version: 0,
      attributes: {
        days: 90,
      },
    }

    const masterDataTableName = getTableName('master', TableType.DATA)

    await Promise.all([
      putItem(masterDataTableName, ttlCommand),
      putItem(masterDataTableName, ttlHistory),
      putItem(masterDataTableName, ttlData),
    ])

    // TODO:
    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-partial-update-async#data',
      id: 'TEST#MBC#publish-partial-update-async#data',
      name: 'testing#data',
      version: 0,
      code: 'publish-partial-update-async#data',
      type: 'TEST',
    }

    const postRes = await request(config.apiBaseUrl)
      .post(API_PATH)
      .send(payload)
    console.log('$#@!$postRes$@#', postRes.body)
    expect(postRes.statusCode).toEqual(201)
    await syncDataFinished('testing_table', {
      pk: payload.pk,
      sk: `${payload.sk}@1`,
    })
    const validTtl = {
      command: Math.floor(
        (new Date().getTime() + 30 * 24 * 60 * 60 * 1000) / 1000,
      ), // 30 days
      history: Math.floor(
        (new Date().getTime() + 45 * 24 * 60 * 60 * 1000) / 1000,
      ), // 45 days
      data: Math.floor(
        (new Date().getTime() + 90 * 24 * 60 * 60 * 1000) / 1000,
      ), // 90 days
    }

    const updatePayload = {
      pk: payload.pk,
      sk: payload.sk,
      name: 'update name',
      version: 1,
    }

    // Action
    const putRes = await request(config.apiBaseUrl)
      .put(API_PATH)
      .send(updatePayload)
    await syncDataFinished('testing_table', {
      pk: payload.pk,
      sk: `${payload.sk}@2`,
    })
    console.log('$@#$@#$putRes$@#$@#', putRes.body)

    // Assert
    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })
    console.log('🚀 ~ data ~ data:', data)

    expect(data?.ttl >= validTtl.data).toBeTruthy()

    const newestCommand = await getItem(
      getTableName('testing_table', TableType.COMMAND),
      {
        pk: payload.pk,
        sk: `${payload.sk}@2`,
      },
    )

    console.log('🚀 ~ newestCommand ~ newestCommand:', newestCommand)

    expect(newestCommand?.ttl >= validTtl.data).toBeTruthy()

    const oldCommand = await getItem(
      getTableName('testing_table', TableType.COMMAND),
      {
        pk: payload.pk,
        sk: `${payload.sk}@1`,
      },
    )

    console.log('🚀 ~ oldCommand ~ oldCommand:', oldCommand)

    expect(oldCommand?.ttl >= validTtl.command).toBeTruthy()

    const history = await getItem(
      getTableName('testing_table', TableType.HISTORY),
      {
        pk: payload.pk,
        sk: `${payload.sk}@1`,
      },
    )

    console.log('🚀 ~ history ~ history:', history)

    expect(history?.ttl >= validTtl.history).toBeTruthy()

    await Promise.all([
      deleteItem(masterDataTableName, {
        pk: ttlData.pk,
        sk: ttlData.sk,
      }),
      deleteItem(masterDataTableName, {
        pk: ttlHistory.pk,
        sk: ttlHistory.sk,
      }),
      deleteItem(masterDataTableName, {
        pk: ttlHistory.pk,
        sk: ttlHistory.sk,
      }),
    ])
  }, 150000)
})
