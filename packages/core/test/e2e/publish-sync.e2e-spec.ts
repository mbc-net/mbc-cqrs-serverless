import request from 'supertest'

import { config } from './config'
import {
  deleteItem,
  getItem,
  getTableName,
  putItem,
  TableType,
} from './dynamo-client'

const API_PATH = '/api/testing/sync'

describe('publishSync', () => {
  it('should be stored correct data in the data DDB table', async () => {
    // Arrange
    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-sync#data',
      id: 'TEST#MBC#publish-sync#data',
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

    expect(data).toMatchObject({
      ...payload,
      version: 1,
    })
  }, 40000)

  it('should return invalid input version', async () => {
    // Arrange
    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-sync_1',
      id: 'TEST#MBC#publish-sync_1',
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

  it('should store the latest data with default TTL (null)', async () => {
    // Arrange
    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-sync#data1',
      id: 'TEST#MBC#publish-sync#data1',
      name: 'testing#ttl',
      version: 0,
      code: 'publish-sync#data1',
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

    expect(data).toMatchObject({
      ...payload,
      ttl: null,
      version: 1,
    })
  })

  it('should store the latest data with configuration TTL in DDB (90 days)', async () => {
    // Arrange
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
    await putItem(masterDataTableName, ttlData)
    const ttl = Math.floor(
      (new Date().getTime() + 90 * 24 * 60 * 60 * 1000) / 1000,
    ) // 90 days

    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-sync#data90',
      id: 'TEST#MBC#publish-sync#data90',
      name: 'testing#ttl',
      version: 0,
      code: 'publish-sync#data90',
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

    expect(data?.ttl >= ttl).toBeTruthy()

    await deleteItem(masterDataTableName, {
      pk: ttlData.pk,
      sk: ttlData.sk,
    })
  })

  it('should store the latest data with input TTL (30 days)', async () => {
    // Arrange
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
    await putItem(masterDataTableName, ttlData)
    const ttl = Math.floor(
      (new Date().getTime() + 30 * 24 * 60 * 60 * 1000) / 1000,
    ) // 30 days

    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-sync#data-in-30',
      id: 'TEST#MBC#publish-sync#data-in-30',
      name: 'testing#ttl',
      version: 0,
      code: 'publish-sync#data-in-30',
      type: 'TEST',
      ttl,
    }

    // Action
    const res = await request(config.apiBaseUrl).post(API_PATH).send(payload)

    // Assert
    expect(res.statusCode).toEqual(201)

    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })
    console.log('🚀 ~ data ~ data:', data)

    expect(data?.ttl == ttl).toBeTruthy()

    await deleteItem(masterDataTableName, {
      pk: ttlData.pk,
      sk: ttlData.sk,
    })
  })
})
