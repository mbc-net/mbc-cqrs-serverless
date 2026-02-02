# Event Sourcing Pattern

This document describes the Event Sourcing implementation in MBC CQRS Serverless.

## Event Sourcing Overview

```mermaid
flowchart TB
    subgraph EventStore
        ES[(DynamoDB)]
    end

    subgraph EventFlow
        Command[Command]
        Aggregate[Aggregate]
        Event1[Event 1]
        Event2[Event 2]
        Event3[Event 3]
    end

    subgraph Projections
        P1[Read Model A]
        P2[Read Model B]
        P3[Notification Service]
    end

    Command --> Aggregate
    Aggregate --> Event1
    Aggregate --> Event2
    Aggregate --> Event3

    Event1 --> ES
    Event2 --> ES
    Event3 --> ES

    ES --> P1
    ES --> P2
    ES --> P3
```

## Event Lifecycle

```mermaid
sequenceDiagram
    Cmd->>Agg: Execute Command
    Agg->>Agg: Validate Business Rules
    Agg->>Agg: Apply State Change
    Agg->>ES: Store Event
    ES->>SNS: Publish Event
    SNS->>SQS: Fan-out
    SQS->>EH: Trigger Handler
    EH->>RM: Update Projection
```

## DynamoDB Event Store Schema

### Key Structure

- **PK (Partition Key)**: `{TENANT}#{ENTITY_TYPE}` (e.g., `TENANT001#ORDER`)
- **SK (Sort Key)**: `{ENTITY_TYPE}#{ID}` (e.g., `ORDER#20240101-001`)

### Event Record Example

```json
{
  "pk": "TENANT001#ORDER",
  "sk": "ORDER#20240101-001",
  "version": 3,
  "type": "OrderCreated",
  "data": {
    "orderId": "20240101-001",
    "customerId": "CUST-001",
    "items": [],
    "totalAmount": 15000
  },
  "createdAt": "2024-01-01T10:00:00Z",
  "createdBy": "user-123"
}
```

## Optimistic Locking

```mermaid
sequenceDiagram
    C1->>DB: Read v1
    C2->>DB: Read v1
    C1->>DB: Update v1 to v2
    DB-->>C1: Success
    C2->>DB: Update v1 to v2
    DB-->>C2: ConditionalCheckFailed
    C2->>DB: Retry Read v2
    C2->>DB: Update v2 to v3
    DB-->>C2: Success
```

### Version Control Implementation

```typescript
// Command Service automatically handles versioning
await this.commandService.publish(entity, {
  invokeContext: context,
});

// DynamoDB ConditionExpression ensures optimistic locking
// ConditionExpression: 'attribute_not_exists(pk) OR version = :currentVersion'
```

## Event Processing Pipeline

```mermaid
flowchart LR
    subgraph EventSource
        ES[Event Store]
    end

    subgraph MessageBroker
        SNS[SNS Topic]
        SQS1[SQS Queue 1]
        SQS2[SQS Queue 2]
        SQS3[SQS Queue 3]
    end

    subgraph EventHandlers
        EH1[Projection Handler]
        EH2[Notification Handler]
        EH3[Integration Handler]
    end

    subgraph Outputs
        RM[(Read Model)]
        Email[Email Service]
        ExtAPI[External API]
    end

    ES --> SNS
    SNS --> SQS1
    SNS --> SQS2
    SNS --> SQS3

    SQS1 --> EH1
    SQS2 --> EH2
    SQS3 --> EH3

    EH1 --> RM
    EH2 --> Email
    EH3 --> ExtAPI
```

## Event Handler Implementation

```typescript
@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly readModelService: ReadModelService,
  ) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    // Update read model
    await this.readModelService.updateOrderSummary(event);

    // Send notification
    await this.notificationService.sendOrderConfirmation(event);
  }
}
```

## Benefits of Event Sourcing

- **Complete Audit Trail**: Every state change is recorded as an event
- **Time Travel**: Reconstruct state at any point in time
- **Event Replay**: Rebuild projections by replaying events
- **Debugging**: Trace exact sequence of operations
- **Analytics**: Rich event data for business intelligence
- **Integration**: Events can trigger external system updates

## Best Practices

1. **Immutable Events**: Never modify stored events
2. **Idempotent Handlers**: Handle duplicate event delivery gracefully
3. **Event Versioning**: Plan for event schema evolution
4. **Correlation IDs**: Track related events across services
5. **Dead Letter Queues**: Handle failed event processing
