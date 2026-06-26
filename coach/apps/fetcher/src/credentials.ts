import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Single source of truth for tracker credentials: the existing openclaw.json.
 * Avoids duplicating tokens into a second config.
 */
function openclawJsonPath(): string {
  return process.env.COACH_OPENCLAW_JSON || path.join(os.homedir(), ".openclaw", "openclaw.json");
}

let cache: any = null;
function load(): any {
  if (cache) return cache;
  cache = JSON.parse(fs.readFileSync(openclawJsonPath(), "utf8"));
  return cache;
}

/** Returns the env block configured for an MCP server (tracker) in openclaw.json. */
export function trackerEnv(name: string): Record<string, string> {
  const server = load()?.mcp?.servers?.[name];
  return server?.env ?? {};
}

/** Returns the full MCP server config (command/args/env/cwd) for a tracker. */
export function trackerServer(name: string): {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
} | null {
  const s = load()?.mcp?.servers?.[name];
  if (!s) return null;
  return { command: s.command, args: s.args ?? [], env: s.env ?? {}, cwd: s.cwd };
}
