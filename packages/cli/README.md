![MBC CQRS serverless framework](https://mbc-net.github.io/mbc-cqrs-serverless-doc/img/mbc-cqrs-serverless.png)
# MBC CQRS serverless framework CLI package

## Description

The MBC CLI is a command-line interface tool that helps you to initialize your mbc-cqrs-serverless applications.

## Installation

To install `mbc`, run:

```bash
npm install -g @mbc-cqrs-serverless/cli 
```

## Usage

### `mbc new|n [projectName@version]`

There are 3 usages for the new command:

- `mbc new`
  - Creates a new project in the current folder using a default name with the latest framework version.
- `mbc new [projectName]`
  - Creates a new project in the `projectName` folder using the latest framework version.
- `mbc new [projectName@version]`
  - If the specified version exists, the CLI uses that exact version.
  - If the provided version is a prefix, the CLI uses the latest version matching that prefix.
  - If no matching version is found, the CLI logs an error and provides a list of available versions for the user.


## Documentation

Visit https://mbc-net.github.io/mbc-cqrs-serverless-doc/ to view the full documentation.

## License
Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
