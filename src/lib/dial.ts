// Geometry for the reminder dial behind the bell (design/prototype.dc.html, `dial`).
// The arc runs a quarter circle from 4 am (left) to midnight (top), in 15-minute steps.

export const DIAL = { cx: 300, cy: 300, r: 226, size: 352 } as const
const FIRST = 240 // 4:00 am, in minutes
const SPAN = 1200 // 4 am → midnight

export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

export function fromMinutes(m: number): string {
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** '20:00' → '8:00 pm' */
export function format12(m: number): string {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`
}

/** The point on the arc for a time, at radius r. */
export function pointAt(m: number, r: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, (m - FIRST) / SPAN))
  const th = Math.PI * (1 - t / 2)
  return {
    x: Math.round((DIAL.cx + r * Math.cos(th)) * 10) / 10,
    y: Math.round((DIAL.cy - r * Math.sin(th)) * 10) / 10,
  }
}

/** The time (snapped to 15 minutes) for a pointer at (px, py) in dial coordinates. */
export function minutesAt(px: number, py: number): number {
  let a = Math.atan2(DIAL.cy - py, px - DIAL.cx)
  if (a < 0) a = px < DIAL.cx ? Math.PI : Math.PI / 2
  a = Math.min(Math.PI, Math.max(Math.PI / 2, a))
  return Math.min(1440, FIRST + Math.round((((Math.PI - a) / (Math.PI / 2)) * SPAN) / 15) * 15)
}

/** The 21 hour ticks, 4 am to midnight; every 4th hour is a major tick. */
export function ticks(on: boolean) {
  return Array.from({ length: 21 }, (_, k) => {
    const m = (4 + k) * 60
    const major = (4 + k) % 4 === 0
    const len = major ? 12 : 6
    const a = pointAt(m, DIAL.r - len)
    const b = pointAt(m, DIAL.r + len)
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: major ? 2 : 1.25, opacity: on ? (major ? 0.9 : 0.5) : 0.3 }
  })
}
