const pad = (n: number) => String(n).padStart(2, "0")
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// A date-only string is local midnight, unlike `new Date(string)`, which reads it as UTC.
export function parseLocal(date: string): number {
  return new Date(/^\d{4}-\d\d-\d\d$/.test(date) ? `${date}T00:00:00` : date).getTime()
}

export function localDay(t: number): string {
  return isoDay(new Date(t))
}

export function weekOf(t: number): string {
  const d = new Date(t)
  return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)))
}
