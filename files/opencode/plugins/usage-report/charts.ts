import { existsSync, readFileSync } from "node:fs"
import { ERROR_CLASSES, localDay, parseLocal, weekOf, type ExportRow, type NumericColumn } from "./report"

export interface Change {
  day: string
  label: string
  major: boolean
}

interface Layer {
  name: string
  values: (number | null)[]
}

interface Line extends Layer {
  color: string
  dash?: string
  axis: "left" | "right"
}

interface Chart {
  title: string
  left: string
  right?: string
  rightMax?: number
  bars: Layer[]
  lines: Line[]
}

const TOP_MODELS = 6
const PALETTE = ["#4c78a8", "#f58518", "#54a24b", "#e45756", "#72b7b2", "#b279a2", "#ff9da6", "#9d755d", "#bab0ac", "#eeca3b"]
const WIDTH = 960
const PLOT = { left: 70, right: 70, top: 150, height: 300 }
const PLOT_WIDTH = WIDTH - PLOT.left - PLOT.right
const BAR_DAYS = 6
const LABEL_MAX = 32

type Totals = Record<NumericColumn, number>

export function loadChanges(path: string): Change[] {
  if (!existsSync(path)) return []
  return (JSON.parse(readFileSync(path, "utf8")) as { date: string; label: string; major: boolean }[]).map((c) => ({
    day: localDay(parseLocal(c.date)),
    label: c.label,
    major: c.major,
  }))
}

const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5
const ratio = (num: number, den: number) => (den ? num / den : null)
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

