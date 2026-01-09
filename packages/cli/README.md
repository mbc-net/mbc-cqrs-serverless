![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/cli

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fcli.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line interface for the MBC CQRS Serverless framework. Quickly scaffold new projects, generate code, and manage your serverless CQRS applications.

![Quick Start Demo](https://mbc-cqrs-serverless.mbc-net.com/demo/quick-start.gif)

## Features

- **Project Scaffolding**: Create production-ready CQRS applications with a single command
- **Code Generation**: Generate modules, controllers, services, entities, and DTOs
- **Version Management**: Install specific framework versions or use the latest
- **Local Development**: Built-in commands for starting local development servers

## Installation

### Global Installation (Recommended)

```bash
npm install -g @mbc-cqrs-serverless/cli
```

### Version-Specific Installation

```bash
# Latest stable release
npm install -g @mbc-cqrs-serverless/cli

# Beta release
npm install -g @mbc-cqrs-serverless/cli@beta

# Specific version
npm install -g @mbc-cqrs-serverless/cli@1.0.16
```

Verify installation:

```bash
mbc --version
```

## Quick Start

Create and run a new CQRS application in minutes:

```bash
# Create a new project
mbc new my-cqrs-app

# Navigate to project
cd my-cqrs-app

# Install dependencies
npm install

# Start local development (run in separate terminals)
npm run offline:docker   # Terminal 1: Start Docker services
npm run migrate          # Terminal 2: Run database migrations
npm run offline:sls      # Terminal 3: Start serverless offline
```

## Commands

### `mbc new [name[@version]]`

Generate a new CQRS application.

**Alias**: `n`

**Examples**:

```bash
# Create project in current directory (prompts for name)
mbc new

# Create project with a specific name
mbc new my-app

# Create project with a specific framework version
mbc new my-app@1.0.16

# Use alias
mbc n my-app
```

### `mbc generate <schematic> [name]`

Generate code elements using schematics.

**Alias**: `g`

**Options**:
- `-d, --dry-run` - Report actions without writing files
- `--mode <mode>` - Operation mode: sync or async (default: async)
- `--schema` / `--no-schema` - Enable/disable schema generation

**Available Schematics**:

| Name | Alias | Description |
|------|-------|-------------|
| `module` | `mo` | Create a module |
| `controller` | `co` | Create a controller |
| `service` | `se` | Create a service |
| `entity` | `en` | Create an entity |
| `dto` | `dto` | Create a DTO |

**Examples**:

```bash
# Generate a new module
mbc generate module todo

# Generate a controller (using alias)
mbc g co todo

# Generate a service with async mode
mbc g service todo --mode async

# Dry run to preview changes
mbc g module order --dry-run
```

### `mbc start`

Start the application with Serverless Framework.

**Alias**: `s`

```bash
mbc start
# or
mbc s
```

### `mbc ui-common`

Add MBC CQRS UI common components to your project.

**Alias**: `ui`

**Options**:
- `-p, --pathDir <string>` - Path for common-ui (required)
- `-b, --branch <string>` - Branch name (default: main)
- `--auth <string>` - Auth method: HTTPS or SSH (default: SSH)
- `--token <string>` - Token for HTTPS auth (format: tokenId:tokenPassword)
- `-c, --component <string>` - Component to install: all, appsync, or component (default: all)
- `--alias` - Alias to common-ui

**Example**:

```bash
mbc ui-common -p ./src/common-ui -c all
```

## Project Structure

The CLI creates a standardized project structure optimized for CQRS:

```
my-cqrs-app/
├── src/
│   ├── app.module.ts           # Root application module
│   ├── main.ts                 # Application entry point
│   ├── todo/                   # Example module (optional)
│   │   ├── todo.module.ts      # Module definition
│   │   ├── todo.controller.ts  # REST controller
│   │   ├── todo.service.ts     # Business logic
│   │   ├── dto/                # Data transfer objects
│   │   │   ├── create-todo.dto.ts
│   │   │   └── update-todo.dto.ts
│   │   └── entity/             # Entity definitions
│   │       └── todo.entity.ts
│   ├── prisma/                 # Prisma ORM configuration
│   │   ├── schema.prisma       # Database schema
│   │   └── prisma.service.ts   # Prisma service
│   └── helpers/                # Utility functions
├── infra-local/                # Local infrastructure config
│   └── cognito-local/          # Local Cognito setup
├── test/
│   ├── e2e/                    # End-to-end tests
│   └── unit/                   # Unit tests
├── .env.example                # Environment template
├── docker-compose.yml          # Docker services
├── package.json                # Dependencies
├── serverless.yml              # Serverless Framework config
└── tsconfig.json               # TypeScript configuration
```

## Development Workflow

### 1. Create Project

```bash
mbc new my-cqrs-app
cd my-cqrs-app
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Local Infrastructure

```bash
# Start Docker services (DynamoDB Local, LocalStack, etc.)
npm run offline:docker
```

### 4. Initialize Database

```bash
# Run Prisma migrations
npm run migrate
```

### 5. Start Development Server

```bash
# Start Serverless Offline
npm run offline:sls
```

### 6. Generate New Components

```bash
# Add a new module
mbc g module order

# Add related components
mbc g controller order
mbc g service order
mbc g entity order
mbc g dto order
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/sequence](https://www.npmjs.com/package/@mbc-cqrs-serverless/sequence) | Sequence number generation |
| [@mbc-cqrs-serverless/task](https://www.npmjs.com/package/@mbc-cqrs-serverless/task) | Async task processing |
| [@mbc-cqrs-serverless/master](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) | Master data management |
| [@mbc-cqrs-serverless/tenant](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant) | Multi-tenancy support |
| [@mbc-cqrs-serverless/import](https://www.npmjs.com/package/@mbc-cqrs-serverless/import) | Data import utilities |
| [@mbc-cqrs-serverless/ui-setting](https://www.npmjs.com/package/@mbc-cqrs-serverless/ui-setting) | UI configuration |

## Documentation

Full documentation is available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Getting Started](https://mbc-cqrs-serverless.mbc-net.com/docs/introduction)
- [CLI Reference](https://mbc-cqrs-serverless.mbc-net.com/docs/cli)
- [Build a Todo App Tutorial](https://mbc-cqrs-serverless.mbc-net.com/docs/build-todo-app)

## Troubleshooting

### Version Not Found

```bash
mbc new myapp@999.999.999
# Error: Version not found
```

**Solution**: Check available versions on [npm](https://www.npmjs.com/package/@mbc-cqrs-serverless/cli?activeTab=versions).

### Project Creation Fails

```bash
mbc new my-project
# Error: Directory not empty
```

**Solution**: Use a new directory or remove existing files first.

### Permission Denied

```bash
npm install -g @mbc-cqrs-serverless/cli
# EACCES: permission denied
```

**Solution**: Fix npm permissions or use a Node version manager like nvm.

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
