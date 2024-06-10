// NEXT_PUBLIC_TIMEZONE_OFFSET
// get offset timezone
export const tzOffset = process.env.NEXT_PUBLIC_TIMEZONE_OFFSET || '+00:00'

function offsetToMinutes(offset: string) {
  const sign = offset[0]
  const hours = parseInt(offset.slice(1, 3), 10)
  const minutes = parseInt(offset.slice(4), 10)

  let totalMinutes = hours * 60 + minutes

  if (sign === '-') {
    totalMinutes = -totalMinutes
  }

  return totalMinutes
}
const offsetMinutes = offsetToMinutes(tzOffset)

// date format
export function formatDate(
  date: Date | string | number | undefined,
  format: string = 'yyyy年m月dd日',
  includeDayOfWeek?: boolean,
) {
  if (!date) {
    return ''
  }
  if (typeof date === 'string' || typeof date === 'number') {
    date = new Date(date)
  }
  date = toCurrentTz(date)

  let str = format.replace(/yyyy/g, date.getFullYear().toString())
  str = str.replace(/mm/g, (date.getMonth() + 1).toString().padStart(2, '0'))
  str = str.replace(/m/g, (date.getMonth() + 1).toString())
  str = str.replace(/dd/g, date.getDate().toString().padStart(2, '0'))
  str = str.replace(/d/g, date.getDate().toString())
  str = str.replace(/HH/g, date.getHours().toString().padStart(2, '0'))
  str = str.replace(/H/g, date.getHours().toString())
  str = str.replace(/MM/g, date.getMinutes().toString().padStart(2, '0'))
  str = str.replace(/M/g, date.getMinutes().toString())
  str = str.replace(/SS/g, date.getSeconds().toString().padStart(2, '0'))
  str = str.replace(/S/g, date.getSeconds().toString())

  if (includeDayOfWeek) {
    str = `${str}（${getDayOfWeek(date)}）`
  }

  return str
}

export function getDayOfWeek(date: Date) {
  return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
}

// get financial year
export function getCurrentYear() {
  const today = getTodayInTz()
  let currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  if (currentMonth < 3) {
    currentYear = currentYear - 1
  }
  return currentYear
}

export function getCurrentFinancialYear(): {
  start: Date
  mid: Date
  end: Date
} {
  const currentYear = getCurrentYear()
  return getFinancialYearByYear(currentYear)
}

export function getNextFinancialYear(): {
  start: Date
  mid: Date
  end: Date
} {
  const today = getTodayInTz()
  let currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  if (currentMonth < 3) {
    currentYear = currentYear - 1
  }
  return getFinancialYearByYear(currentYear + 1)
}

export function getFinancialYearByYear(year: number): {
  start: Date
  mid: Date
  end: Date
} {
  const start = toCurrentTz(new Date(`${year}-04-01`), true)

  const mid = new Date(start.getTime())
  mid.setMonth(start.getMonth() + 6)

  const end = toCurrentTz(new Date(`${year + 1}-04-01`), true)
  end.setDate(end.getDate() - 1)

  return { start, mid, end }
}

export function nowIsFirstHalfFinancialYear(): boolean {
  const { start, mid } = getCurrentFinancialYear()
  const month = getTodayInTz().getMonth()
  return month >= start.getMonth() && month < mid.getMonth()
}

// date calculating and timezone
export function toCurrentTz(date: Date, isResetDate = false) {
  if (date.getTimezoneOffset() === -offsetMinutes) {
    // Current Timezone
    return date
  }
  const ret = new Date(
    date.getTime() + (date.getTimezoneOffset() + offsetMinutes) * 60 * 1000,
  )
  if (isResetDate) {
    ret.setHours(0, 0, 0, 0)
  }

  return ret
}

export function getTodayInTz() {
  const today = new Date()
  return toCurrentTz(today, true)
}

export function toUTC(date: Date) {
  return new Date(
    date.getTime() - (date.getTimezoneOffset() + offsetMinutes) * 60 * 1000,
  )
}

export function todayUTC() {
  return toUTC(getTodayInTz())
}

export function toISOString(date: Date) {
  if (!date) {
    return undefined
  }
  return date.toISOString()
}

export function toISOStringWithTimezone(date: Date, forcedTz = false) {
  if (!date) {
    return undefined
  }
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
    (forcedTz ? tzOffset : getTimezoneOffset(date))
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

function pad(n: number) {
  return `${Math.floor(Math.abs(n))}`.padStart(2, '0')
}

// Get timezone offset in ISO format (+hh:mm or -hh:mm)
function getTimezoneOffset(date: Date) {
  const tzOffset = -date.getTimezoneOffset()
  const diff = tzOffset >= 0 ? '+' : '-'
  return diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60)
}

export function checkValidDate(dateString: string) {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}
