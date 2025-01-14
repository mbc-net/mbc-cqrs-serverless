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

- `mbc new`: Creates a project in the current directory with default name
- `mbc new projectName`: Creates a project with specified name
- `mbc new projectName@version`: Creates a project with specific version
  - Supports exact versions and version prefixes
  - Shows available versions if specified version not found

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation, including:
- Detailed CLI commands and options
- Project setup and configuration
- Development server setup
- Available endpoints and services

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
