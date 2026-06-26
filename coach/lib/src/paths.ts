import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the data directory. Defaults to `<repo>/data`, but can be overridden
 * with COACH_DATA_DIR so the same code works when `data/` is bind-mounted into
 * the agent's directory in production.
 */
export function dataDir(): string {
  if (process.env.COACH_DATA_DIR) {
    return path.resolve(process.env.COACH_DATA_DIR);
  }
  // lib/src/paths.ts -> repo root is three levels up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "data");
}

export function configDir(): string {
  if (process.env.COACH_CONFIG_DIR) return path.resolve(process.env.COACH_CONFIG_DIR);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "config");
}

export const paths = {
  data: dataDir,
  config: configDir,
  healthCsv: () => path.join(dataDir(), "health", "daily.csv"),
  activitiesCsv: () => path.join(dataDir(), "activities", "activities.csv"),
  gymSessionsDir: () => path.join(dataDir(), "gym", "sessions"),
  gymSession: (date: string) => path.join(dataDir(), "gym", "sessions", `${date}.json`),
  gymLogCsv: () => path.join(dataDir(), "gym", "log.csv"),
  planJson: () => path.join(dataDir(), "plan", "current.json"),
  planMd: () => path.join(dataDir(), "plan", "current.md"),
  analysisMd: () => path.join(dataDir(), "analysis", "latest.md"),
  constraintsDir: () => path.join(dataDir(), "plan", "constraints"),
  constraints: (weekStart: string) => path.join(dataDir(), "plan", "constraints", `${weekStart}.json`),
  syncState: () => path.join(dataDir(), "state", "last_sync.json"),
  rawDir: (source: string) => path.join(dataDir(), "raw", source),
  raw: (source: string, date: string) =>
    path.join(dataDir(), "raw", source, `${date}.json`),
  sourcesConfig: () => path.join(configDir(), "sources.json"),
};
