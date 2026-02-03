/**
 * AWS DynamoDB Client Integration Tests
 *
 * This file tests the AWS SDK DynamoDB client commands using aws-sdk-client-mock.
 * It covers input parameters (IN) and return values (OUT) for each command.
 */
import {
  BatchWriteItemCommand,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS DynamoDB Client Commands', () => {
  const dynamoDBMock = mockClient(DynamoDBClient)
  const client = new DynamoDBClient({ region: 'ap-northeast-1' })

  beforeEach(() => {
    dynamoDBMock.reset()
  })

  afterEach(() => {
    dynamoDBMock.reset()
  })

  // ============================================================================
  // PutItemCommand Tests
  // ============================================================================
  describe('PutItemCommand', () => {
    describe('Input Parameters', () => {
      it('should send PutItemCommand with TableName and Item', async () => {
        // Arrange
        dynamoDBMock.on(PutItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Item: marshall({ pk: 'partition-key', sk: 'sort-key', data: 'value' }),
        }

        // Act
        await client.send(new PutItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, {
          TableName: 'test-table',
          Item: {
            pk: { S: 'partition-key' },
            sk: { S: 'sort-key' },
            data: { S: 'value' },
          },
        })
      })

      it('should send PutItemCommand with ConditionExpression', async () => {
        // Arrange
        dynamoDBMock.on(PutItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Item: marshall({ pk: 'pk-value', sk: 'sk-value' }),
          ConditionExpression: 'attribute_not_exists(pk)',
        }

        // Act
        await client.send(new PutItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, {
          TableName: 'test-table',
          ConditionExpression: 'attribute_not_exists(pk)',
        })
      })

      it('should send PutItemCommand with ReturnValues', async () => {
        // Arrange
        const oldItem = { pk: 'pk-value', sk: 'sk-value', data: 'old-value' }
        dynamoDBMock.on(PutItemCommand).resolves({
          Attributes: marshall(oldItem),
        })

        const params = {
          TableName: 'test-table',
          Item: marshall({ pk: 'pk-value', sk: 'sk-value', data: 'new-value' }),
          ReturnValues: 'ALL_OLD' as const,
        }

        // Act
        const result = await client.send(new PutItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, {
          ReturnValues: 'ALL_OLD',
        })
        expect(result.Attributes).toBeDefined()
        expect(unmarshall(result.Attributes!)).toEqual(oldItem)
      })
    })

    describe('Return Values', () => {
      it('should return empty response on successful put', async () => {
        // Arrange
        dynamoDBMock.on(PutItemCommand).resolves({
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new PutItemCommand({
            TableName: 'test-table',
            Item: marshall({ pk: 'pk', sk: 'sk' }),
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })

      it('should return old attributes when ReturnValues is ALL_OLD', async () => {
        // Arrange
        const oldItem = { pk: 'pk', sk: 'sk', version: 1 }
        dynamoDBMock.on(PutItemCommand).resolves({
          Attributes: marshall(oldItem),
        })

        // Act
        const result = await client.send(
          new PutItemCommand({
            TableName: 'test-table',
            Item: marshall({ pk: 'pk', sk: 'sk', version: 2 }),
            ReturnValues: 'ALL_OLD',
          }),
        )

        // Assert
        expect(result.Attributes).toBeDefined()
        expect(unmarshall(result.Attributes!)).toEqual(oldItem)
      })
    })

    describe('Error Cases', () => {
      it('should throw ConditionalCheckFailedException', async () => {
        // Arrange
        const error = new Error('The conditional request failed')
        error.name = 'ConditionalCheckFailedException'
        dynamoDBMock.on(PutItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
              ConditionExpression: 'attribute_not_exists(pk)',
            }),
          ),
        ).rejects.toThrow('The conditional request failed')
      })

      it('should throw ResourceNotFoundException', async () => {
        // Arrange
        const error = new Error('Requested resource not found')
        error.name = 'ResourceNotFoundException'
        dynamoDBMock.on(PutItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PutItemCommand({
              TableName: 'non-existent-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          ),
        ).rejects.toThrow('Requested resource not found')
      })
    })
  })

  // ============================================================================
  // GetItemCommand Tests
  // ============================================================================
  describe('GetItemCommand', () => {
    describe('Input Parameters', () => {
      it('should send GetItemCommand with TableName and Key', async () => {
        // Arrange
        dynamoDBMock.on(GetItemCommand).resolves({ Item: undefined })

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'partition-key', sk: 'sort-key' }),
        }

        // Act
        await client.send(new GetItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(GetItemCommand, {
          TableName: 'test-table',
          Key: {
            pk: { S: 'partition-key' },
            sk: { S: 'sort-key' },
          },
        })
      })

      it('should send GetItemCommand with ProjectionExpression', async () => {
        // Arrange
        dynamoDBMock.on(GetItemCommand).resolves({
          Item: marshall({ pk: 'pk', data: 'value' }),
        })

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          ProjectionExpression: 'pk, #data',
          ExpressionAttributeNames: { '#data': 'data' },
        }

        // Act
        await client.send(new GetItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(GetItemCommand, {
          ProjectionExpression: 'pk, #data',
          ExpressionAttributeNames: { '#data': 'data' },
        })
      })

      it('should send GetItemCommand with ConsistentRead', async () => {
        // Arrange
        dynamoDBMock.on(GetItemCommand).resolves({ Item: undefined })

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          ConsistentRead: true,
        }

        // Act
        await client.send(new GetItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(GetItemCommand, {
          ConsistentRead: true,
        })
      })
    })

    describe('Return Values - unmarshall', () => {
      it('should return Item and unmarshall correctly', async () => {
        // Arrange
        const item = {
          pk: 'partition-key',
          sk: 'sort-key',
          name: 'test-name',
          count: 42,
          active: true,
          tags: ['tag1', 'tag2'],
          metadata: { key: 'value' },
        }
        dynamoDBMock.on(GetItemCommand).resolves({
          Item: marshall(item),
        })

        // Act
        const result = await client.send(
          new GetItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'partition-key', sk: 'sort-key' }),
          }),
        )

        // Assert
        expect(result.Item).toBeDefined()
        const unmarshalledItem = unmarshall(result.Item!)
        expect(unmarshalledItem).toEqual(item)
        expect(unmarshalledItem.pk).toBe('partition-key')
        expect(unmarshalledItem.count).toBe(42)
        expect(unmarshalledItem.active).toBe(true)
        expect(unmarshalledItem.tags).toEqual(['tag1', 'tag2'])
        expect(unmarshalledItem.metadata).toEqual({ key: 'value' })
      })

      it('should return undefined Item when key not found', async () => {
        // Arrange
        dynamoDBMock.on(GetItemCommand).resolves({
          Item: undefined,
        })

        // Act
        const result = await client.send(
          new GetItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'non-existent', sk: 'key' }),
          }),
        )

        // Assert
        expect(result.Item).toBeUndefined()
      })

      it('should unmarshall nested objects correctly', async () => {
        // Arrange
        const nestedItem = {
          pk: 'pk',
          sk: 'sk',
          level1: {
            level2: {
              level3: {
                value: 'deep-value',
                number: 123,
              },
            },
          },
        }
        dynamoDBMock.on(GetItemCommand).resolves({
          Item: marshall(nestedItem),
        })

        // Act
        const result = await client.send(
          new GetItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'pk', sk: 'sk' }),
          }),
        )

        // Assert
        const unmarshalledItem = unmarshall(result.Item!)
        expect(unmarshalledItem.level1.level2.level3.value).toBe('deep-value')
        expect(unmarshalledItem.level1.level2.level3.number).toBe(123)
      })
    })

    describe('Error Cases', () => {
      it('should throw ResourceNotFoundException', async () => {
        // Arrange
        const error = new Error('Requested resource not found')
        error.name = 'ResourceNotFoundException'
        dynamoDBMock.on(GetItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new GetItemCommand({
              TableName: 'non-existent-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          ),
        ).rejects.toThrow('Requested resource not found')
      })
    })
  })

  // ============================================================================
  // QueryCommand Tests
  // ============================================================================
  describe('QueryCommand', () => {
    describe('Input Parameters - KeyConditionExpression', () => {
      it('should send QueryCommand with KeyConditionExpression for pk only', async () => {
        // Arrange
        dynamoDBMock.on(QueryCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          KeyConditionExpression: 'pk = :pkValue',
          ExpressionAttributeValues: marshall({ ':pkValue': 'partition-key' }),
        }

        // Act
        await client.send(new QueryCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(QueryCommand, {
          TableName: 'test-table',
          KeyConditionExpression: 'pk = :pkValue',
        })
      })

      it('should send QueryCommand with KeyConditionExpression for pk and sk', async () => {
        // Arrange
        dynamoDBMock.on(QueryCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          KeyConditionExpression: 'pk = :pkValue AND begins_with(sk, :skPrefix)',
          ExpressionAttributeValues: marshall({
            ':pkValue': 'partition-key',
            ':skPrefix': 'prefix',
          }),
        }

        // Act
        await client.send(new QueryCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(QueryCommand, {
          KeyConditionExpression: 'pk = :pkValue AND begins_with(sk, :skPrefix)',
        })
      })

      it('should send QueryCommand with FilterExpression', async () => {
        // Arrange
        dynamoDBMock.on(QueryCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          KeyConditionExpression: 'pk = :pkValue',
          FilterExpression: '#status = :statusValue',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: marshall({
            ':pkValue': 'pk',
            ':statusValue': 'active',
          }),
        }

        // Act
        await client.send(new QueryCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(QueryCommand, {
          FilterExpression: '#status = :statusValue',
          ExpressionAttributeNames: { '#status': 'status' },
        })
      })

      it('should send QueryCommand with Limit and ScanIndexForward', async () => {
        // Arrange
        dynamoDBMock.on(QueryCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          KeyConditionExpression: 'pk = :pkValue',
          ExpressionAttributeValues: marshall({ ':pkValue': 'pk' }),
          Limit: 10,
          ScanIndexForward: false,
        }

        // Act
        await client.send(new QueryCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(QueryCommand, {
          Limit: 10,
          ScanIndexForward: false,
        })
      })

      it('should send QueryCommand with IndexName (GSI)', async () => {
        // Arrange
        dynamoDBMock.on(QueryCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          IndexName: 'gsi-index',
          KeyConditionExpression: 'gsiPk = :gsiPkValue',
          ExpressionAttributeValues: marshall({ ':gsiPkValue': 'gsi-pk' }),
        }

        // Act
        await client.send(new QueryCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(QueryCommand, {
          IndexName: 'gsi-index',
        })
      })
    })

    describe('Return Values - Items', () => {
      it('should return Items array', async () => {
        // Arrange
        const items = [
          { pk: 'pk', sk: 'sk1', data: 'value1' },
          { pk: 'pk', sk: 'sk2', data: 'value2' },
          { pk: 'pk', sk: 'sk3', data: 'value3' },
        ]
        dynamoDBMock.on(QueryCommand).resolves({
          Items: items.map((item) => marshall(item)),
          Count: 3,
          ScannedCount: 3,
        })

        // Act
        const result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pkValue',
            ExpressionAttributeValues: marshall({ ':pkValue': 'pk' }),
          }),
        )

        // Assert
        expect(result.Items).toHaveLength(3)
        expect(result.Count).toBe(3)
        expect(result.ScannedCount).toBe(3)
        const unmarshalledItems = result.Items!.map((item) => unmarshall(item))
        expect(unmarshalledItems[0].data).toBe('value1')
        expect(unmarshalledItems[1].data).toBe('value2')
        expect(unmarshalledItems[2].data).toBe('value3')
      })

      it('should return empty Items array when no matches', async () => {
        // Arrange
        dynamoDBMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0,
          ScannedCount: 0,
        })

        // Act
        const result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pkValue',
            ExpressionAttributeValues: marshall({ ':pkValue': 'non-existent' }),
          }),
        )

        // Assert
        expect(result.Items).toEqual([])
        expect(result.Count).toBe(0)
      })

      it('should return LastEvaluatedKey for pagination', async () => {
        // Arrange
        const lastKey = { pk: 'pk', sk: 'sk10' }
        dynamoDBMock.on(QueryCommand).resolves({
          Items: [marshall({ pk: 'pk', sk: 'sk10' })],
          LastEvaluatedKey: marshall(lastKey),
        })

        // Act
        const result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pkValue',
            ExpressionAttributeValues: marshall({ ':pkValue': 'pk' }),
            Limit: 1,
          }),
        )

        // Assert
        expect(result.LastEvaluatedKey).toBeDefined()
        expect(unmarshall(result.LastEvaluatedKey!)).toEqual(lastKey)
      })
    })

    describe('Error Cases', () => {
      it('should throw ValidationException for invalid KeyConditionExpression', async () => {
        // Arrange
        const error = new Error('Invalid KeyConditionExpression')
        error.name = 'ValidationException'
        dynamoDBMock.on(QueryCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new QueryCommand({
              TableName: 'test-table',
              KeyConditionExpression: 'invalid expression',
              ExpressionAttributeValues: {},
            }),
          ),
        ).rejects.toThrow('Invalid KeyConditionExpression')
      })
    })
  })

  // ============================================================================
  // ScanCommand Tests
  // ============================================================================
  describe('ScanCommand', () => {
    describe('Input Parameters - FilterExpression', () => {
      it('should send ScanCommand with TableName only', async () => {
        // Arrange
        dynamoDBMock.on(ScanCommand).resolves({ Items: [] })

        // Act
        await client.send(new ScanCommand({ TableName: 'test-table' }))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(ScanCommand, {
          TableName: 'test-table',
        })
      })

      it('should send ScanCommand with FilterExpression', async () => {
        // Arrange
        dynamoDBMock.on(ScanCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          FilterExpression: '#status = :statusValue AND #type = :typeValue',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#type': 'type',
          },
          ExpressionAttributeValues: marshall({
            ':statusValue': 'active',
            ':typeValue': 'user',
          }),
        }

        // Act
        await client.send(new ScanCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(ScanCommand, {
          FilterExpression: '#status = :statusValue AND #type = :typeValue',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#type': 'type',
          },
        })
      })

      it('should send ScanCommand with Limit and ExclusiveStartKey', async () => {
        // Arrange
        dynamoDBMock.on(ScanCommand).resolves({ Items: [] })

        const startKey = { pk: 'pk', sk: 'sk' }
        const params = {
          TableName: 'test-table',
          Limit: 100,
          ExclusiveStartKey: marshall(startKey),
        }

        // Act
        await client.send(new ScanCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(ScanCommand, {
          Limit: 100,
          ExclusiveStartKey: marshall(startKey),
        })
      })

      it('should send ScanCommand with ProjectionExpression', async () => {
        // Arrange
        dynamoDBMock.on(ScanCommand).resolves({ Items: [] })

        const params = {
          TableName: 'test-table',
          ProjectionExpression: 'pk, sk, #name',
          ExpressionAttributeNames: { '#name': 'name' },
        }

        // Act
        await client.send(new ScanCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(ScanCommand, {
          ProjectionExpression: 'pk, sk, #name',
        })
      })
    })

    describe('Return Values', () => {
      it('should return Items, Count, and ScannedCount', async () => {
        // Arrange
        const items = [
          { pk: 'pk1', sk: 'sk1', status: 'active' },
          { pk: 'pk2', sk: 'sk2', status: 'active' },
        ]
        dynamoDBMock.on(ScanCommand).resolves({
          Items: items.map((item) => marshall(item)),
          Count: 2,
          ScannedCount: 10,
        })

        // Act
        const result = await client.send(
          new ScanCommand({
            TableName: 'test-table',
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: marshall({ ':status': 'active' }),
          }),
        )

        // Assert
        expect(result.Items).toHaveLength(2)
        expect(result.Count).toBe(2)
        expect(result.ScannedCount).toBe(10)
      })

      it('should return LastEvaluatedKey for pagination', async () => {
        // Arrange
        const lastKey = { pk: 'pk100', sk: 'sk100' }
        dynamoDBMock.on(ScanCommand).resolves({
          Items: [],
          LastEvaluatedKey: marshall(lastKey),
        })

        // Act
        const result = await client.send(
          new ScanCommand({
            TableName: 'test-table',
            Limit: 100,
          }),
        )

        // Assert
        expect(result.LastEvaluatedKey).toBeDefined()
        expect(unmarshall(result.LastEvaluatedKey!)).toEqual(lastKey)
      })
    })

    describe('Error Cases', () => {
      it('should throw ProvisionedThroughputExceededException', async () => {
        // Arrange
        const error = new Error('Throughput exceeded')
        error.name = 'ProvisionedThroughputExceededException'
        dynamoDBMock.on(ScanCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(new ScanCommand({ TableName: 'test-table' })),
        ).rejects.toThrow('Throughput exceeded')
      })
    })
  })

  // ============================================================================
  // UpdateItemCommand Tests
  // ============================================================================
  describe('UpdateItemCommand', () => {
    describe('Input Parameters - UpdateExpression', () => {
      it('should send UpdateItemCommand with SET expression', async () => {
        // Arrange
        dynamoDBMock.on(UpdateItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          UpdateExpression: 'SET #name = :name, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#name': 'name',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: marshall({
            ':name': 'new-name',
            ':updatedAt': new Date().toISOString(),
          }),
        }

        // Act
        await client.send(new UpdateItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(UpdateItemCommand, {
          TableName: 'test-table',
          UpdateExpression: 'SET #name = :name, #updatedAt = :updatedAt',
        })
      })

      it('should send UpdateItemCommand with ADD expression', async () => {
        // Arrange
        dynamoDBMock.on(UpdateItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          UpdateExpression: 'ADD #count :increment',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: marshall({ ':increment': 1 }),
        }

        // Act
        await client.send(new UpdateItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(UpdateItemCommand, {
          UpdateExpression: 'ADD #count :increment',
        })
      })

      it('should send UpdateItemCommand with REMOVE expression', async () => {
        // Arrange
        dynamoDBMock.on(UpdateItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          UpdateExpression: 'REMOVE #obsoleteField',
          ExpressionAttributeNames: { '#obsoleteField': 'obsoleteField' },
        }

        // Act
        await client.send(new UpdateItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(UpdateItemCommand, {
          UpdateExpression: 'REMOVE #obsoleteField',
        })
      })

      it('should send UpdateItemCommand with ConditionExpression', async () => {
        // Arrange
        dynamoDBMock.on(UpdateItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          UpdateExpression: 'SET #version = :newVersion',
          ConditionExpression: '#version = :currentVersion',
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: marshall({
            ':newVersion': 2,
            ':currentVersion': 1,
          }),
        }

        // Act
        await client.send(new UpdateItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(UpdateItemCommand, {
          ConditionExpression: '#version = :currentVersion',
        })
      })
    })

    describe('Return Values - Attributes', () => {
      it('should return Attributes with UPDATED_NEW', async () => {
        // Arrange
        const updatedAttributes = { name: 'new-name', version: 2 }
        dynamoDBMock.on(UpdateItemCommand).resolves({
          Attributes: marshall(updatedAttributes),
        })

        // Act
        const result = await client.send(
          new UpdateItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'pk', sk: 'sk' }),
            UpdateExpression: 'SET #name = :name, #version = :version',
            ExpressionAttributeNames: { '#name': 'name', '#version': 'version' },
            ExpressionAttributeValues: marshall({
              ':name': 'new-name',
              ':version': 2,
            }),
            ReturnValues: 'UPDATED_NEW',
          }),
        )

        // Assert
        expect(result.Attributes).toBeDefined()
        expect(unmarshall(result.Attributes!)).toEqual(updatedAttributes)
      })

      it('should return Attributes with ALL_NEW', async () => {
        // Arrange
        const allAttributes = {
          pk: 'pk',
          sk: 'sk',
          name: 'new-name',
          version: 2,
          createdAt: '2024-01-01',
        }
        dynamoDBMock.on(UpdateItemCommand).resolves({
          Attributes: marshall(allAttributes),
        })

        // Act
        const result = await client.send(
          new UpdateItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'pk', sk: 'sk' }),
            UpdateExpression: 'SET #name = :name',
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: marshall({ ':name': 'new-name' }),
            ReturnValues: 'ALL_NEW',
          }),
        )

        // Assert
        expect(result.Attributes).toBeDefined()
        expect(unmarshall(result.Attributes!)).toEqual(allAttributes)
      })

      it('should return Attributes with ALL_OLD', async () => {
        // Arrange
        const oldAttributes = {
          pk: 'pk',
          sk: 'sk',
          name: 'old-name',
          version: 1,
        }
        dynamoDBMock.on(UpdateItemCommand).resolves({
          Attributes: marshall(oldAttributes),
        })

        // Act
        const result = await client.send(
          new UpdateItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'pk', sk: 'sk' }),
            UpdateExpression: 'SET #name = :name',
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: marshall({ ':name': 'new-name' }),
            ReturnValues: 'ALL_OLD',
          }),
        )

        // Assert
        expect(result.Attributes).toBeDefined()
        expect(unmarshall(result.Attributes!)).toEqual(oldAttributes)
      })
    })

    describe('Error Cases', () => {
      it('should throw ConditionalCheckFailedException', async () => {
        // Arrange
        const error = new Error('The conditional request failed')
        error.name = 'ConditionalCheckFailedException'
        dynamoDBMock.on(UpdateItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new UpdateItemCommand({
              TableName: 'test-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
              UpdateExpression: 'SET #version = :newVersion',
              ConditionExpression: '#version = :currentVersion',
              ExpressionAttributeNames: { '#version': 'version' },
              ExpressionAttributeValues: marshall({
                ':newVersion': 2,
                ':currentVersion': 1,
              }),
            }),
          ),
        ).rejects.toThrow('The conditional request failed')
      })
    })
  })

  // ============================================================================
  // DeleteItemCommand Tests
  // ============================================================================
  describe('DeleteItemCommand', () => {
    describe('Input Parameters - Key', () => {
      it('should send DeleteItemCommand with TableName and Key', async () => {
        // Arrange
        dynamoDBMock.on(DeleteItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'partition-key', sk: 'sort-key' }),
        }

        // Act
        await client.send(new DeleteItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(DeleteItemCommand, {
          TableName: 'test-table',
          Key: {
            pk: { S: 'partition-key' },
            sk: { S: 'sort-key' },
          },
        })
      })

      it('should send DeleteItemCommand with ConditionExpression', async () => {
        // Arrange
        dynamoDBMock.on(DeleteItemCommand).resolves({})

        const params = {
          TableName: 'test-table',
          Key: marshall({ pk: 'pk', sk: 'sk' }),
          ConditionExpression: 'attribute_exists(pk)',
        }

        // Act
        await client.send(new DeleteItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(DeleteItemCommand, {
          ConditionExpression: 'attribute_exists(pk)',
        })
      })
    })

    describe('Return Values - Success/Failure', () => {
      it('should return success with httpStatusCode 200', async () => {
        // Arrange
        dynamoDBMock.on(DeleteItemCommand).resolves({
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new DeleteItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'pk', sk: 'sk' }),
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })

      it('should return old attributes with ReturnValues ALL_OLD', async () => {
        // Arrange
        const deletedItem = { pk: 'pk', sk: 'sk', data: 'deleted-data' }
        dynamoDBMock.on(DeleteItemCommand).resolves({
          Attributes: marshall(deletedItem),
        })

        // Act
        const result = await client.send(
          new DeleteItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'pk', sk: 'sk' }),
            ReturnValues: 'ALL_OLD',
          }),
        )

        // Assert
        expect(result.Attributes).toBeDefined()
        expect(unmarshall(result.Attributes!)).toEqual(deletedItem)
      })

      it('should return empty Attributes when item does not exist', async () => {
        // Arrange
        dynamoDBMock.on(DeleteItemCommand).resolves({
          Attributes: undefined,
        })

        // Act
        const result = await client.send(
          new DeleteItemCommand({
            TableName: 'test-table',
            Key: marshall({ pk: 'non-existent', sk: 'key' }),
            ReturnValues: 'ALL_OLD',
          }),
        )

        // Assert
        expect(result.Attributes).toBeUndefined()
      })
    })

    describe('Error Cases', () => {
      it('should throw ConditionalCheckFailedException', async () => {
        // Arrange
        const error = new Error('The conditional request failed')
        error.name = 'ConditionalCheckFailedException'
        dynamoDBMock.on(DeleteItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DeleteItemCommand({
              TableName: 'test-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
              ConditionExpression: 'attribute_exists(pk)',
            }),
          ),
        ).rejects.toThrow('The conditional request failed')
      })

      it('should throw ResourceNotFoundException', async () => {
        // Arrange
        const error = new Error('Requested resource not found')
        error.name = 'ResourceNotFoundException'
        dynamoDBMock.on(DeleteItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DeleteItemCommand({
              TableName: 'non-existent-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          ),
        ).rejects.toThrow('Requested resource not found')
      })
    })
  })

  // ============================================================================
  // BatchWriteItemCommand Tests
  // ============================================================================
  describe('BatchWriteItemCommand', () => {
    describe('Input Parameters - Multiple Items', () => {
      it('should send BatchWriteItemCommand with PutRequest items', async () => {
        // Arrange
        dynamoDBMock.on(BatchWriteItemCommand).resolves({})

        const items = [
          { pk: 'pk1', sk: 'sk1', data: 'data1' },
          { pk: 'pk2', sk: 'sk2', data: 'data2' },
          { pk: 'pk3', sk: 'sk3', data: 'data3' },
        ]

        const params = {
          RequestItems: {
            'test-table': items.map((item) => ({
              PutRequest: { Item: marshall(item) },
            })),
          },
        }

        // Act
        await client.send(new BatchWriteItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
          RequestItems: {
            'test-table': expect.arrayContaining([
              expect.objectContaining({
                PutRequest: expect.objectContaining({
                  Item: expect.objectContaining({
                    pk: { S: 'pk1' },
                  }),
                }),
              }),
            ]),
          },
        })
      })

      it('should send BatchWriteItemCommand with DeleteRequest items', async () => {
        // Arrange
        dynamoDBMock.on(BatchWriteItemCommand).resolves({})

        const keysToDelete = [
          { pk: 'pk1', sk: 'sk1' },
          { pk: 'pk2', sk: 'sk2' },
        ]

        const params = {
          RequestItems: {
            'test-table': keysToDelete.map((key) => ({
              DeleteRequest: { Key: marshall(key) },
            })),
          },
        }

        // Act
        await client.send(new BatchWriteItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
          RequestItems: {
            'test-table': expect.arrayContaining([
              expect.objectContaining({
                DeleteRequest: expect.objectContaining({
                  Key: expect.objectContaining({
                    pk: { S: 'pk1' },
                  }),
                }),
              }),
            ]),
          },
        })
      })

      it('should send BatchWriteItemCommand with mixed Put and Delete requests', async () => {
        // Arrange
        dynamoDBMock.on(BatchWriteItemCommand).resolves({})

        const params = {
          RequestItems: {
            'test-table': [
              { PutRequest: { Item: marshall({ pk: 'pk1', sk: 'sk1', data: 'new' }) } },
              { DeleteRequest: { Key: marshall({ pk: 'pk2', sk: 'sk2' }) } },
            ],
          },
        }

        // Act
        await client.send(new BatchWriteItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommand(BatchWriteItemCommand)
      })

      it('should send BatchWriteItemCommand to multiple tables', async () => {
        // Arrange
        dynamoDBMock.on(BatchWriteItemCommand).resolves({})

        const params = {
          RequestItems: {
            'table-1': [{ PutRequest: { Item: marshall({ pk: 'pk1', sk: 'sk1' }) } }],
            'table-2': [{ PutRequest: { Item: marshall({ pk: 'pk2', sk: 'sk2' }) } }],
          },
        }

        // Act
        await client.send(new BatchWriteItemCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
          RequestItems: expect.objectContaining({
            'table-1': expect.any(Array),
            'table-2': expect.any(Array),
          }),
        })
      })
    })

    describe('Return Values', () => {
      it('should return empty UnprocessedItems on success', async () => {
        // Arrange
        dynamoDBMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {},
        })

        // Act
        const result = await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              'test-table': [
                { PutRequest: { Item: marshall({ pk: 'pk', sk: 'sk' }) } },
              ],
            },
          }),
        )

        // Assert
        expect(result.UnprocessedItems).toEqual({})
      })

      it('should return UnprocessedItems when some items fail', async () => {
        // Arrange
        const unprocessedItem = { pk: 'pk2', sk: 'sk2', data: 'data2' }
        dynamoDBMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {
            'test-table': [{ PutRequest: { Item: marshall(unprocessedItem) } }],
          },
        })

        // Act
        const result = await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              'test-table': [
                { PutRequest: { Item: marshall({ pk: 'pk1', sk: 'sk1' }) } },
                { PutRequest: { Item: marshall(unprocessedItem) } },
              ],
            },
          }),
        )

        // Assert
        expect(result.UnprocessedItems).toBeDefined()
        expect(result.UnprocessedItems!['test-table']).toHaveLength(1)
      })
    })

    describe('Error Cases', () => {
      it('should throw ValidationException for too many items (>25)', async () => {
        // Arrange
        const error = new Error('Too many items in batch write')
        error.name = 'ValidationException'
        dynamoDBMock.on(BatchWriteItemCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new BatchWriteItemCommand({
              RequestItems: {
                'test-table': Array.from({ length: 26 }, (_, i) => ({
                  PutRequest: { Item: marshall({ pk: `pk${i}`, sk: `sk${i}` }) },
                })),
              },
            }),
          ),
        ).rejects.toThrow('Too many items in batch write')
      })
    })
  })

  // ============================================================================
  // TransactWriteItemsCommand Tests
  // ============================================================================
  describe('TransactWriteItemsCommand', () => {
    describe('Input Parameters - Transaction Write', () => {
      it('should send TransactWriteItemsCommand with Put items', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({})

        const params = {
          TransactItems: [
            {
              Put: {
                TableName: 'test-table',
                Item: marshall({ pk: 'pk1', sk: 'sk1', data: 'data1' }),
              },
            },
            {
              Put: {
                TableName: 'test-table',
                Item: marshall({ pk: 'pk2', sk: 'sk2', data: 'data2' }),
              },
            },
          ],
        }

        // Act
        await client.send(new TransactWriteItemsCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(TransactWriteItemsCommand, {
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              Put: expect.objectContaining({
                TableName: 'test-table',
              }),
            }),
          ]),
        })
      })

      it('should send TransactWriteItemsCommand with Update items', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({})

        const params = {
          TransactItems: [
            {
              Update: {
                TableName: 'test-table',
                Key: marshall({ pk: 'pk', sk: 'sk' }),
                UpdateExpression: 'SET #count = #count + :increment',
                ExpressionAttributeNames: { '#count': 'count' },
                ExpressionAttributeValues: marshall({ ':increment': 1 }),
              },
            },
          ],
        }

        // Act
        await client.send(new TransactWriteItemsCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(TransactWriteItemsCommand, {
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              Update: expect.objectContaining({
                UpdateExpression: 'SET #count = #count + :increment',
              }),
            }),
          ]),
        })
      })

      it('should send TransactWriteItemsCommand with Delete items', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({})

        const params = {
          TransactItems: [
            {
              Delete: {
                TableName: 'test-table',
                Key: marshall({ pk: 'pk', sk: 'sk' }),
              },
            },
          ],
        }

        // Act
        await client.send(new TransactWriteItemsCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(TransactWriteItemsCommand, {
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              Delete: expect.objectContaining({
                TableName: 'test-table',
              }),
            }),
          ]),
        })
      })

      it('should send TransactWriteItemsCommand with ConditionCheck', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({})

        const params = {
          TransactItems: [
            {
              ConditionCheck: {
                TableName: 'test-table',
                Key: marshall({ pk: 'pk', sk: 'sk' }),
                ConditionExpression: 'attribute_exists(pk)',
              },
            },
            {
              Put: {
                TableName: 'test-table',
                Item: marshall({ pk: 'pk2', sk: 'sk2' }),
              },
            },
          ],
        }

        // Act
        await client.send(new TransactWriteItemsCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(TransactWriteItemsCommand, {
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              ConditionCheck: expect.objectContaining({
                ConditionExpression: 'attribute_exists(pk)',
              }),
            }),
          ]),
        })
      })

      it('should send TransactWriteItemsCommand with ClientRequestToken', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({})

        const params = {
          TransactItems: [
            {
              Put: {
                TableName: 'test-table',
                Item: marshall({ pk: 'pk', sk: 'sk' }),
              },
            },
          ],
          ClientRequestToken: 'idempotency-token-123',
        }

        // Act
        await client.send(new TransactWriteItemsCommand(params))

        // Assert
        expect(dynamoDBMock).toHaveReceivedCommandWith(TransactWriteItemsCommand, {
          ClientRequestToken: 'idempotency-token-123',
        })
      })
    })

    describe('Return Values', () => {
      it('should return success with httpStatusCode 200', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new TransactWriteItemsCommand({
            TransactItems: [
              {
                Put: {
                  TableName: 'test-table',
                  Item: marshall({ pk: 'pk', sk: 'sk' }),
                },
              },
            ],
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })

      it('should return ConsumedCapacity when requested', async () => {
        // Arrange
        dynamoDBMock.on(TransactWriteItemsCommand).resolves({
          ConsumedCapacity: [
            {
              TableName: 'test-table',
              CapacityUnits: 2,
            },
          ],
        })

        // Act
        const result = await client.send(
          new TransactWriteItemsCommand({
            TransactItems: [
              {
                Put: {
                  TableName: 'test-table',
                  Item: marshall({ pk: 'pk', sk: 'sk' }),
                },
              },
            ],
            ReturnConsumedCapacity: 'TOTAL',
          }),
        )

        // Assert
        expect(result.ConsumedCapacity).toBeDefined()
        expect(result.ConsumedCapacity![0].TableName).toBe('test-table')
        expect(result.ConsumedCapacity![0].CapacityUnits).toBe(2)
      })
    })

    describe('Error Cases', () => {
      it('should throw TransactionCanceledException', async () => {
        // Arrange
        const error = new Error('Transaction cancelled')
        error.name = 'TransactionCanceledException'
        dynamoDBMock.on(TransactWriteItemsCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new TransactWriteItemsCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: 'test-table',
                    Item: marshall({ pk: 'pk', sk: 'sk' }),
                    ConditionExpression: 'attribute_not_exists(pk)',
                  },
                },
              ],
            }),
          ),
        ).rejects.toThrow('Transaction cancelled')
      })

      it('should throw ValidationException for too many items (>100)', async () => {
        // Arrange
        const error = new Error('Too many items in transaction')
        error.name = 'ValidationException'
        dynamoDBMock.on(TransactWriteItemsCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new TransactWriteItemsCommand({
              TransactItems: Array.from({ length: 101 }, (_, i) => ({
                Put: {
                  TableName: 'test-table',
                  Item: marshall({ pk: `pk${i}`, sk: `sk${i}` }),
                },
              })),
            }),
          ),
        ).rejects.toThrow('Too many items in transaction')
      })

      it('should throw IdempotentParameterMismatchException', async () => {
        // Arrange
        const error = new Error('Idempotent parameter mismatch')
        error.name = 'IdempotentParameterMismatchException'
        dynamoDBMock.on(TransactWriteItemsCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new TransactWriteItemsCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: 'test-table',
                    Item: marshall({ pk: 'pk', sk: 'sk' }),
                  },
                },
              ],
              ClientRequestToken: 'same-token-different-content',
            }),
          ),
        ).rejects.toThrow('Idempotent parameter mismatch')
      })
    })
  })
})
