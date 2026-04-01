import { Global, Module } from '@nestjs/common'

import { DynamoDbService } from './dynamodb.service'
import { S3Service } from './s3.service'
import { SessionService } from './session.service'

@Global()
@Module({
  providers: [DynamoDbService, S3Service, SessionService],
  exports: [DynamoDbService, S3Service, SessionService],
})
export class DataStoreModule {}
