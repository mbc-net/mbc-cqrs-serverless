![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework CLI package

## Description

The MBC CLI is a command-line interface tool that helps you initialize and manage MBC CQRS Serverless applications. It provides commands for project creation, version management, and development workflow automation.

## Installation

To install the `mbc` command globally, run:

```bash
npm install -g @mbc-cqrs-serverless/cli
```

## Usage

### Project Creation

The CLI provides flexible options for creating new projects:

```bash
mbc new [projectName[@version]]
```

#### Basic Usage Examples

1. Create a new project in the current directory:
```bash
mbc new
```

2. Create a project with a specific name:
```bash
mbc new my-cqrs-app
```

3. Create a project with a specific version:
```bash
mbc new my-cqrs-app@0.1.45
```

### Project Structure

The CLI creates a standardized project structure:

```
my-cqrs-app/
├── src/
│   ├── commands/       # Command handlers
│   ├── events/        # Event handlers
│   ├── interfaces/    # TypeScript interfaces
│   └── services/      # Business logic services
├── test/
│   ├── e2e/          # End-to-end tests
│   └── unit/         # Unit tests
├── package.json
└── serverless.yml    # Serverless Framework configuration
```

### Development Workflow

1. After creating a project, install dependencies:
```bash
cd my-cqrs-app
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start local development environment:
```bash
npm run offline:docker  # Start local infrastructure
npm run migrate        # Run database migrations
npm run offline:sls    # Start serverless offline
```

### Available Commands

- `mbc new`: Create a new project
- `mbc version`: Display CLI version
- `mbc help`: Show command help
- `mbc list`: List available project templates

### Configuration

The CLI supports configuration through:
- Command line arguments
- Environment variables
- Configuration files

Example configuration file (`.mbcrc.json`):
```json
{
  "defaultTemplate": "basic",
  "region": "ap-northeast-1",
  "stage": "dev"
}
```

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation, including:
- Detailed CLI commands and options
- Project setup and configuration
- Development server setup
- Available endpoints and services

## Troubleshooting

Common issues and solutions:

1. Version not found:
```bash
mbc new myapp@999.999.999
# Error: Version not found. Available versions: [0.1.45, 0.1.44, ...]
```
Solution: Use `mbc list versions` to see available versions.

2. Project creation fails:
```bash
mbc new my-project
# Error: Directory not empty
```
Solution: Use a new directory or remove existing files.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
