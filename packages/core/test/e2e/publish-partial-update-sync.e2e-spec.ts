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

describe('publishPartialUpdateSync', () => {
  it('should be stored correct updated data in the data DDB table', async () => {
    // Arrange
    const payload = {
      pk: 'TEST#MBC',
      sk: 'publish-partial-update-sync#data',
      id: 'TEST#MBC#publish-partial-update-sync#data',
      name: 'testing#data',
      version: 0,
      code: 'publish-partial-update-sync#data',
      type: 'TEST',
    }

    const postRes = await request(config.apiBaseUrl)
      .post(API_PATH)
      .send(payload)

    expect(postRes.statusCode).toEqual(201)

    const updatePayload = {
      pk: 'TEST#MBC',
      sk: 'publish-partial-update-sync#data',
      name: 'update name',
      version: 1,
    }

    // Action
    const putRes = await request(config.apiBaseUrl)
      .put(API_PATH)
      .send(updatePayload)

    // Assert
    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })

    console.log('putRes', putRes.body)

    expect(data).toMatchObject({
      ...payload,
      name: updatePayload.name,
      version: 2,
    })
  }, 40000)

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
      sk: 'publish-partial-update-sync#data90',
      id: 'TEST#MBC#publish-partial-update-sync#data90',
      name: 'testing#data',
      version: 0,
      code: 'publish-partial-update-sync#data90',
      type: 'TEST',
    }

    const postRes = await request(config.apiBaseUrl)
      .post(API_PATH)
      .send(payload)

    expect(postRes.statusCode).toEqual(201)

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

    // Assert
    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })

    console.log('putRes', putRes.body)

    expect(data?.ttl >= ttl).toBeTruthy()

    await deleteItem(masterDataTableName, {
      pk: ttlData.pk,
      sk: ttlData.sk,
    })
  }, 40000)

  it('should store the latest data with input TTL', async () => {
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
      sk: 'publish-partial-update-sync#data30',
      id: 'TEST#MBC#publish-partial-update-sync#data30',
      name: 'testing#data',
      version: 0,
      code: 'publish-partial-update-sync#data30',
      type: 'TEST',
    }

    const postRes = await request(config.apiBaseUrl)
      .post(API_PATH)
      .send(payload)

    expect(postRes.statusCode).toEqual(201)

    const updatePayload = {
      pk: payload.pk,
      sk: payload.sk,
      name: 'update name',
      version: 1,
      ttl,
    }

    // Action
    const putRes = await request(config.apiBaseUrl)
      .put(API_PATH)
      .send(updatePayload)

    // Assert
    const data = await getItem(getTableName('testing_table', TableType.DATA), {
      pk: payload.pk,
      sk: payload.sk,
    })

    console.log('putRes', putRes.body)

    expect(data?.ttl == ttl).toBeTruthy()

    await deleteItem(masterDataTableName, {
      pk: ttlData.pk,
      sk: ttlData.sk,
    })
  }, 40000)
})
