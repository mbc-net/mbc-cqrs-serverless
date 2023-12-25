function getBytesInStr(str: string): number {
  return new Blob([str]).size
}

// recursive function to get all text in object
function getAllText(obj: any): string {
  let text = ''

  if (!obj) return text

  const keys = Object.keys(obj)

  keys.forEach((key) => {
    text += key

    const value = obj[key]
    // check if value is object
    if (typeof value === 'object') {
      text += getAllText(value)
    } else {
      text += value
    }
  })

  return text
}

export function getBytesInObj(obj: any): number {
  const text = getAllText(obj)

  return getBytesInStr(text)
}
