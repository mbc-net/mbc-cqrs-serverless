function pad(n: number) {
  return `${Math.floor(Math.abs(n))}`.padStart(2, '0')
}

// Get timezone offset in ISO format (+hh:mm or -hh:mm)
function getTimezoneOffset(date: Date) {
  const tzOffset = -date.getTimezoneOffset()
  const diff = tzOffset >= 0 ? '+' : '-'
  return diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60)
}

export function toISOString(date: Date) {
  return date.toISOString()
}

export function toISOStringWithTimezone(date: Date) {
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    getTimezoneOffset(date)
  )
}

export function isISOString(val: string) {
  const d = new Date(val)
  return !Number.isNaN(d.valueOf()) && d.toISOString() === val
}

export function isISOStringWithTimezone(val: string) {
  const d = new Date(val)
  return !Number.isNaN(d.valueOf()) && toISOStringWithTimezone(d) === val
}
