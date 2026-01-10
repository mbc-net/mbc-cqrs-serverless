# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.18](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.18)

### Bug Fixes

- **ImportStatusHandler:** Add SendTaskFailure support for proper Step Functions error handling ([#275](https://github.com/mbc-net/mbc-cqrs-serverless/pull/275))
  - Fixed: Step Functions would wait indefinitely when import jobs failed because only `SendTaskSuccess` was implemented
  - Added `sendTaskFailure()` method to send `SendTaskFailureCommand` when jobs fail
  - Handler now processes both `COMPLETED` and `FAILED` statuses for CSV import jobs
  - This ensures Step Functions properly receive callbacks for both success and failure cases
  - Added comprehensive unit tests (16 tests)

## [0.1.75-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.74-beta.0...v0.1.75-beta.0)

### Bug Fixes

- **ImportStatusHandler:** Add SendTaskFailure support for proper Step Functions error handling
  - Fixed: Step Functions would wait indefinitely when import jobs failed because only `SendTaskSuccess` was implemented
  - Added `sendTaskFailure()` method to send `SendTaskFailureCommand` when jobs fail
  - Handler now processes both `COMPLETED` and `FAILED` statuses for CSV import jobs
  - This ensures Step Functions properly receive callbacks for both success and failure cases

## [0.1.74-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.73-beta.0...v0.1.74-beta.0) (2025-08-25)

### Features

- import module ([152115d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/152115d7474bfd0a1cba5feb3d83110be87f486e))
- update infra for import module ([d2f609d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/d2f609d2b4dea9a0265310461617a8a9d46d5d15))
