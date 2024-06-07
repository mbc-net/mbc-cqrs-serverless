export function getCommandSource(
  moduleName: string,
  controllerName: string,
  method: string,
) {
  return `[${moduleName}]:${controllerName}.${method}`
}
