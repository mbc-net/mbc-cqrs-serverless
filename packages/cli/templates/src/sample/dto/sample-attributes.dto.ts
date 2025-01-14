import { IsObject } from 'class-validator'

export class SampleAttributes {
  @IsObject()
  value: object
}
