import { IsString } from 'class-validator'

import { DetailKey } from './detail-key.interface'

export class DetailDto implements DetailKey {
  @IsString()
  pk: string

  @IsString()
  sk: string
}
