# Dependency Management Policy

This document outlines the policies and best practices for managing external dependencies in the MBC CQRS Serverless framework.

## Table of Contents

- [Version Pinning Rules](#version-pinning-rules)
- [Adding New Dependencies](#adding-new-dependencies)
- [Dependency Testing Requirements](#dependency-testing-requirements)
- [Security Policy](#security-policy)
- [Dependency Categories](#dependency-categories)

---

## Version Pinning Rules

### Production Dependencies

| Dependency Type | Version Strategy | Example |
|----------------|-----------------|---------|
| Major version | `^` (caret) - allows minor updates | `^10.3.0` |
| Security patches | Auto-update allowed | N/A |
| Breaking changes | Manual review required | N/A |

### AWS SDK

All `@aws-sdk/*` packages MUST use the same version for consistency:

```json
{
  "@aws-sdk/client-dynamodb": "^3.478.0",
  "@aws-sdk/client-s3": "^3.478.0",
  "@aws-sdk/client-sns": "^3.478.0",
  "@aws-sdk/client-sqs": "^3.478.0",
  "@aws-sdk/client-sfn": "^3.478.0",
  "@aws-sdk/client-sesv2": "^3.478.0"
}
```

### NestJS

All `@nestjs/*` packages MUST use the same major version:

```json
{
  "@nestjs/common": "^10.3.0",
  "@nestjs/core": "^10.3.0",
  "@nestjs/config": "^3.1.1",
  "@nestjs/platform-express": "^10.3.0",
  "@nestjs/swagger": "^7.1.17"
}
```

### Dev Dependencies

Test and build tools may follow the latest versions more freely, but should be updated with caution to avoid breaking CI/CD pipelines.

---

## Adding New Dependencies

### Checklist Before Adding

Before adding any new dependency, verify the following:

- [ ] **License Check**: MIT, Apache 2.0, or BSD preferred
- [ ] **Maintenance Status**: Check last update date and issue response time
- [ ] **Security Vulnerabilities**: Run `npm audit` after installation
- [ ] **Bundle Size Impact**: Evaluate impact on Lambda cold start times
- [ ] **TypeScript Support**: Prefer packages with built-in TypeScript types
- [ ] **Peer Dependency Conflicts**: Check for conflicts with existing dependencies

### License Requirements

| Allowed | Not Recommended | Prohibited |
|---------|-----------------|------------|
| MIT | LGPL | GPL |
| Apache 2.0 | MPL | AGPL |
| BSD-2-Clause | | Proprietary |
| BSD-3-Clause | | |
| ISC | | |

### Peer Dependencies

Common frameworks should be declared as `peerDependencies` with version ranges:

```json
{
  "peerDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0"
  }
}
```

---

## Dependency Testing Requirements

### When Adding New Dependencies

1. **Integration Tests Required**: Test the main IN/OUT of the dependency
2. **Mock Strategy**:
   - AWS SDK: Use `aws-sdk-client-mock`
   - Other external services: Use `jest.mock()` or actual values
3. **Error Cases**: Test dependency error responses

### Test File Location

```
packages/
  <package>/
    src/
      integration/           # External dependency integration tests
        aws-dynamodb.spec.ts
        aws-sns.spec.ts
        csv-parser.spec.ts
        ulid.spec.ts
```

### Test Coverage Requirements

| Dependency Type | Minimum Coverage | Notes |
|----------------|------------------|-------|
| AWS SDK | 80% | All primary commands tested |
| Data Processing | 90% | All input/output scenarios |
| Validation | 100% | All validation rules tested |

### Example Test Structure

```typescript
// aws-dynamodb.spec.ts
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('DynamoDB Client Integration', () => {
  const dynamoDBMock = mockClient(DynamoDBClient)

  beforeEach(() => {
    dynamoDBMock.reset()
  })

  describe('PutItemCommand', () => {
    it('should accept valid input and return expected output', async () => {
      // Input
      const input = {
        TableName: 'test-table',
        Item: { pk: { S: 'test' }, sk: { S: 'item' } }
      }

      // Mock output
      dynamoDBMock.on(PutItemCommand).resolves({})

      // Execute
      const client = new DynamoDBClient({})
      await client.send(new PutItemCommand(input))

      // Verify IN/OUT
      expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, input)
    })
  })
})
```

---

## Security Policy

### Regular Checks

| Frequency | Action |
|-----------|--------|
| Weekly | Run `npm audit` |
| Monthly | Review dependency updates |
| Quarterly | Full dependency audit |

### Vulnerability Response Time

| Severity | Response Time | Action |
|----------|---------------|--------|
| Critical | 24 hours | Immediate patch or workaround |
| High | 48 hours | Patch within sprint |
| Medium | 1 week | Schedule for next release |
| Low | Next release | Include in regular updates |

### Renovate/Dependabot Configuration

```yaml
# Security updates: auto-merge
# Minor/Patch: auto-PR, manual merge
# Major: manual review required
```

### npm Audit Commands

```bash
# Check for vulnerabilities
npm audit

# Check specific package
npm audit --package-lock-only

# Generate audit report
npm audit --json > audit-report.json

# Fix automatically (use with caution)
npm audit fix
```

---

## Dependency Categories

### Core Dependencies

Critical dependencies that the framework relies on:

| Package | Purpose | Update Policy |
|---------|---------|---------------|
| `@nestjs/*` | Framework core | Major version freeze |
| `@aws-sdk/*` | AWS service clients | Unified version |
| `class-validator` | DTO validation | Stable version |
| `class-transformer` | Object transformation | Stable version |
| `reflect-metadata` | Decorator support | Stable version |

### Utility Dependencies

Helper libraries for specific features:

| Package | Purpose | Update Policy |
|---------|---------|---------------|
| `ulid` | ID generation | Stable |
| `csv-parser` | CSV file processing | Stable |
| `nodemailer` | Email sending | Stable |
| `jwt-decode` | JWT token parsing | Latest |

### Development Dependencies

Testing and build tools:

| Package | Purpose | Update Policy |
|---------|---------|---------------|
| `jest` | Testing framework | Latest major |
| `typescript` | Type system | Latest stable |
| `aws-sdk-client-mock` | AWS SDK mocking | Latest |
| `@golevelup/ts-jest` | NestJS mocking | Latest |

### MCP Server Dependencies

Model Context Protocol specific:

| Package | Purpose | Update Policy |
|---------|---------|---------------|
| `@modelcontextprotocol/sdk` | MCP protocol | Latest |
| `zod` | Schema validation | Latest |

---

## Upgrade Workflow

### Step 1: Preparation

```bash
# Create upgrade branch
git checkout -b chore/dependency-update-YYYYMMDD

# Check outdated packages
npm outdated
```

### Step 2: Update Dependencies

```bash
# Update specific package
npm update <package-name>

# Update all packages (minor/patch only)
npm update

# Update to latest major version
npm install <package-name>@latest
```

### Step 3: Verification

```bash
# Run full test suite
npm test

# Run integration tests
npm run test:e2e

# Check for security issues
npm audit
```

### Step 4: Documentation

Update CHANGELOG.md with dependency changes:

```markdown
## [Unreleased]

### Dependencies
- Updated @nestjs/* to 10.4.0
- Updated @aws-sdk/* to 3.500.0
```

---

## Troubleshooting

### Common Issues

#### Peer Dependency Conflicts

```bash
# Check peer dependency tree
npm ls <package-name>

# Force resolution (use with caution)
npm install --legacy-peer-deps
```

#### Version Mismatch

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Type Errors After Update

1. Check if `@types/*` packages need updating
2. Verify `tsconfig.json` compatibility
3. Check for breaking API changes in changelog

---

## References

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
