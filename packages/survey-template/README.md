![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework Survey Template Service package

## Description

This package provides survey template management functionality in a multi-tenant CQRS architecture. It enables the creation, management, and storage of survey templates with support for:

- **Survey Template CRUD Operations**: Create, read, update, and delete survey templates
- **Multi-tenant Support**: Tenant-isolated survey template management
- **Flexible Survey Structure**: JSON-based survey template definitions supporting various question types
- **Search and Filtering**: Advanced search capabilities with keyword matching and filtering options

## Features

- **Survey Template Management**: Full lifecycle management of survey templates
- **Tenant Isolation**: Secure multi-tenant data separation
- **Flexible Schema**: Support for complex survey structures with sections and various question types
- **Search Capabilities**: Search by name, description, or other attributes
- **Event-Driven Architecture**: Built on CQRS pattern with command/event handling
- **RESTful API**: Complete REST API for survey template operations

## Installation

```bash
npm install @mbc-cqrs-serverless/survey-template
```

## API Endpoints

- `GET /api/survey-template/` - Search and list survey templates
- `POST /api/survey-template/` - Create a new survey template
- `GET /api/survey-template/:id` - Get a specific survey template
- `PUT /api/survey-template/:id` - Update a survey template
- `DELETE /api/survey-template/:id` - Delete a survey template

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
