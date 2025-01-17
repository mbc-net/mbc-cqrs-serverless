import { normalize } from '@angular-devkit/core'

export function checkFilesExist(tree: any, paths: string[]): boolean {
  for (const path of paths) {
    const filePath = normalize(path)
    if (tree.exists(filePath)) {
      return true
    }
  }
  return false
}
