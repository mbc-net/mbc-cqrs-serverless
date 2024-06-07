import { IsObject } from 'class-validator'

export class MasterAttributes {
  @IsObject()
  master: object
}
