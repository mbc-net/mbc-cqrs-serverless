export function isObject(item: any) {
  return !!item && typeof item === 'object' && !Array.isArray(item)
}

// deep merge objects without mutating the input parameters
export function mergeDeep(target: any, ...sources: any[]) {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

// calculate the object bytes
export function objectBytes(obj: any) {
  return Buffer.byteLength(JSON.stringify(obj))
}

export function pickKeys(obj: any, keys: string[]) {
  const result: any = {}
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}

export function omitKeys(obj: any, keys: string[]) {
  const result: any = {}
  for (const key in obj) {
    if (!keys.includes(key)) {
      result[key] = obj[key]
    }
  }
  return result
}
