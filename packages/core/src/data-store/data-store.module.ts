import { Global, Module } from '@nestjs/common'

import { DynamoDbService } from './dynamodb.service'
import { S3Service } from './s3.service'

@Global()
@Module({
  providers: [DynamoDbService, S3Service],
  exports: [DynamoDbService, S3Service],
})
export class DataStoreModule {}
