import {
  AmplifyAppSyncSimulator,
  AmplifyAppSyncSimulatorAuthenticationType,
  AmplifyAppSyncSimulatorConfig,
} from 'amplify-appsync-simulator';

import { schema } from './schema';
import { readVTL } from './vtl/readVTL';
import { resolversConfig } from './resolversConfig';

class AppSyncSimulator {
  httpPort: number;

  constructor(httpPort: number) {
    this.httpPort = httpPort;
  }

  async start() {
    const simulatorConfig: AmplifyAppSyncSimulatorConfig = {
      appSync: {
        defaultAuthenticationType: {
          authenticationType: AmplifyAppSyncSimulatorAuthenticationType.API_KEY,
        },
        name: 'api-local',
        additionalAuthenticationProviders: [],
        apiKey: process.env.API_KEY || 'api_key',
      },
      schema: { content: schema },
      mappingTemplates: [
        {
          path: 'sendMessage.req.vtl',
          content: readVTL('sendMessage.req.vtl'),
        },
        {
          path: 'sendMessage.res.vtl',
          content: readVTL('sendMessage.res.vtl'),
        },
      ],
      dataSources: [
        {
          type: 'NONE',
          name: 'NoneDS',
        },
      ],
      resolvers: resolversConfig,
    };
    const amplifySimulator = new AmplifyAppSyncSimulator({
      port: this.httpPort,
    });
    await amplifySimulator.start();
    await amplifySimulator.init(simulatorConfig);
  }
}

const httpPort = Number(process.env.PORT) || 4000;
const simulator = new AppSyncSimulator(httpPort);
simulator.start().then(() => {
  console.log(
    `🚀 App Sync Simulator started at http://localhost:${httpPort}/graphql`,
  );
});
