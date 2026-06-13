export function todayString() {
  return toDateString(new Date())
}

export function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function subtractDays(days) {
  const date = new Date()
  date.setDate(date.getDate() - days + 1)
  return toDateString(date)
}
