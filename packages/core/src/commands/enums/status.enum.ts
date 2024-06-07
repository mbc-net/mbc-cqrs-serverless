export enum CommandStatus {
  STATUS_STARTED = 'STARTED',
  STATUS_FAILED = 'FAILED',
  STATUS_FINISHED = 'FINISHED',
}

export function getCommandStatus(stateName: string, status: CommandStatus) {
  return `${stateName}:${status}`
}
