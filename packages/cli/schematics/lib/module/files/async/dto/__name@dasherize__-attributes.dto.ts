import { IsObject } from 'class-validator'

export class <%= classify(name) %>Attributes {
  @IsObject()
  value: object
}
