export enum DataSyncCommandSfnName {
  CHECK_VERSION = 'check_version',
  WAIT_PREV_COMMAND = 'wait_prev_command',
  HISTORY_COPY = 'history_copy',
  TRANSFORM_DATA = 'transform_data',
  SYNC_DATA = 'sync_data',
  FINISH = 'finish',
  FAIL = 'fail',
  SUCCESS = 'success',
}
