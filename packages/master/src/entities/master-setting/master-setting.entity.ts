export class MasterSettingEntity {
  id: string
  settingValue: object

  constructor(partial: Partial<MasterSettingEntity>) {
    Object.assign(this, partial)
  }
}
