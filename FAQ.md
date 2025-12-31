# Frequently Asked Questions

## General

### What is MBC CQRS Serverless?

MBC CQRS Serverless is a TypeScript framework for building serverless applications on AWS using the CQRS (Command Query Responsibility Segregation) pattern. It's built on NestJS and provides abstractions for working with AWS services like Lambda, DynamoDB, SNS, and SQS.

### What are the main benefits of using this framework?

- **CQRS Pattern**: Separation of read and write operations for better scalability
- **Event Sourcing**: Complete audit trail of all changes
- **Multi-tenancy**: Built-in tenant isolation
- **AWS Integration**: Ready-to-use integrations with AWS services
- **Local Development**: Full local development support with LocalStack

### What AWS services does this framework integrate with?

- AWS Lambda (compute)
- DynamoDB (data storage)
- SNS/SQS (messaging)
- Cognito (authentication)
- API Gateway (REST APIs)
- AppSync (GraphQL)
- Step Functions (workflows)
- S3 (file storage)
- SES (email)

## Installation & Setup

### How do I create a new project?

```bash
npm install -g @mbc-cqrs-serverless/cli
mbc new my-project
cd my-project
npm install
```

### What Node.js version is required?

Node.js 18 or higher is required.

### How do I set up local development?

1. Copy environment template: `cp .env.example .env`
2. Start LocalStack: `npm run start:localstack`
3. Create tables: `npm run ddb:create`
4. Start server: `npm run offline`

## Architecture

### What is the difference between Commands and Queries?

- **Commands**: Write operations that change state (create, update, delete)
- **Queries**: Read operations that do not change state (get, list, search)

### How does multi-tenancy work?

Data is isolated by tenant using partition key prefixes. Each tenant's data has a unique prefix (e.g., `TENANT001#ORDER`), and the framework automatically filters queries by the current tenant context.

### How does optimistic locking work?

Each entity has a `version` field. When updating, the framework checks that the version matches the current version in the database. If not, the update fails with a conflict error.

## Development

### How do I create a new module?

```bash
mbc generate module orders
mbc generate controller orders
mbc generate service orders
```

### How do I run tests?

```bash
npm test           # Unit tests
npm run test:e2e   # E2E tests
npm run test:cov   # With coverage
```

### How do I add a new package to the monorepo?

```bash
npm init --scope mbc-cqrs-serverless -w ./packages/package-name
```

## Deployment

### How do I deploy to AWS?

```bash
npm run deploy:dev   # Development
npm run deploy:stg   # Staging
npm run deploy:prod  # Production
```

### How does the release process work?

1. Create tag on `develop` for alpha release
2. Merge to `beta` and create tag for beta release
3. Merge to `main` and create tag for production release

GitHub Actions automatically publishes to npm when tags are pushed.

## Troubleshooting

### Where can I find troubleshooting help?

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

### How do I report a bug?

Open an issue on GitHub with:
- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

## Contributing

### How can I contribute?

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

### What is the code style?

- TypeScript with strict mode
- ESLint + Prettier
- All documentation in English
