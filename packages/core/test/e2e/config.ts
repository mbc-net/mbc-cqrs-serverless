import dotenv from 'dotenv'

dotenv.config()

const config = {
  nodeEnv: process.env.NODE_ENV,
  appName: process.env.APP_NAME,
  dynamoEndpoint: process.env.DYNAMODB_ENDPOINT,
  dynamoRegion: process.env.DYNAMODB_REGION,
  apiBaseUrl: process.env.API_BASE_URL || 'http://0.0.0.0:3000',
}

// eslint-disable-next-line no-console
console.log(config)
export { config }
