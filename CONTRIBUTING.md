# Contributing to MBC CQRS Serverless

Thank you for your interest in contributing to MBC CQRS Serverless! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- Docker (for LocalStack)

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/mbc-cqrs-serverless.git
cd mbc-cqrs-serverless
```

2. **Install dependencies**

```bash
npm install
```

3. **Build all packages**

```bash
npm run build
```

4. **Run tests**

```bash
npm test
```

## Branch Strategy

We use the following branch structure:

| Branch | Purpose |
|--------|---------|
| `main` | Stable production releases |
| `beta` | Beta testing releases |
| `develop` | Active development |
| `feature/*` | New features |
| `fix/*` | Bug fixes |

### Workflow

1. Create a feature branch from `develop`
2. Make your changes
3. Submit a pull request to `develop`
4. After review, changes are merged to `develop`
5. Periodically, `develop` is merged to `beta` for testing
6. After validation, `beta` is merged to `main` for release

## Making Changes

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Commit Messages

Use clear, descriptive commit messages in English:

```
type: short description

Longer description if needed.
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat: add multi-tenant support to query service
fix: resolve DynamoDB pagination issue
docs: update README with new examples
```

### Code Style

- Follow existing code patterns
- Use TypeScript strict mode
- Run linting before committing:

```bash
npm run lint
npm run format
```

### Documentation

- All public documentation must be in **English**
- Update README files when adding features
- Add JSDoc comments to public APIs
- Update CHANGELOG.md for notable changes

## Testing

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Test specific package
npm test --workspace=@mbc-cqrs-serverless/core
```

### Writing Tests

- Write unit tests for new functionality
- Use Jest and aws-sdk-client-mock for AWS service mocking
- Ensure tests pass before submitting PR

Example test:

```typescript
describe('CommandService', () => {
  it('should publish command successfully', async () => {
    // Arrange
    const command = new CreateResourceCommand(data);

    // Act
    const result = await service.publish(command);

    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBe(expectedId);
  });
});
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Run linting and formatting
3. Update documentation if needed
4. Add changelog entry for notable changes

### PR Guidelines

- Target the `develop` branch
- Provide a clear description of changes
- Reference related issues
- Include test coverage for new features
- Keep PRs focused and reasonably sized

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows project style
- [ ] Documentation updated
- [ ] CHANGELOG updated (if applicable)
```

## Adding New Packages

To add a new package to the monorepo:

```bash
npm init --scope mbc-cqrs-serverless -w ./packages/PACKAGE_NAME
```

Ensure the new package follows the existing structure:

```
packages/PACKAGE_NAME/
├── src/
│   ├── index.ts
│   └── ...
├── package.json
├── README.md
├── tsconfig.json
└── nest-cli.json
```

## Release Process

Releases are automated via GitHub Actions:

1. **Alpha**: Tag on `develop` (e.g., `v1.0.0-alpha.1`)
2. **Beta**: Tag on `beta` (e.g., `v1.0.0-beta.1`)
3. **Production**: Tag on `main` (e.g., `v1.0.0`)

Maintainers handle the release process.

## Getting Help

- Check existing issues and documentation
- Open a new issue for bugs or feature requests
- Join discussions in pull requests

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
