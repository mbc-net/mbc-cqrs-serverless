![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework Directory Service package

## Description

This package provides directory management functionality in a multi-tenant CQRS architecture. It enables the creation, management of folder, file with support for:

- **Directory CRUD Operations**: Create, read, update, and delete folders and files
- **Access Permissions**: Manage granular permissions for specific folders and files
- **Multi-tenant Support**: Tenant-isolated directory management

## Features

- **Directory Management**: Full management of files and folders (integrates with S3)
- **Tenant Isolation**: Secure multi-tenant data separation
- **Granular Permissions**: Manage access control for individual files and folders
- **Event-Driven Architecture**: Built on CQRS pattern with command/event handling
- **RESTful API**: Complete REST API for directory operations

## Installation

```bash
npm install @mbc-cqrs-serverless/directory
```

## API Endpoints

- `GET /api/directory/` - Search and list files and folders
- `POST /api/directory/` - Create a new file or folder
- `GET /api/directory/:id` - Get details for a specific file or folder
- `PUT /api/directory/:id` - Update a specific file or folder
- `DELETE /api/directory/:id` - Delete a specific file or folder

## Configurable table name

`DirectoryStorageModule` stores its data on the `directory` DynamoDB table by
default. You can override this (and related identifiers) with backward-compatible
options — omitting them keeps the current behavior.

| Option | Default | Description |
|--------|---------|-------------|
| `tableName` | `directory` | Raw DynamoDB base table name. Physical tables become `${NODE_ENV}-${APP_NAME}-${tableName}` (`-command` / `-data` / `-history`). |
| `pkPrefix` | `DIRECTORY` | Partition-key prefix (before `#`). |
| `prismaModelName` | `directory` | Prisma model accessor used for RDS reads. |

```ts
DirectoryStorageModule.register({
  enableController: true,
  prismaService: PrismaService,
  tableName: 'document',
  pkPrefix: 'DOCUMENT',
  prismaModelName: 'document',
})

// Async configuration is also supported. The table name is a build-time
// constant, so it is passed as a plain field; the factory must resolve and
// return the PrismaService INSTANCE (inject it so Nest orders it correctly,
// even when Prisma is provided via forRootAsync).
DirectoryStorageModule.registerAsync({
  tableName: 'document',
  imports: [PrismaModule],
  inject: [PrismaService],
  useFactory: (prisma) => ({ prismaService: prisma }),
})
```

> **Provisioning:** When you use a custom `tableName`, add **only the raw base
> name** (e.g. `"document"`) to `prisma/dynamodbs/cqrs.json`. The CLI expands it
> into `<name>-command`, `<name>-data`, and `<name>-history` — do **not** add
> those suffixes yourself. Mirror the same three physical tables in your IaC.
> Migrating existing data to a renamed table is the application's responsibility.

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
