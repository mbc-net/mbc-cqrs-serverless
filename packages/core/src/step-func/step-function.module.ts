import { Global, Module } from '@nestjs/common'

import { StepFunctionService } from './step-function.service'

@Global()
@Module({
  providers: [StepFunctionService],
  exports: [StepFunctionService],
})
export class StepFunctionModule {}
