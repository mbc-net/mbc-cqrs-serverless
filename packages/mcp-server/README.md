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
| `mbc_analyze_project` | Analyze project structure and detect framework usage |
| `mbc_lookup_error` | Look up error solutions from the error catalog |
| `mbc_check_anti_patterns` | Detect anti-patterns (AP001–AP020) in project source files |
| `mbc_health_check` | Health check for dependencies, structure, and configuration |
| `mbc_explain_code` | Explain a file or code section in the MBC CQRS context |

#### Anti-Pattern Detection (`mbc_check_anti_patterns`)

Detects 20 anti-patterns including v1.1.x and v1.2.x breaking changes:

| Code | Name | Severity |
|------|------|----------|
| AP001 | Direct DynamoDB Write | Critical |
| AP002 | Ignored Version Mismatch | High |
| AP003 | N+1 Query Pattern | High |
| AP004 | Full Table Scan | High |
| AP005 | Hardcoded Tenant | Critical |
| AP006 | Missing Tenant Validation | Critical |
| AP007 | Throwing in Sync Handler | High |
| AP008 | Hardcoded Secret | Critical |
| AP009 | Manual JWT Parsing | Critical |
| AP010 | Heavy Module Import | Medium |
| AP011 | Deprecated Method Usage (`publish`, `publishPartialUpdate` removed in v1.1.0) | High |
| AP012 | Uppercase COMMON Tenant Key (`#COMMON` → `#common` in v1.1.0) | Critical |
| AP013 | publishSync Null Return Unchecked (`publishSync` returns `null` on no-op since v1.2.0) | High |
| AP014 | Deprecated genNewSequence (`SequenceService.genNewSequence()` removed in v1.2.0) | High |
| AP015 | Duplicate TaskModule Registration (global since v1.2.4) | High |
| AP016 | Missing Error Logging Before Rethrow | High |
| AP017 | Incorrect Attribute Merging on Partial Update | High |
| AP018 | Missing Swagger Documentation | Low |
| AP019 | Missing Pagination in List Queries | High |
| AP020 | Missing getCommandSource for Tracing | Low |

### Prompts

Get guided assistance:

| Prompt | Description |
|--------|-------------|
| `cqrs_implementation_guide` | Step-by-step CQRS implementation (module, entity, command, query, event) |
| `debug_command_error` | Debug command-related errors |
| `migration_guide` | Version migration guidance including v1.1.x and v1.2.x breaking changes |

#### `migration_guide` coverage

| Version | Changes |
|---------|---------|
| v1.1.0 | `TENANT_COMMON` renamed to lowercase `'common'`; `publish()` / `publishPartialUpdate()` removed |
| v1.1.4 | `publishSync` now writes full audit trail to Command + History tables |
| v1.1.5 | CSV import batch architecture — `finalize_parent_job` state required in Step Functions |
| v1.2.0 | `publishSync`/`publishPartialUpdateSync` return `null` on no-op; `genNewSequence()` removed; RYW `Repository` added |
| v1.2.2 | `CsvBatchProcessor` Smart Retry (Poison Pill fix); `ImportQueueEventHandler` payload fix |
| v1.2.4 | `TaskModule.register()` is now global — must be called once in host `AppModule` |

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
| `MBC_PROJECT_PATH` | Path to the user's project directory | Current working directory |
| `MBC_FRAMEWORK_ROOT` | Path to the framework root (for installed packages). Set automatically by the CLI; override only if the default monorepo layout does not apply. | Auto-resolved from package location |

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

```
"Check my project for anti-patterns"
```

Claude Code will use the `mbc_check_anti_patterns` tool to report issues.

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

## Claude Code Skills

This package includes Claude Code skills that provide guided assistance for MBC CQRS Serverless development.

### Available Skills

| Skill | Description |
|-------|-------------|
| `/mbc-generate` | Generate boilerplate code (modules, services, controllers, DTOs, handlers) |
| `/mbc-review` | Review code for best practices and anti-patterns (20 patterns) |
| `/mbc-migrate` | Guide version migrations and breaking changes |
| `/mbc-debug` | Debug and troubleshoot common issues |

### Installing Skills

To use the skills, copy them to your Claude Code skills directory:

```bash
# Copy to personal skills (available in all projects)
cp -r node_modules/@mbc-cqrs-serverless/mcp-server/skills/* ~/.claude/skills/

# Or copy to project skills (shared with team)
cp -r node_modules/@mbc-cqrs-serverless/mcp-server/skills/* .claude/skills/
```

### Using Skills

Once installed, use the skills via slash commands:

```
/mbc-generate
Create an Order module with RDS synchronization
```

```
/mbc-review
Review the code in src/order/order.service.ts
```

```
/mbc-migrate
I need to upgrade from v1.0.x to v1.1.x
```

```
/mbc-debug
I'm getting ConditionalCheckFailedException errors
```

Or let Claude automatically detect when to use them based on your request:

```
"Generate a new Product module for my MBC CQRS project"
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
