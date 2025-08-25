![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)


# MBC CQRS serverless framework Import package

A flexible and extensible module for handling data import within the `@mbc-cqrs-serverless` framework.

## Core Features

- **Unified Architectural Design**: Facilitates the processing of data from REST API endpoints and CSV files through a singular, consistent set of core business logic.

- **Strategy Pattern Implementation**: Enables comprehensive customization of validation, transformation, and processing logic for each data entity via NestJS providers.

- **Asynchronous, Event-Driven Processing**: Guarantees maximum scalability and resilience by processing all tasks asynchronously through a pipeline of DynamoDB Streams, SNS, and SQS.

- **Biphasic Processing Model**: Establishes a distinct separation of concerns between the initial data ingestion and validation phase and the subsequent business logic execution.

- **Dual CSV Processing Modes**: Offers the flexibility to select between `DIRECT` processing for smaller files and a resilient `STEP_FUNCTION` workflow for large-scale, mission-critical import operations.

## Installation

```sh
npm install @mbc-cqrs-serverless/import
```
## Architecture Overview

The module operates on a powerful two-phase architecture, ensuring a clean separation of concerns.

1. The Import Phase (Ingestion)

This phase is responsible for getting data into the system. It's handled by a class that implements the `IImportStrategy` interface.

`transform(input)`: Takes a raw input object (from a JSON body or a CSV row) and transforms it into a standardized, validated DTO.

`validate(dto)`: Validates the transformed DTO.

The result of this phase is a record in a temporary DynamoDB table with a CREATED status.

2. The Process Phase (Business Logic)

Once a record is in the temporary table, an event is triggered, and this phase begins. It's handled by a class that implements the `IProcessStrategy` interface.

`compare(dto)`: Compares the data from the temporary table with data in the final destination table to determine if it's a new record (`NOT_EXIST`), a changed one (`CHANGED`), or identical (`EQUAL`).

`map(status, dto)`: Based on the comparison, it constructs the final payload for a create or update command.

`getCommandService()`: Provides the correct `CommandService` to execute the final write operation.

After this phase, the record in the temporary table is updated to `COMPLETED` or `FAILED`, and the result is stored for auditing.

## License

Copyright © 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/

This project and sub projects are under the MIT License.