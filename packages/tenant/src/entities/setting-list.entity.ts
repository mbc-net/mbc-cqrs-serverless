import { Expose, Type } from 'class-transformer'

import { SettingEntity } from './setting.entity'

export class SettingListEntity extends SettingEntity {
  @Expose()
  @Type(() => SettingEntity)
  items: SettingEntity[]

  constructor(partial: Partial<SettingListEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
