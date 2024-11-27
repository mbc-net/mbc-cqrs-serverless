import { Config, Env } from './type'
import dev from './dev'
import stg from './stg'
import prod from './prod'

export function getConfig(env: Env): Config {
  if (env === 'prod') {
    return prod
  }
  if (env === 'stg') {
    return stg
  }
  return dev
}

export * from './constant'
export * from './type'
