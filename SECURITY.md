# Security Policy

## Cognito app-client security update — v1.8.1 (2026-11-25)

Projects scaffolded before v1.8.1 allowed signed-in users to write authorization-related Cognito attributes with their own access token. Restrict every affected app client to writing only `name` and deploy the infrastructure change. Updating packages alone does not remediate deployed clients. Keep edits to other attributes behind an authorized server-side endpoint using `AdminUpdateUserAttributes`; ECS task roles also need the pool-scoped Cognito admin permissions.

Audit every user's `custom:roles`, `custom:tenant`, and `custom:groups` against your source of truth. Correct unauthorized changes and globally sign out affected users; existing JWT claims can remain usable until expiration. See the [v1.8.1 migration guide](packages/mcp-server/skills/mbc-migrate/SKILL.md#v180--v181-cli-app-client-write-attributes-security) for exact remediation and audit steps. This policy is also exposed through the MCP `mbc://docs/security` resource.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in MBC CQRS Serverless, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email the maintainers directly with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- Fix timeline based on severity

## Security Best Practices

### Authentication & Authorization

1. **Always use authentication** in production
   - Configure Cognito properly
   - Use JWT token validation
   - Implement role-based access control (RBAC)

2. **Use the Auth decorator**
   ```typescript
   @Controller('orders')
   export class OrderController {
     @Post()
     @Auth('admin', 'manager')
     create() {}
   }
   ```

3. **Validate tenant context**
   - Ensure `x-tenant-code` header is validated
   - Use TenantGuard for tenant isolation

### Data Protection

1. **Encrypt sensitive data**
   - Use AWS KMS for encryption at rest
   - Enable DynamoDB encryption
   - Use HTTPS for all API calls

2. **Implement least privilege**
   - Use IAM roles with minimal permissions
   - Scope Lambda execution roles appropriately

3. **Protect PII (Personally Identifiable Information)**
   - Mask sensitive data in logs
   - Use field-level encryption when needed

### Input Validation

1. **Validate all inputs**
   ```typescript
   import { IsString, IsNotEmpty } from 'class-validator';

   export class CreateOrderDto {
     @IsString()
     @IsNotEmpty()
     productId: string;
   }
   ```

2. **Use DTOs with class-validator**
   - Enable ValidationPipe globally
   - Whitelist properties to prevent injection

3. **Sanitize user input**
   - Escape special characters
   - Validate data types and ranges

### API Security

1. **Rate limiting**
   - Configure API Gateway throttling
   - Implement per-user rate limits

2. **CORS configuration**
   - Restrict allowed origins
   - Limit allowed methods and headers

3. **Request validation**
   - Validate Content-Type headers
   - Limit request body size

### Infrastructure Security

1. **VPC configuration**
   - Place Lambda functions in VPC when accessing internal resources
   - Use VPC endpoints for AWS services

2. **Secrets management**
   - Use AWS Secrets Manager or Parameter Store
   - Never commit secrets to version control
   - Rotate credentials regularly

3. **Logging and monitoring**
   - Enable CloudWatch logging
   - Set up CloudTrail for audit
   - Configure alerts for suspicious activity

### Dependency Management

1. **Keep dependencies updated**
   ```bash
   npm audit
   npm update
   ```

2. **Review dependency changes**
   - Check changelogs before updating
   - Use lockfiles (package-lock.json)

3. **Scan for vulnerabilities**
   - Use `npm audit` regularly
   - Consider tools like Snyk or Dependabot

## Security Checklist for Deployment

- [ ] All secrets stored in AWS Secrets Manager
- [ ] IAM roles follow least privilege principle
- [ ] API Gateway has proper throttling configured
- [ ] DynamoDB tables have encryption enabled
- [ ] CloudWatch logging is enabled
- [ ] CORS is properly configured
- [ ] Input validation is implemented
- [ ] Authentication is required for protected routes
- [ ] Tenant isolation is verified
- [ ] Dependencies are up to date

## Compliance Considerations

When using this framework in production, consider:

- **GDPR**: Data residency, right to erasure, consent management
- **SOC 2**: Access controls, audit logging, encryption
- **HIPAA**: PHI protection, access controls, audit trails
- **PCI DSS**: Cardholder data protection, network security

Consult with your security and compliance teams for specific requirements.
