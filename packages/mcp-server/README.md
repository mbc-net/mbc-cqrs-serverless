# @mbc-cqrs-serverless/mcp-server

MCP (Model Context Protocol) server for MBC CQRS Serverless framework. This package enables AI tools like Claude Code, Cursor, and other MCP-compatible clients to interact with the framework.

## Features

### Resources

Access framework documentation and project information:

| Resource URI | Description |
|--------------|-------------|
| `mbc://docs/overview` | Complete framework documentation |
| `mbc://docs/llms-short` | Concise framework summary |
| `mbc://docs/architecture` | CQRS architecture guide |
| `mbc://docs/errors` | Error catalog with solutions |
| `mbc://docs/faq` | Frequently asked questions |
| `mbc://docs/troubleshooting` | Troubleshooting guide |
| `mbc://docs/security` | Security best practices |
| `mbc://project/entities` | List of project entities |
| `mbc://project/modules` | List of project modules |
| `mbc://project/structure` | Project directory structure |

### Tools

Generate code and analyze projects:

| Tool | Description |
|------|-------------|
| `mbc_generate_module` | Generate a complete CQRS module |
| `mbc_generate_controller` | Generate a controller |
| `mbc_generate_service` | Generate a service |
| `mbc_generate_entity` | Generate an entity |
| `mbc_generate_dto` | Generate a DTO |
| `mbc_validate_cqrs` | Validate CQRS pattern implementation |
| `mbc_analyze_project` | Analyze project structure |
| `mbc_lookup_error` | Look up error solutions |

### Prompts

Get guided assistance:

| Prompt | Description |
|--------|-------------|
| `cqrs_implementation_guide` | Step-by-step CQRS implementation |
| `debug_command_error` | Debug command-related errors |
| `migration_guide` | Version migration guidance |

## Installation

```bash
npm install @mbc-cqrs-serverless/mcp-server
```

Or use directly with npx:

```bash
npx @mbc-cqrs-serverless/mcp-server
```

## Configuration

### Claude Code

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mbc-cqrs-serverless": {
      "command": "npx",
      "args": ["@mbc-cqrs-serverless/mcp-server"],
      "env": {
        "MBC_PROJECT_PATH": "/path/to/your/project"
      }
    }
  }
}
```

### Cursor

Add to Cursor's MCP settings:

```json
{
  "mbc-cqrs-serverless": {
    "command": "npx",
    "args": ["@mbc-cqrs-serverless/mcp-server"],
    "env": {
      "MBC_PROJECT_PATH": "/path/to/your/project"
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MBC_PROJECT_PATH` | Path to the project directory | Current working directory |

## Usage Examples

### With Claude Code

Once configured, you can ask Claude Code to:

```
"Generate a new Order module with async command handling"
```

Claude Code will use the `mbc_generate_module` tool to create the module.

```
"Analyze my project structure"
```

Claude Code will use the `mbc_analyze_project` tool to provide insights.

```
"I'm getting a version mismatch error, help me debug"
```

Claude Code will use the `debug_command_error` prompt and `mbc_lookup_error` tool.

### Resource Access

AI tools can access framework documentation:

```
Read mbc://docs/errors to understand common errors
```

### Code Generation

```
Use mbc_generate_module to create a Product module with sync mode
```

### Project Analysis

```
Run mbc_validate_cqrs to check my CQRS implementation
```

## Development

### Building

```bash
cd packages/mcp-server
npm install
npm run build
```

### Testing

```bash
# Run the server locally
npm start

# Or with a specific project path
MBC_PROJECT_PATH=/path/to/project npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AI Tools (Claude Code, Cursor, etc.)                       │
│                         │                                    │
│                    MCP Protocol (stdio)                      │
│                         ↓                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  @mbc-cqrs-serverless/mcp-server                      │  │
│  │                                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │  Resources  │  │    Tools    │  │   Prompts    │  │  │
│  │  │             │  │             │  │              │  │  │
│  │  │ - docs      │  │ - generate  │  │ - cqrs_guide │  │  │
│  │  │ - project   │  │ - validate  │  │ - debug      │  │  │
│  │  │ - errors    │  │ - analyze   │  │ - migration  │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT

## Related Packages

- [@mbc-cqrs-serverless/core](../core) - Core CQRS framework
- [@mbc-cqrs-serverless/cli](../cli) - CLI tool for code generation
