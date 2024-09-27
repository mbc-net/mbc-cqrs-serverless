import request from 'supertest'

import { config } from './config'
import { getItem, getTableName, TableType } from './dynamo-client'
import { syncDataFinished } from './utils'

const API_PATH = '/api/testing'

jest.setTimeout(30000)

describe('Testing', () => {
  describe(`[POST ${API_PATH}]`, () => {
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
      console.log(res.body)
      expect(res.statusCode).toEqual(201)

      await syncDataFinished('testing-table', { pk: 'TEST', sk: 'publish@1' })

      const data = await getItem(
        getTableName('testing-table', TableType.DATA),
        {
          pk: 'TEST',
          sk: 'publish',
        },
      )

      expect(data).toMatchObject({ ...payload, version: 1 })
    })
  })
})
