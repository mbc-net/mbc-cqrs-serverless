import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

// Dedicated test setting only: never use AWS endpoint variables or credentials.
export function localClient(
  endpoint = process.env.COMMAND_ADMISSION_DYNAMODB_ENDPOINT ??
    'http://127.0.0.1:8000',
) {
  const match = endpoint.match(
    /^http:\/\/(?:127\.0\.0\.1|localhost):([1-9]\d{0,4})\/?$/,
  )
  if (!match || match[0] !== endpoint || Number(match[1]) > 65535) {
    throw new Error(
      'Expected http://127.0.0.1:<port> or http://localhost:<port> (1..65535)',
    )
  }
  return new DynamoDBClient({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    maxAttempts: 1,
  })
}
