import { COMMAND_TABLE_SUFFIX } from '../constants'

const eventTypes = ['sqs', 'sns', 'dynamodb', 'event-bridge']

// "eventSourceARN": "arn:aws:dynamodb:ap-northeast-1:840741769402:table/dev-cqrs-master-command/stream/2023-11-23T02:17:17.688"
// arn:aws:dynamodb:ddblocal:000000000000:table/local-demo-master-command/stream/2023-11-23T15:23:51.694
// arn:aws:dynamodb:ap-northeast-1:undefined:local-demo-master-command

export function getEventTypeFromArn(source: string): string {
  for (const t of eventTypes) {
    if (source.includes(`:${t}:`)) {
      return t
    }
  }
  return null
}

export function getResourceNameFromArn(source: string): string {
  const resourceType = getEventTypeFromArn(source)
  if (
    resourceType === 'dynamodb' &&
    source.includes(COMMAND_TABLE_SUFFIX + '/stream/')
  ) {
    const s = source.split('/')
    return s[1]
  }
  const s = source.split(':')
  return s[s.length - 1]
}
