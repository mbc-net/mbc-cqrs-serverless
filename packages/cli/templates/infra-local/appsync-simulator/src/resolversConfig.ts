import {
  AppSyncSimulatorPipelineResolverConfig,
  AppSyncSimulatorUnitResolverConfig,
  RESOLVER_KIND,
} from 'amplify-appsync-simulator';

export const resolversConfig: (
  | AppSyncSimulatorPipelineResolverConfig
  | AppSyncSimulatorUnitResolverConfig
)[] = [
  {
    kind: RESOLVER_KIND.UNIT,
    typeName: 'Mutation',
    fieldName: 'sendMessage',
    dataSourceName: 'NoneDS',
    requestMappingTemplateLocation: 'sendMessage.req.vtl',
    responseMappingTemplateLocation: 'sendMessage.res.vtl',
  },
];
