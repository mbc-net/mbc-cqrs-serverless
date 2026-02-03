import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'

/**
 * CQRS implementation guide prompts.
 */

export function getCqrsPrompts(): Prompt[] {
  return [
    {
      name: 'cqrs_implementation_guide',
      description:
        'Get guidance on implementing CQRS patterns with MBC CQRS Serverless framework',
      arguments: [
        {
          name: 'feature_type',
          description:
            'Type of feature to implement (module, entity, command, query, event)',
          required: true,
        },
        {
          name: 'feature_name',
          description: 'Name of the feature (e.g., "Order", "Product")',
          required: true,
        },
      ],
    },
    {
      name: 'debug_command_error',
      description: 'Get help debugging command-related errors',
      arguments: [
        {
          name: 'error_message',
          description: 'The error message you encountered',
          required: true,
        },
        {
          name: 'operation',
          description: 'The operation being performed (create, update, delete)',
          required: false,
        },
      ],
    },
    {
      name: 'migration_guide',
      description: 'Get guidance on migrating between framework versions',
      arguments: [
        {
          name: 'from_version',
          description: 'Current version',
          required: true,
        },
        {
          name: 'to_version',
          description: 'Target version',
          required: true,
        },
      ],
    },
  ]
}

export function getCqrsPromptMessages(
  name: string,
  args: Record<string, string>,
): { messages: PromptMessage[] } {
  const safeArgs = args || {}

  switch (name) {
    case 'cqrs_implementation_guide':
      return getImplementationGuideMessages(
        safeArgs.feature_type || 'module',
        safeArgs.feature_name || 'Example',
      )
    case 'debug_command_error':
      return getDebugCommandMessages(
        safeArgs.error_message || 'Unknown error',
        safeArgs.operation,
      )
    case 'migration_guide':
      return getMigrationGuideMessages(
        safeArgs.from_version || '0.1.0',
        safeArgs.to_version || 'latest',
      )
    default:
      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `Unknown prompt: ${name}` },
          },
        ],
      }
  }
}

