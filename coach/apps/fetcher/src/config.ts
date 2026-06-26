import { z } from "zod";
import { paths, readJson } from "@coach/lib";

const StdioTransport = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
});

const HttpTransport = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).default({}),
});

const Fetch = z.object({
  tool: z.string(),
  args: z.record(z.unknown()).default({}),
  kind: z.enum(["health", "activities"]),
});

const Source = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  schedule: z.string().default("0 6 * * *"),
  transport: z.discriminatedUnion("type", [StdioTransport, HttpTransport]),
  fetches: z.array(Fetch),
});

const ConfigSchema = z.object({
  sources: z.array(Source),
});

export type SourceConfig = z.infer<typeof Source>;
export type FetchConfig = z.infer<typeof Fetch>;
export type CoachConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(): Promise<CoachConfig> {
  const raw = await readJson<unknown>(paths.sourcesConfig());
  if (!raw) {
    throw new Error(`No sources config found at ${paths.sourcesConfig()}`);
  }
  return ConfigSchema.parse(raw);
}
