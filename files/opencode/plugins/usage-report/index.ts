import { Plugin } from "@opencode/plugin"
import { homedir } from "node:os"
import { join } from "node:path"
import { chartsHtml } from "./charts"
import { buildReport, exportRows, loadWindows, markdownReport, readChanges, toCsv, type Format } from "./report"
import { openUsage, usageWarnings } from "./usage"
import { locations, resolveOutDir } from "./paths"

export default Plugin.define({
  id: "usage-report",
  async setup(ctx) {
    const home = homedir()
    const paths = locations(home, process.env.OPENCODE_DB)
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
          const usage = openUsage(paths.db, paths.models)
          const report = buildReport(format, usage, loadWindows(readChanges(paths.changes)))
          return { content: format === "md" ? report + usageWarnings(usage) : report }
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
          const outDir = resolveOutDir((input as { outDir: string }).outDir, home)
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "edit",
            resources: [outDir],
            save: [outDir],
          })
          const usage = openUsage(paths.db, paths.models)
          const rows = exportRows(usage)
          const changes = readChanges(paths.changes)
          await Promise.all([
            Bun.write(join(outDir, "usage-charts.html"), chartsHtml(rows, changes)),
            Bun.write(join(outDir, "usage.csv"), toCsv(rows)),
            Bun.write(join(outDir, "report.md"), markdownReport(usage, loadWindows(changes))),
          ])
          return { content: `wrote usage-charts.html, usage.csv and report.md to ${outDir}\n${usageWarnings(usage)}`.trimEnd() }
        },
      })
    })
  },
})