function compact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${Number((v / 1e9).toPrecision(3))}B`
  if (abs >= 1e6) return `${Number((v / 1e6).toPrecision(3))}M`
  if (abs >= 1e4) return `${Number((v / 1e3).toPrecision(3))}k`
  return String(Number(v.toPrecision(3)))
}

function axisTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!
  const ticks: number[] = []
  for (let i = 0; i * step < max + step; i++) ticks.push(Number((i * step).toPrecision(12)))
  return ticks
}

function weeklyTotals(rows: ExportRow[]): Map<string, Totals> {
  const out = new Map<string, Totals>()
  for (const r of rows) {
    const week = weekOf(parseLocal(r.day))
    if (!out.has(week)) out.set(week, {} as Totals)
    const t = out.get(week)!
    for (const k of Object.keys(r) as (keyof ExportRow)[]) if (typeof r[k] === "number" && k !== "tool_calls_per_user_turn") t[k as NumericColumn] = (t[k as NumericColumn] ?? 0) + (r[k] as number)
  }
  return out
}

function callsBy(rows: ExportRow[], key: "model" | "agent", top: number | null): { name: string; byWeek: Map<string, number> }[] {
  const groups = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!groups.has(r[key])) groups.set(r[key], new Map())
    const week = weekOf(parseLocal(r.day))
    groups.get(r[key])!.set(week, (groups.get(r[key])!.get(week) ?? 0) + r.assistant_calls)
  }
  const total = (g: Map<string, number>) => [...g.values()].reduce((a, b) => a + b, 0)
  const ranked = [...groups].sort((a, b) => total(b[1]) - total(a[1]))
  const kept = ranked.slice(0, top ?? ranked.length).map(([name, byWeek]) => ({ name, byWeek }))
  if (top !== null && ranked.length > top) {
    const other = new Map<string, number>()
    for (const [, g] of ranked.slice(top)) for (const [w, n] of g) other.set(w, (other.get(w) ?? 0) + n)
    kept.push({ name: "other", byWeek: other })
  }
  return kept
}

function buildCharts(rows: ExportRow[]): { charts: Chart[]; weeks: string[] } {
  const totals = weeklyTotals(rows)
  const weeks = [...totals.keys()].sort()
  const series = (f: (t: Totals) => number | null) => weeks.map((w) => f(totals.get(w)!))
  const stacked = (groups: ReturnType<typeof callsBy>): Layer[] => groups.map((g) => ({ name: g.name, values: weeks.map((w) => g.byWeek.get(w) ?? 0) }))
  const line = (name: string, color: string, axis: Line["axis"], values: (number | null)[], dash?: string): Line => ({ name, color, axis, values, dash })

  const charts: Chart[] = [
    {
      title: "Cost",
      left: "USD / week",
      right: "USD / root session",
      bars: [{ name: "cost_list per week ($)", values: series((t) => t.cost_list) }],
      lines: [
        line("cost_reported per week ($)", "#000000", "left", series((t) => t.cost_reported), "6 4"),
        line("cost_list per root session", "#d62728", "right", series((t) => ratio(t.cost_list, t.root_sessions))),
      ],
    },
    {
      title: "Tokens and cache hit",
      left: "tokens / week",
      right: "cache-hit ratio",
      rightMax: 1,
      bars: [
        { name: "fresh input", values: series((t) => t.tokens_input) },
        { name: "cache read", values: series((t) => t.tokens_cache_read) },
        { name: "cache write", values: series((t) => t.tokens_cache_write) },
        { name: "output", values: series((t) => t.tokens_output) },
      ],
      lines: [line("cache-hit ratio", "#000000", "right", series((t) => ratio(t.tokens_cache_read, t.tokens_input + t.tokens_cache_read + t.tokens_cache_write)))],
    },
    {
      title: "Sessions and tool calls per turn",
      left: "sessions / week",
      right: "tool calls / user turn",
      bars: [
        { name: "root sessions", values: series((t) => t.root_sessions) },
        { name: "subagent sessions", values: series((t) => t.subagent_sessions) },
      ],
      lines: [line("tool calls per user turn", "#d62728", "right", series((t) => ratio(t.tool_calls, t.user_turns)))],
    },
    { title: "Assistant calls by model", left: "assistant calls / week", bars: stacked(callsBy(rows, "model", TOP_MODELS)), lines: [] },
    { title: "Assistant calls by agent", left: "assistant calls / week", bars: stacked(callsBy(rows, "agent", null)), lines: [] },
    {
      title: "Shell error rates",
      left: "share of shell calls",
      right: "share of tool calls",
      bars: [],
      lines: [
        ...ERROR_CLASSES.map((k, i) => line(`${k} / shell calls`, PALETTE[i], "left", series((t) => ratio(t[`shell_${k}`], t.shell_calls)))),
        line("shell share of tool calls", "#000000", "right", series((t) => ratio(t.shell_calls, t.tool_calls)), "6 4"),
        line("execute share of tool calls", "#9467bd", "right", series((t) => ratio(t.execute_calls, t.tool_calls)), "2 3"),
      ],
    },
    {
      title: "Lines per root session, compactions, aborts",
      left: "lines / root session",
      right: "count / week",
      bars: [],
      lines: [
        line("lines added / root session", "#2ca02c", "left", series((t) => ratio(t.lines_added, t.root_sessions))),
        line("lines deleted / root session", "#d62728", "left", series((t) => ratio(t.lines_deleted, t.root_sessions))),
        line("compactions / week", "#1f77b4", "right", series((t) => t.compactions), "2 3"),
        line("aborts / week", "#ff7f0e", "right", series((t) => t.aborted_messages), "2 3"),
      ],
    },
  ]
  return { charts, weeks }
}

function renderChart(chart: Chart, index: number, weeks: string[], changes: Change[]): string {
  const lo = dayNumber(weeks[0])
  const hi = dayNumber(weeks.at(-1)!) + 7
  const x = (d: number) => PLOT.left + ((d - lo) / (hi - lo)) * PLOT_WIDTH
  const partial = weeks.length - 1
  const stackTotals = weeks.map((_, i) => chart.bars.reduce((a, b) => a + (b.values[i] ?? 0), 0))
  const maxOf = (axis: Line["axis"]) => Math.max(0, ...chart.lines.filter((l) => l.axis === axis).flatMap((l) => l.values.map((v) => v ?? 0)))
  const leftTicks = axisTicks(Math.max(...stackTotals, maxOf("left")))
  const rightTicks = chart.right ? axisTicks(chart.rightMax ?? maxOf("right")) : []
  const y = (v: number, ticks: number[]) => PLOT.top + PLOT.height - (v / ticks.at(-1)!) * PLOT.height
  const bottom = PLOT.top + PLOT.height
  const hatch = `hatch-${index}`
  const out: string[] = []

  out.push(`<pattern id="${hatch}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-width="2.5"/></pattern>`)
  for (const v of leftTicks) {
    out.push(`<line x1="${PLOT.left}" x2="${WIDTH - PLOT.right}" y1="${y(v, leftTicks)}" y2="${y(v, leftTicks)}" stroke="#e5e5e5"/>`)
    out.push(`<text x="${PLOT.left - 6}" y="${y(v, leftTicks) + 4}" text-anchor="end">${compact(v)}</text>`)
  }
  for (const v of rightTicks) out.push(`<text x="${WIDTH - PLOT.right + 6}" y="${y(v, rightTicks) + 4}">${compact(v)}</text>`)
  out.push(`<text transform="translate(14 ${PLOT.top + PLOT.height / 2}) rotate(-90)" text-anchor="middle">${escape(chart.left)}</text>`)
  if (chart.right) out.push(`<text transform="translate(${WIDTH - 14} ${PLOT.top + PLOT.height / 2}) rotate(90)" text-anchor="middle">${escape(chart.right)}</text>`)

  const labelEvery = Math.ceil(weeks.length / 18)
  weeks.forEach((w, i) => {
    if (i % labelEvery) return
    out.push(`<text transform="translate(${x(dayNumber(w)) + 4} ${bottom + 14}) rotate(45)">${w.slice(5)}</text>`)
  })

  const floor = new Array<number>(weeks.length).fill(0)
  chart.bars.forEach((layer, li) => {
    const color = PALETTE[li % PALETTE.length]
    weeks.forEach((w, i) => {
      const value = layer.values[i] ?? 0
      if (!value) return
      const x0 = x(dayNumber(w))
      const width = x(dayNumber(w) + BAR_DAYS) - x0
      const top = y(floor[i] + value, leftTicks)
      const height = y(floor[i], leftTicks) - top
      const opacity = i === partial ? ' fill-opacity="0.45"' : ""
      out.push(`<rect x="${x0}" y="${top}" width="${width}" height="${height}" fill="${color}"${opacity}><title>${escape(layer.name)} ${w}: ${compact(value)}</title></rect>`)
      if (i === partial) out.push(`<rect x="${x0}" y="${top}" width="${width}" height="${height}" fill="url(#${hatch})" fill-opacity="0.6"/>`)
      floor[i] += value
    })
  })

  for (const change of changes) {
    const d = dayNumber(change.day)
    if (d < lo || d > hi) continue
    const cx = x(d)
    out.push(
      change.major
        ? `<line x1="${cx}" x2="${cx}" y1="${PLOT.top}" y2="${bottom}" stroke="#000" stroke-width="1.2"/>`
        : `<line x1="${cx}" x2="${cx}" y1="${PLOT.top}" y2="${bottom}" stroke="#888" stroke-dasharray="4 3" opacity="0.7"/>`,
    )
    if (change.major) {
      const label = change.label.length <= LABEL_MAX ? change.label : change.label.slice(0, LABEL_MAX - 2) + "…"
      out.push(`<text font-size="10" transform="translate(${cx + 3} ${PLOT.top - 4}) rotate(-60)">${escape(label)}</text>`)
    }
  }

  for (const l of chart.lines) {
    const ticks = l.axis === "left" ? leftTicks : rightTicks
    const points = l.values.flatMap((v, i) => (v === null ? [] : [{ px: x(dayNumber(weeks[i]) + 3.5), py: y(v, ticks), v, i }]))
    if (points.length > 1) out.push(`<polyline fill="none" stroke="${l.color}" stroke-width="1.8"${l.dash ? ` stroke-dasharray="${l.dash}"` : ""} points="${points.map((p) => `${p.px},${p.py}`).join(" ")}"/>`)
    for (const p of points) {
      const hollow = p.i === partial
      out.push(`<circle cx="${p.px}" cy="${p.py}" r="${hollow ? 5 : 3}" fill="${hollow ? "#fff" : l.color}" stroke="${l.color}" stroke-width="1.5"><title>${escape(l.name)} ${weeks[p.i]}: ${compact(p.v)}</title></circle>`)
    }
  }

  const items = [...chart.bars.map((b, i) => ({ name: b.name, color: PALETTE[i % PALETTE.length], swatch: "box" })), ...chart.lines.map((l) => ({ name: l.name, color: l.color, swatch: "line" }))]
  let lx = PLOT.left
  let ly = bottom + 62
  for (const item of items) {
    const itemWidth = 30 + item.name.length * 6.2
    if (lx + itemWidth > WIDTH - PLOT.right) {
      lx = PLOT.left
      ly += 16
    }
    out.push(item.swatch === "box" ? `<rect x="${lx}" y="${ly - 9}" width="10" height="10" fill="${item.color}"/>` : `<line x1="${lx}" x2="${lx + 12}" y1="${ly - 4}" y2="${ly - 4}" stroke="${item.color}" stroke-width="2"/>`)
    out.push(`<text x="${lx + 16}" y="${ly}">${escape(item.name)}</text>`)
    lx += itemWidth
  }

  const height = ly + 12
  return `<svg viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" font-family="system-ui, sans-serif" font-size="11" role="img" aria-label="${escape(chart.title)}">\n${out.join("\n")}\n</svg>`
}

/** One self-contained HTML page with an inline SVG per chart; no scripts or network. */
export function chartsHtml(rows: ExportRow[], changes: Change[]): string {
  const { charts, weeks } = buildCharts(rows)
  const sections = charts.map((c, i) => `<section><h2>${escape(c.title)}</h2>\n${renderChart(c, i, weeks, changes)}</section>`)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>OpenCode usage</title>
<style>body{font-family:system-ui,sans-serif;margin:24px auto;max-width:980px;color:#222}h2{font-size:16px;margin:28px 0 4px}svg{max-width:100%;height:auto}</style>
</head>
<body>
<h1>OpenCode usage by week</h1>
<p>Hatched bars and hollow markers are the current, partial week. Solid black lines are major config changes, dashed gray lines minor ones.</p>
${sections.join("\n")}
</body>
</html>
`
}
