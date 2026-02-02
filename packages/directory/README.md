![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework Directory Service package

## Description

This package provides directory management functionality in a multi-tenant CQRS architecture. It enables the creation, management of folder, file with support for:

- **Directory CRUD Operations**: Create, read, update, and delete folders and files
- **Access Permissions**: Manage granular permissions for specific folders and files
- **Multi-tenant Support**: Tenant-isolated directory management

## Features

- **Directory Management**: Full management of files and folders (integrates with S3)
- **Tenant Isolation**: Secure multi-tenant data separation
- **Granular Permissions**: Manage access control for individual files and folders
- **Event-Driven Architecture**: Built on CQRS pattern with command/event handling
- **RESTful API**: Complete REST API for directory operations

## Installation

```bash
npm install @mbc-cqrs-serverless/directory
```

## API Endpoints

- `GET /api/directory/` - Search and list files and folders
- `POST /api/directory/` - Create a new file or folder
- `GET /api/directory/:id` - Get details for a specific file or folder
- `PUT /api/directory/:id` - Update a specific file or folder
- `DELETE /api/directory/:id` - Delete a specific file or folder

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
