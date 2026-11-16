import { isAbsolute, join, resolve } from "node:path"

export interface Locations {
  db: string
  models: string
  changes: string
}

export interface PathEnv {
  OPENCODE_DB?: string
  XDG_DATA_HOME?: string
  XDG_CACHE_HOME?: string
  XDG_CONFIG_HOME?: string
}

/** Mirrors OpenCode's global roots: XDG variables first, then the home defaults; a relative OPENCODE_DB is resolved against the data dir. */
export function locations(home: string, env: PathEnv): Locations {
  const data = env.XDG_DATA_HOME || join(home, ".local/share")
  const cache = env.XDG_CACHE_HOME || join(home, ".cache")
  const config = env.XDG_CONFIG_HOME || join(home, ".config")
  return {
    db: resolve(join(data, "opencode"), env.OPENCODE_DB || "opencode.db"),
    models: join(cache, "opencode/models.json"),
    changes: join(config, "opencode/usage-config-changes.json"),
  }
}

export function resolveOutDir(outDir: string, home: string): string {
  const expanded = outDir === "~" || outDir.startsWith("~/") ? join(home, outDir.slice(1)) : outDir
  if (!isAbsolute(expanded)) throw new Error(`outDir must be absolute or start with ~/, got: ${outDir}`)
  return resolve(expanded)
}
