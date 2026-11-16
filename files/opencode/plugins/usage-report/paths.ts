import { isAbsolute, join, resolve } from "node:path"

export interface Locations {
  db: string
  models: string
  changes: string
}

export function locations(home: string, opencodeDb: string | undefined): Locations {
  return {
    db: opencodeDb || join(home, ".local/share/opencode/opencode.db"),
    models: join(home, ".cache/opencode/models.json"),
    changes: join(home, ".config/opencode/usage-config-changes.json"),
  }
}

export function resolveOutDir(outDir: string, home: string): string {
  const expanded = outDir === "~" || outDir.startsWith("~/") ? join(home, outDir.slice(1)) : outDir
  if (!isAbsolute(expanded)) throw new Error(`outDir must be absolute or start with ~/, got: ${outDir}`)
  return resolve(expanded)
}
