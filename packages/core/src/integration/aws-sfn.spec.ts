/**
 * AWS Step Functions Client Integration Tests
 *
 * This file tests the AWS SDK Step Functions client commands using aws-sdk-client-mock.
 * It covers input parameters (IN) and return values (OUT) for each command.
 */
import {
  DescribeExecutionCommand,
  ExecutionStatus,
  SFNClient,
  StartExecutionCommand,
  StopExecutionCommand,
} from '@aws-sdk/client-sfn'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS Step Functions Client Commands', () => {
  const sfnMock = mockClient(SFNClient)
  const client = new SFNClient({ region: 'ap-northeast-1' })

  beforeEach(() => {
    sfnMock.reset()
  })

  afterEach(() => {
    sfnMock.reset()
  })

  // ============================================================================
  // StartExecutionCommand Tests
  // ============================================================================
  describe('StartExecutionCommand', () => {
    describe('Input Parameters - stateMachineArn, input', () => {
      it('should send StartExecutionCommand with stateMachineArn and input', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:execution-1'
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn,
          startDate: new Date('2024-01-15T10:30:00Z'),
        })

        const params = {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          input: JSON.stringify({ orderId: '12345', action: 'process' }),
        }

        // Act
        await client.send(new StartExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          input: JSON.stringify({ orderId: '12345', action: 'process' }),
        })
      })

      it('should send StartExecutionCommand with name for custom execution name', async () => {
        // Arrange
        const executionName = 'order-12345-process-v1'
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: `arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:${executionName}`,
          startDate: new Date(),
        })

        const params = {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: executionName,
          input: JSON.stringify({ orderId: '12345' }),
        }

        // Act
        await client.send(new StartExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
          name: executionName,
        })
      })

      it('should send StartExecutionCommand with traceHeader for X-Ray tracing', async () => {
        // Arrange
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:traced-execution',
          startDate: new Date(),
        })

        const traceHeader = 'Root=1-5f4a0a0a-0000000000000000;Parent=0000000000000000;Sampled=1'
        const params = {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          input: JSON.stringify({ data: 'value' }),
          traceHeader,
        }

        // Act
        await client.send(new StartExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
          traceHeader,
        })
      })

      it('should send StartExecutionCommand with complex input object', async () => {
        // Arrange
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:complex-input',
          startDate: new Date(),
        })

        const complexInput = {
          pk: 'tenantCode#entity',
          sk: 'item-123@1',
          attributes: {
            name: 'Test Item',
            metadata: {
              createdAt: '2024-01-15T10:30:00Z',
              tags: ['tag1', 'tag2', 'tag3'],
            },
          },
          dynamodb: {
            Keys: { pk: { S: 'tenantCode#entity' }, sk: { S: 'item-123@1' } },
            NewImage: {
              pk: { S: 'tenantCode#entity' },
              version: { N: '1' },
            },
          },
        }

        const params = {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:DataSyncStateMachine',
          input: JSON.stringify(complexInput),
        }

        // Act
        await client.send(new StartExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
          input: JSON.stringify(complexInput),
        })
      })

      it('should send StartExecutionCommand without input (optional)', async () => {
        // Arrange
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:no-input',
          startDate: new Date(),
        })

        const params = {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
        }

        // Act
        await client.send(new StartExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
        })
      })
    })

    describe('Return Values - executionArn', () => {
      it('should return executionArn on successful start', async () => {
        // Arrange
        const expectedExecutionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:execution-abc123'
        const startDate = new Date('2024-01-15T10:30:00Z')
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: expectedExecutionArn,
          startDate,
        })

        // Act
        const result = await client.send(
          new StartExecutionCommand({
            stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
            input: JSON.stringify({ data: 'value' }),
          }),
        )

        // Assert
        expect(result.executionArn).toBe(expectedExecutionArn)
        expect(result.startDate).toEqual(startDate)
      })

      it('should return executionArn with custom name', async () => {
        // Arrange
        const customName = 'order-processing-12345'
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: `arn:aws:states:ap-northeast-1:123456789012:execution:OrderProcessing:${customName}`,
          startDate: new Date(),
        })

        // Act
        const result = await client.send(
          new StartExecutionCommand({
            stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:OrderProcessing',
            name: customName,
            input: JSON.stringify({ orderId: '12345' }),
          }),
        )

        // Assert
        expect(result.executionArn).toContain(customName)
      })

      it('should return $metadata with httpStatusCode', async () => {
        // Arrange
        sfnMock.on(StartExecutionCommand).resolves({
          executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:exec-1',
          startDate: new Date(),
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new StartExecutionCommand({
            stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })
    })

    describe('Error Cases', () => {
      it('should throw StateMachineDoesNotExist when state machine not found', async () => {
        // Arrange
        const error = new Error('State Machine Does Not Exist')
        error.name = 'StateMachineDoesNotExist'
        sfnMock.on(StartExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:NonExistent',
              input: JSON.stringify({ data: 'value' }),
            }),
          ),
        ).rejects.toThrow('State Machine Does Not Exist')
      })

      it('should throw ExecutionAlreadyExists when execution name is duplicated', async () => {
        // Arrange
        const error = new Error('Execution Already Exists')
        error.name = 'ExecutionAlreadyExists'
        sfnMock.on(StartExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
              name: 'duplicate-execution-name',
              input: JSON.stringify({ data: 'value' }),
            }),
          ),
        ).rejects.toThrow('Execution Already Exists')
      })

      it('should throw InvalidArn for malformed state machine ARN', async () => {
        // Arrange
        const error = new Error('Invalid Arn')
        error.name = 'InvalidArn'
        sfnMock.on(StartExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StartExecutionCommand({
              stateMachineArn: 'invalid-arn',
              input: JSON.stringify({ data: 'value' }),
            }),
          ),
        ).rejects.toThrow('Invalid Arn')
      })

      it('should throw InvalidExecutionInput for invalid JSON input', async () => {
        // Arrange
        const error = new Error('Invalid Execution Input')
        error.name = 'InvalidExecutionInput'
        sfnMock.on(StartExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
              input: 'not valid json {',
            }),
          ),
        ).rejects.toThrow('Invalid Execution Input')
      })

      it('should throw ExecutionLimitExceeded when too many concurrent executions', async () => {
        // Arrange
        const error = new Error('Execution Limit Exceeded')
        error.name = 'ExecutionLimitExceeded'
        sfnMock.on(StartExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
              input: JSON.stringify({ data: 'value' }),
            }),
          ),
        ).rejects.toThrow('Execution Limit Exceeded')
      })

      it('should throw InvalidName for invalid execution name characters', async () => {
        // Arrange
        const error = new Error('Invalid Name')
        error.name = 'InvalidName'
        sfnMock.on(StartExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
              name: 'invalid/name/with/slashes',
              input: JSON.stringify({ data: 'value' }),
            }),
          ),
        ).rejects.toThrow('Invalid Name')
      })
    })
  })

  // ============================================================================
  // DescribeExecutionCommand Tests
  // ============================================================================
  describe('DescribeExecutionCommand', () => {
    describe('Input Parameters - executionArn', () => {
      it('should send DescribeExecutionCommand with executionArn', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:execution-1'
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          status: ExecutionStatus.SUCCEEDED,
          startDate: new Date(),
        })

        const params = {
          executionArn,
        }

        // Act
        await client.send(new DescribeExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(DescribeExecutionCommand, {
          executionArn,
        })
      })
    })

    describe('Return Values - Status Check', () => {
      it('should return RUNNING status for in-progress execution', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:running-exec'
        const startDate = new Date('2024-01-15T10:30:00Z')
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: 'running-exec',
          status: ExecutionStatus.RUNNING,
          startDate,
          input: JSON.stringify({ orderId: '12345' }),
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.status).toBe(ExecutionStatus.RUNNING)
        expect(result.executionArn).toBe(executionArn)
        expect(result.startDate).toEqual(startDate)
        expect(result.stopDate).toBeUndefined()
        expect(result.output).toBeUndefined()
      })

      it('should return SUCCEEDED status with output for completed execution', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:succeeded-exec'
        const startDate = new Date('2024-01-15T10:30:00Z')
        const stopDate = new Date('2024-01-15T10:35:00Z')
        const output = { result: 'success', processedItems: 10 }

        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: 'succeeded-exec',
          status: ExecutionStatus.SUCCEEDED,
          startDate,
          stopDate,
          input: JSON.stringify({ orderId: '12345' }),
          output: JSON.stringify(output),
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.status).toBe(ExecutionStatus.SUCCEEDED)
        expect(result.stopDate).toEqual(stopDate)
        expect(result.output).toBe(JSON.stringify(output))
        expect(JSON.parse(result.output!)).toEqual(output)
      })

      it('should return FAILED status with error details', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:failed-exec'
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: 'failed-exec',
          status: ExecutionStatus.FAILED,
          startDate: new Date('2024-01-15T10:30:00Z'),
          stopDate: new Date('2024-01-15T10:32:00Z'),
          input: JSON.stringify({ orderId: '12345' }),
          error: 'States.TaskFailed',
          cause: JSON.stringify({ errorMessage: 'Lambda function failed', errorType: 'LambdaException' }),
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.status).toBe(ExecutionStatus.FAILED)
        expect(result.error).toBe('States.TaskFailed')
        expect(result.cause).toBeDefined()
        expect(JSON.parse(result.cause!).errorMessage).toBe('Lambda function failed')
      })

      it('should return TIMED_OUT status', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:timeout-exec'
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: 'timeout-exec',
          status: ExecutionStatus.TIMED_OUT,
          startDate: new Date('2024-01-15T10:30:00Z'),
          stopDate: new Date('2024-01-15T11:30:00Z'),
          error: 'States.Timeout',
          cause: 'Execution exceeded timeout of 3600 seconds',
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.status).toBe(ExecutionStatus.TIMED_OUT)
        expect(result.error).toBe('States.Timeout')
      })

      it('should return ABORTED status for stopped execution', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:aborted-exec'
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: 'aborted-exec',
          status: ExecutionStatus.ABORTED,
          startDate: new Date('2024-01-15T10:30:00Z'),
          stopDate: new Date('2024-01-15T10:31:00Z'),
          error: 'Execution was aborted',
          cause: 'User requested stop',
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.status).toBe(ExecutionStatus.ABORTED)
      })

      it('should return PENDING_REDRIVE status', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:pending-redrive'
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: 'pending-redrive',
          status: ExecutionStatus.PENDING_REDRIVE,
          startDate: new Date('2024-01-15T10:30:00Z'),
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.status).toBe(ExecutionStatus.PENDING_REDRIVE)
      })

      it('should return input data as stored', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:input-test'
        const inputData = {
          pk: 'tenantCode#entity',
          sk: 'item-123@1',
          dynamodb: {
            NewImage: { pk: { S: 'value' } },
          },
        }
        sfnMock.on(DescribeExecutionCommand).resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          status: ExecutionStatus.SUCCEEDED,
          startDate: new Date(),
          input: JSON.stringify(inputData),
          inputDetails: {
            included: true,
          },
        })

        // Act
        const result = await client.send(
          new DescribeExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.input).toBe(JSON.stringify(inputData))
        expect(JSON.parse(result.input!)).toEqual(inputData)
        expect(result.inputDetails?.included).toBe(true)
      })
    })

    describe('Error Cases', () => {
      it('should throw ExecutionDoesNotExist when execution not found', async () => {
        // Arrange
        const error = new Error('Execution Does Not Exist')
        error.name = 'ExecutionDoesNotExist'
        sfnMock.on(DescribeExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DescribeExecutionCommand({
              executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:non-existent',
            }),
          ),
        ).rejects.toThrow('Execution Does Not Exist')
      })

      it('should throw InvalidArn for malformed execution ARN', async () => {
        // Arrange
        const error = new Error('Invalid Arn')
        error.name = 'InvalidArn'
        sfnMock.on(DescribeExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DescribeExecutionCommand({
              executionArn: 'invalid-execution-arn',
            }),
          ),
        ).rejects.toThrow('Invalid Arn')
      })
    })
  })

  // ============================================================================
  // StopExecutionCommand Tests
  // ============================================================================
  describe('StopExecutionCommand', () => {
    describe('Input Parameters - Stop Execution', () => {
      it('should send StopExecutionCommand with executionArn', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:running-exec'
        sfnMock.on(StopExecutionCommand).resolves({
          stopDate: new Date('2024-01-15T10:35:00Z'),
        })

        const params = {
          executionArn,
        }

        // Act
        await client.send(new StopExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StopExecutionCommand, {
          executionArn,
        })
      })

      it('should send StopExecutionCommand with error and cause', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:to-stop'
        sfnMock.on(StopExecutionCommand).resolves({
          stopDate: new Date(),
        })

        const params = {
          executionArn,
          error: 'UserCancelled',
          cause: 'User requested cancellation of the order processing workflow',
        }

        // Act
        await client.send(new StopExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StopExecutionCommand, {
          executionArn,
          error: 'UserCancelled',
          cause: 'User requested cancellation of the order processing workflow',
        })
      })

      it('should send StopExecutionCommand with structured cause', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:structured-stop'
        sfnMock.on(StopExecutionCommand).resolves({
          stopDate: new Date(),
        })

        const structuredCause = {
          reason: 'DataValidationFailed',
          details: {
            field: 'orderId',
            message: 'Order ID format is invalid',
          },
          timestamp: new Date().toISOString(),
        }

        const params = {
          executionArn,
          error: 'ValidationError',
          cause: JSON.stringify(structuredCause),
        }

        // Act
        await client.send(new StopExecutionCommand(params))

        // Assert
        expect(sfnMock).toHaveReceivedCommandWith(StopExecutionCommand, {
          cause: JSON.stringify(structuredCause),
        })
      })
    })

    describe('Return Values - Stop Execution', () => {
      it('should return stopDate on successful stop', async () => {
        // Arrange
        const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:stop-test'
        const stopDate = new Date('2024-01-15T10:35:00Z')
        sfnMock.on(StopExecutionCommand).resolves({
          stopDate,
        })

        // Act
        const result = await client.send(
          new StopExecutionCommand({
            executionArn,
          }),
        )

        // Assert
        expect(result.stopDate).toEqual(stopDate)
      })

      it('should return $metadata with httpStatusCode', async () => {
        // Arrange
        sfnMock.on(StopExecutionCommand).resolves({
          stopDate: new Date(),
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new StopExecutionCommand({
            executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:stop-test',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })
    })

    describe('Error Cases', () => {
      it('should throw ExecutionDoesNotExist when execution not found', async () => {
        // Arrange
        const error = new Error('Execution Does Not Exist')
        error.name = 'ExecutionDoesNotExist'
        sfnMock.on(StopExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StopExecutionCommand({
              executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:non-existent',
            }),
          ),
        ).rejects.toThrow('Execution Does Not Exist')
      })

      it('should throw InvalidArn for malformed execution ARN', async () => {
        // Arrange
        const error = new Error('Invalid Arn')
        error.name = 'InvalidArn'
        sfnMock.on(StopExecutionCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new StopExecutionCommand({
              executionArn: 'invalid-arn',
            }),
          ),
        ).rejects.toThrow('Invalid Arn')
      })

      it('should handle stopping already completed execution', async () => {
        // Note: AWS SFN allows stopping already completed executions (no-op)
        sfnMock.on(StopExecutionCommand).resolves({
          stopDate: new Date('2024-01-15T10:30:00Z'), // Original completion time
        })

        // Act
        const result = await client.send(
          new StopExecutionCommand({
            executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:already-completed',
          }),
        )

        // Assert
        expect(result.stopDate).toBeDefined()
      })
    })
  })

  // ============================================================================
  // Additional Test Cases for Edge Scenarios
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle concurrent StartExecutionCommand calls', async () => {
      // Arrange
      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:concurrent',
        startDate: new Date(),
      })

      // Act
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.send(
          new StartExecutionCommand({
            stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
            name: `concurrent-exec-${i}`,
            input: JSON.stringify({ index: i }),
          }),
        ),
      )

      const results = await Promise.all(promises)

      // Assert
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.executionArn).toBeDefined()
      })
      expect(sfnMock).toHaveReceivedCommandTimes(StartExecutionCommand, 5)
    })

    it('should handle very long execution names (up to 80 characters)', async () => {
      // Arrange
      const longName = 'a'.repeat(80) // Maximum allowed length
      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: `arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:${longName}`,
        startDate: new Date(),
      })

      // Act
      const result = await client.send(
        new StartExecutionCommand({
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          name: longName,
          input: JSON.stringify({ data: 'value' }),
        }),
      )

      // Assert
      expect(result.executionArn).toContain(longName)
    })

    it('should handle large input payload', async () => {
      // Arrange
      const largeInput = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          data: 'x'.repeat(100),
        })),
      }

      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:large-input',
        startDate: new Date(),
      })

      // Act
      const result = await client.send(
        new StartExecutionCommand({
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          input: JSON.stringify(largeInput),
        }),
      )

      // Assert
      expect(result.executionArn).toBeDefined()
      expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
        input: JSON.stringify(largeInput),
      })
    })

    it('should poll execution status until completion', async () => {
      // Arrange - simulate status progression
      const executionArn = 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:polling-test'

      // Chain resolvesOnce calls for sequential responses
      sfnMock.on(DescribeExecutionCommand)
        // First call: RUNNING
        .resolvesOnce({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          status: ExecutionStatus.RUNNING,
          startDate: new Date(),
        })
        // Second call: RUNNING
        .resolvesOnce({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          status: ExecutionStatus.RUNNING,
          startDate: new Date(),
        })
        // Third call: SUCCEEDED
        .resolves({
          executionArn,
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          status: ExecutionStatus.SUCCEEDED,
          startDate: new Date(),
          stopDate: new Date(),
          output: JSON.stringify({ result: 'done' }),
        })

      // Act - simulate polling
      const result1 = await client.send(new DescribeExecutionCommand({ executionArn }))
      const result2 = await client.send(new DescribeExecutionCommand({ executionArn }))
      const result3 = await client.send(new DescribeExecutionCommand({ executionArn }))

      // Assert
      expect(result1.status).toBe(ExecutionStatus.RUNNING)
      expect(result2.status).toBe(ExecutionStatus.RUNNING)
      expect(result3.status).toBe(ExecutionStatus.SUCCEEDED)
      expect(result3.output).toBe(JSON.stringify({ result: 'done' }))
    })

    it('should handle express state machine execution', async () => {
      // Express state machines have synchronous executions with immediate results
      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: 'arn:aws:states:ap-northeast-1:123456789012:express:ExpressStateMachine:execution-id:random-id',
        startDate: new Date(),
      })

      // Act
      const result = await client.send(
        new StartExecutionCommand({
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:ExpressStateMachine',
          input: JSON.stringify({ data: 'express' }),
        }),
      )

      // Assert
      expect(result.executionArn).toContain('express:')
    })

    it('should handle input with special characters', async () => {
      // Arrange
      const specialInput = {
        message: 'Hello, "World"! Special chars: <>&\'',
        unicode: 'Japanese test message',
        newlines: 'Line 1\nLine 2\rLine 3',
      }

      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:MyStateMachine:special-chars',
        startDate: new Date(),
      })

      // Act
      const result = await client.send(
        new StartExecutionCommand({
          stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:MyStateMachine',
          input: JSON.stringify(specialInput),
        }),
      )

      // Assert
      expect(result.executionArn).toBeDefined()
      expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
        input: JSON.stringify(specialInput),
      })
    })
  })
})
