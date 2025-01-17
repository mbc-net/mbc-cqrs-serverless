import { CommandModule } from '@mbc-cqrs-serverless/core'
import { Module } from '@nestjs/common'

<% if (schema) { %>import { <%= classify(name) %>DataSyncRdsHandler } from './handler/<%= dasherize(name) %>-rds.handler'<% } %>
import { <%= classify(name) %>Controller } from './<%= dasherize(name) %>.controller'
import { <%= classify(name) %>Service } from './<%= dasherize(name) %>.service'

@Module({
  imports: [
    CommandModule.register({
      tableName: '<%= dasherize(name) %>',
      <% if (schema) { %>dataSyncHandlers: [<%= classify(name) %>DataSyncRdsHandler],<% }
      else { %>dataSyncHandlers: [],<% } %>
    }),
  ],
  controllers: [<%= classify(name) %>Controller],
  providers: [<%= classify(name) %>Service],
})
export class <%= classify(name) %>Module {}
