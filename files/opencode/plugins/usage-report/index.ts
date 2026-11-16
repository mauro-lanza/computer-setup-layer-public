import { Plugin } from "@opencode/plugin"
import { homedir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"
import { chartsHtml, loadChanges } from "./charts"
import { buildReport, exportRows, loadWindows, markdownReport, openUsage, toCsv, unpricedWarning, type Format } from "./report"

const HOME = homedir()
const DB_PATH = join(HOME, ".local/share/opencode/opencode.db")
const MODELS_PATH = join(HOME, ".cache/opencode/models.json")
const CHANGES_PATH = join(HOME, ".config/opencode/usage-config-changes.json")

function resolveOutDir(outDir: string): string {
  const expanded = outDir === "~" || outDir.startsWith("~/") ? join(HOME, outDir.slice(1)) : outDir
  if (!isAbsolute(expanded)) throw new Error(`outDir must be absolute or start with ~/, got: ${outDir}`)
  return resolve(expanded)
}

export default Plugin.define({
  id: "usage-report",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "usage_report",
        description:
          "Report local OpenCode usage (cost, tokens, tool errors, shell misuse, commit style) split into windows at the major changes in ~/.config/opencode/usage-config-changes.json. Use format csv or json for one row per day, agent and model.",
        input: {
          type: "object",
          properties: { format: { type: "string", enum: ["md", "csv", "json"] } },
          required: ["format"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input) => {
          const format = (input as { format: Format }).format
          const usage = openUsage(DB_PATH, MODELS_PATH)
          const report = buildReport(format, usage, loadWindows(CHANGES_PATH))
          return { content: format === "md" ? report + unpricedWarning(usage) : report }
        },
      })
      editor.add({
        name: "usage_charts",
        description:
          "Write weekly OpenCode usage charts as one self-contained HTML page (usage-charts.html, inline SVG, no network) plus usage.csv and report.md to outDir, with markers from ~/.config/opencode/usage-config-changes.json. outDir must be an absolute path or start with ~/; it is created if missing and the write needs edit permission.",
        input: {
          type: "object",
          properties: { outDir: { type: "string", description: "Absolute output directory, or one starting with ~/" } },
          required: ["outDir"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, context) => {
          const outDir = resolveOutDir((input as { outDir: string }).outDir)
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "edit",
            resources: [outDir],
            save: [outDir],
          })
          const usage = openUsage(DB_PATH, MODELS_PATH)
          const rows = exportRows(usage)
          await Promise.all([
            Bun.write(join(outDir, "usage-charts.html"), chartsHtml(rows, loadChanges(CHANGES_PATH))),
            Bun.write(join(outDir, "usage.csv"), toCsv(rows)),
            Bun.write(join(outDir, "report.md"), markdownReport(usage, loadWindows(CHANGES_PATH))),
          ])
          return { content: `wrote usage-charts.html, usage.csv and report.md to ${outDir}\n${unpricedWarning(usage)}`.trimEnd() }
        },
      })
    })
  },
})
