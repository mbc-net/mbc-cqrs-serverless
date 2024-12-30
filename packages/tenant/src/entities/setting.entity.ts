export class SettingEntity {
    id: string
    settingValue: Object

    constructor(partial: Partial<SettingEntity>) {
        Object.assign(this, partial)
    }
}
