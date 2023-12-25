import { VER_SEPARATOR } from '../constants/key'

export function addSortKeyVersion(sk: string, version: number) {
  return `${removeSortKeyVersion(sk)}${VER_SEPARATOR}${version}`
}

export function removeSortKeyVersion(sk: string) {
  const lastDivIdx = sk.lastIndexOf(VER_SEPARATOR)
  if (lastDivIdx === -1) {
    return sk
  }
  return sk.substring(0, lastDivIdx)
}