function getImplementationGuideMessages(
  featureType: string,
  featureName: string,
): { messages: PromptMessage[] } {
  const guides: Record<string, string> = {
    module: `# Implementing a ${featureName} Module

## Steps

1. **Generate the module structure**:
   \`\`\`bash
   mbc generate module ${featureName.toLowerCase()}
   \`\`\`

2. **Define the entity** in \`src/${featureName.toLowerCase()}/entities/${featureName.toLowerCase()}.entity.ts\`:
   \`\`\`typescript
   import { CommandEntity, DataEntity } from '@mbc-cqrs-serverless/core'

   export class ${featureName}CommandEntity extends CommandEntity {
     // Add your command-specific fields
     name: string
     // ... other fields
   }

   export class ${featureName}DataEntity extends DataEntity {
     // Add your read model fields
     name: string
     // ... other fields
   }
   \`\`\`

3. **Create DTOs** for request validation

4. **Implement the service** with CommandService injection

5. **Register the module** in your AppModule

## Key Patterns

- Use CommandService for write operations
- Use DataService for read operations
- Implement optimistic locking with version field
- Handle events for side effects`,

    entity: `# Implementing a ${featureName} Entity

## Command Entity (Write Model)

\`\`\`typescript
import { CommandEntity, CommandModel } from '@mbc-cqrs-serverless/core'

export class ${featureName}CommandEntity extends CommandEntity implements CommandModel {
  pk: string      // Partition key
  sk: string      // Sort key
  id: string      // Unique identifier
  code: string    // Business code
  name: string    // Display name
  version: number // For optimistic locking
  tenantCode: string

  // Add your business fields
  // ...
}
\`\`\`

## Data Entity (Read Model)

\`\`\`typescript
import { DataEntity, DataModel } from '@mbc-cqrs-serverless/core'

export class ${featureName}DataEntity extends DataEntity implements DataModel {
  pk: string
  sk: string
  id: string
  code: string
  name: string

  // Denormalized fields for efficient queries
  // ...
}
\`\`\`

## Key Points

- Command entity stores the write model (event sourced)
- Data entity stores the read model (denormalized)
- Use proper key patterns: \`pk: 'ENTITY#tenantCode'\`, \`sk: 'ENTITY#id'\``,

    command: `# Implementing Commands for ${featureName}

## Using CommandService

\`\`\`typescript
import { CommandService } from '@mbc-cqrs-serverless/core'

@Injectable()
export class ${featureName}Service {
  constructor(private readonly commandService: CommandService) {}

  // Create (Async - returns immediately, processes in background)
  async createAsync(dto: Create${featureName}Dto, options: IInvoke) {
    const entity = new ${featureName}CommandEntity()
    entity.pk = \`${featureName.toUpperCase()}#\${options.tenantCode}\`
    entity.sk = \`${featureName.toUpperCase()}#\${ulid()}\`
    // ... set other fields

    return this.commandService.publishAsync(entity, options)
  }

  // Create (Sync - waits for completion)
  async createSync(dto: Create${featureName}Dto, options: IInvoke) {
    const entity = new ${featureName}CommandEntity()
    // ... same setup

    return this.commandService.publishSync(entity, options)
  }

  // Update with optimistic locking
  async update(dto: Update${featureName}Dto, options: IInvoke) {
    return this.commandService.publishPartialUpdateAsync({
      pk: dto.pk,
      sk: dto.sk,
      version: dto.version, // Must match current version
      name: dto.name,
      // ... partial updates
    }, options)
  }
}
\`\`\`

## Sync vs Async

- **Async**: Better performance, eventual consistency
- **Sync**: Immediate consistency, slower`,

    query: `# Implementing Queries for ${featureName}

## Using DataService

\`\`\`typescript
import { DataService, SearchDto } from '@mbc-cqrs-serverless/core'

@Injectable()
export class ${featureName}QueryService {
  constructor(private readonly dataService: DataService) {}

  // Get single item
  async getById(pk: string, sk: string) {
    return this.dataService.getItem({ pk, sk })
  }

  // List with pagination
  async list(searchDto: SearchDto, tenantCode: string) {
    return this.dataService.listItemsByPk(
      \`${featureName.toUpperCase()}#\${tenantCode}\`,
      searchDto
    )
  }

  // Search with filters
  async search(searchDto: SearchDto, tenantCode: string) {
    return this.dataService.searchItems({
      pk: \`${featureName.toUpperCase()}#\${tenantCode}\`,
      ...searchDto,
    })
  }
}
\`\`\`

## Key Points

- DataService reads from the denormalized read model
- Use pagination for large result sets
- Implement search filters as needed`,

    event: `# Implementing Events for ${featureName}

## Event Handler

\`\`\`typescript
import { IEventHandler } from '@mbc-cqrs-serverless/core'

@Injectable()
export class ${featureName}CreatedHandler implements IEventHandler {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async execute(event: CommandEntity): Promise<void> {
    // Handle ${featureName} created event
    // - Send notifications
    // - Update related data
    // - Trigger workflows

    await this.notificationService.send({
      type: '${featureName.toLowerCase()}_created',
      data: event,
    })
  }
}
\`\`\`

## Data Sync Handler

\`\`\`typescript
import { IDataSyncHandler, DataEntity } from '@mbc-cqrs-serverless/core'

@Injectable()
export class ${featureName}DataSyncHandler implements IDataSyncHandler {
  async sync(command: CommandEntity): Promise<DataEntity> {
    // Transform command to data entity
    const data = new ${featureName}DataEntity()
    data.pk = command.pk
    data.sk = command.sk
    // ... map fields

    return data
  }
}
\`\`\``,
  }

  const guide =
    guides[featureType] ||
    `Unknown feature type: ${featureType}. Valid types are: module, entity, command, query, event`

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I want to implement a ${featureType} called "${featureName}" using MBC CQRS Serverless framework. Please provide guidance.`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: guide,
        },
      },
    ],
  }
}

function getDebugCommandMessages(
  errorMessage: string,
  operation?: string,
): { messages: PromptMessage[] } {
  const operationContext = operation ? ` during ${operation} operation` : ''

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I'm getting this error${operationContext} with MBC CQRS Serverless:

\`\`\`
${errorMessage}
\`\`\`

How can I debug and fix this?`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `# Debugging Command Error

## Error Analysis

The error "${errorMessage}" typically occurs in these scenarios:

### Common Causes

1. **Version Mismatch (Optimistic Locking)**
   - You're trying to update an item with an outdated version
   - Solution: Fetch the latest version before updating

2. **Item Not Found**
   - The pk/sk combination doesn't exist
   - Solution: Verify the keys are correct

3. **Validation Error**
   - Request data doesn't match DTO validation
   - Solution: Check your DTO decorators

### Debugging Steps

1. **Check the request data**:
   \`\`\`typescript
   console.log('Request:', JSON.stringify(request, null, 2))
   \`\`\`

2. **Verify item exists**:
   \`\`\`typescript
   const existing = await dataService.getItem({ pk, sk })
   console.log('Existing item:', existing)
   \`\`\`

3. **Check version**:
   \`\`\`typescript
   // Current item version
   console.log('Version:', existing?.version)
   // Your request version
   console.log('Request version:', dto.version)
   \`\`\`

### Quick Fixes

\`\`\`typescript
// Auto-fetch latest version (async mode)
await commandService.publishPartialUpdateAsync({
  pk, sk,
  version: -1, // Auto-fetches latest
  name: 'Updated',
}, options)

// Or fetch and use latest (sync mode)
const latest = await dataService.getItem({ pk, sk })
await commandService.publishPartialUpdateSync({
  pk, sk,
  version: latest.version,
  name: 'Updated',
}, options)
\`\`\`

Use the \`mbc_lookup_error\` tool for specific error solutions.`,
        },
      },
    ],
  }
}

function getMigrationGuideMessages(
  fromVersion: string,
  toVersion: string,
): { messages: PromptMessage[] } {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I need to migrate my MBC CQRS Serverless project from version ${fromVersion} to ${toVersion}. What do I need to know?`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `# Migration Guide: ${fromVersion} to ${toVersion}

## General Migration Steps

1. **Update dependencies**:
   \`\`\`bash
   npm update @mbc-cqrs-serverless/core @mbc-cqrs-serverless/cli
   \`\`\`

2. **Check for breaking changes** in the CHANGELOG.md

3. **Update imports** if API has changed

4. **Run tests** to verify everything works

## Common Migration Issues

### Interface Changes
- Check if CommandEntity/DataEntity interfaces have new required fields
- Update your entities accordingly

### Configuration Changes
- Review CommandModuleOptions for new options
- Check environment variables

### Deprecated Features
- Look for deprecation warnings in build output
- Replace deprecated APIs with recommended alternatives

## Verification

1. Build the project:
   \`\`\`bash
   npm run build
   \`\`\`

2. Run tests:
   \`\`\`bash
   npm test
   \`\`\`

3. Test locally:
   \`\`\`bash
   npm run offline
   \`\`\`

For specific version migration details, check the CHANGELOG.md in the framework repository.`,
        },
      },
    ],
  }
}
