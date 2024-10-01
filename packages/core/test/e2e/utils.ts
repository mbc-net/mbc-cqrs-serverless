import { DetailDto } from '../../src/'
import { getItem, getTableName, TableType } from './dynamo-client'

const options = {
  retries: 10,
  retryIntervalMs: 3000,
}

const retry = async <T>(
  fn: () => Promise<T> | T,
  { retries, retryIntervalMs }: { retries: number; retryIntervalMs: number },
): Promise<T> => {
  try {
    await sleep(retryIntervalMs)
    return await fn()
  } catch (error) {
    if (retries <= 0) {
      throw error
    }
    await sleep(retryIntervalMs)
    return retry(fn, { retries: retries - 1, retryIntervalMs })
  }
}

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

const syncDataFinished = async (tableName: string, key: DetailDto) => {
  await retry(async () => {
    const res = await getItem(getTableName(tableName, TableType.COMMAND), key)

    console.log(`@ ${JSON.stringify(key)} ${res?.status}`)
    if (res?.status === 'finish:FINISHED') return
    else {
      throw new Error()
    }
  }, options)
}

export { retry, sleep, syncDataFinished }
