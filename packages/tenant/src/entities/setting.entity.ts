export class SettingEntity {
  id: string
  settingValue: object

  constructor(partial: Partial<SettingEntity>) {
    Object.assign(this, partial)
  }
}
