![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework UI Setting package

## Description

The UI Setting package manages user interface configuration and preferences in the MBC CQRS Serverless framework. It provides:

- User interface configuration management
- Theme and layout settings
- User preferences storage
- Multi-tenant UI customization
- Dynamic UI configuration updates
- Settings synchronization

## Installation

```bash
npm install @mbc-cqrs-serverless/ui-setting
```

## Usage

### Basic Setup

1. Import and configure the UI Setting module:
```typescript
import { UiSettingModule } from '@mbc-cqrs-serverless/ui-setting';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    UiSettingModule.forRoot({
      tableName: 'ui-settings',
      region: 'ap-northeast-1',
    }),
  ],
})
export class AppModule {}
```

### Managing Settings

1. Define settings schema:
```typescript
import { SettingSchema } from '@mbc-cqrs-serverless/ui-setting';

const themeSettings: SettingSchema = {
  name: 'theme',
  properties: {
    mode: { type: 'string', enum: ['light', 'dark'] },
    primaryColor: { type: 'string' },
    fontSize: { type: 'number' },
  },
};
```

2. Use the settings service:
```typescript
import { SettingService } from '@mbc-cqrs-serverless/ui-setting';

@Injectable()
export class ThemeService {
  constructor(
    private readonly settingService: SettingService
  ) {}

  async getUserTheme(userId: string): Promise<ThemeSettings> {
    return this.settingService.getUserSettings(userId, 'theme');
  }

  async updateUserTheme(
    userId: string,
    theme: ThemeSettings
  ): Promise<void> {
    await this.settingService.updateUserSettings(
      userId,
      'theme',
      theme
    );
  }
}
```

### Multi-tenant Configuration

1. Manage tenant-level settings:
```typescript
@Injectable()
export class TenantConfigService {
  constructor(
    private readonly settingService: SettingService
  ) {}

  @UseTenant()
  async getTenantLayout(
    @TenantContext() tenantId: string
  ): Promise<LayoutSettings> {
    return this.settingService.getTenantSettings(
      tenantId,
      'layout'
    );
  }
}
```

### Dynamic Updates

1. Listen for setting changes:
```typescript
import { SettingUpdateEvent } from '@mbc-cqrs-serverless/ui-setting';

@EventsHandler(SettingUpdateEvent)
export class SettingUpdateHandler implements IEventHandler<SettingUpdateEvent> {
  async handle(event: SettingUpdateEvent): Promise<void> {
    // Handle setting update
    if (event.settingType === 'theme') {
      await this.notifyThemeChange(event.userId);
    }
  }
}
```

### User Preferences

1. Manage user preferences:
```typescript
@Injectable()
export class PreferenceService {
  constructor(
    private readonly settingService: SettingService
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const [theme, layout, notifications] = await Promise.all([
      this.settingService.getUserSettings(userId, 'theme'),
      this.settingService.getUserSettings(userId, 'layout'),
      this.settingService.getUserSettings(userId, 'notifications'),
    ]);

    return { theme, layout, notifications };
  }
}
```

### Layout Management

1. Configure layout settings:
```typescript
@Injectable()
export class LayoutService {
  constructor(
    private readonly settingService: SettingService
  ) {}

  async updateLayout(
    userId: string,
    layout: LayoutConfig
  ): Promise<void> {
    await this.settingService.updateUserSettings(
      userId,
      'layout',
      {
        sidebar: layout.sidebar,
        toolbar: layout.toolbar,
        content: layout.content,
      }
    );
  }
}
```

### Settings Synchronization

1. Implement real-time updates:
```typescript
@WebSocketGateway()
export class SettingGateway {
  @SubscribeMessage('syncSettings')
  async handleSync(
    client: Socket,
    userId: string
  ): Promise<void> {
    const settings = await this.settingService.getAllUserSettings(
      userId
    );
    client.emit('settingsUpdate', settings);
  }
}
```

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation, including:
- Configuration options
- Theme customization
- Layout management
- User preferences
- API reference

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
