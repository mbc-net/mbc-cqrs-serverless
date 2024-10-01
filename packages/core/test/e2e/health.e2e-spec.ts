import request from 'supertest'

import { config } from './config'

const API_PATH = '/'

describe('Health', () => {
  describe(`[GET ${API_PATH}]`, () => {
    it('should be healthy', () => {
      return request(config.apiBaseUrl)
        .get('/')
        .expect(200)
        .then((response) => {
          expect(response.text).toEqual('Hello World!')
        })
    })
  })
})
