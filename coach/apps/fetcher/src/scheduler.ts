import cron from "node-cron";
import { loadConfig } from "./config.js";
import { runSource } from "./run.js";

/**
 * Long-running scheduler. Registers one cron job per enabled source using its
 * `schedule`. This is the process that runs in the Docker container in production.
 */
async function main() {
  const config = await loadConfig();
  const enabled = config.sources.filter((s) => s.enabled);

  if (enabled.length === 0) {
    process.stderr.write("[scheduler] no enabled sources in config/sources.json\n");
  }

  for (const source of enabled) {
    if (!cron.validate(source.schedule)) {
      process.stderr.write(
        `[scheduler] invalid cron "${source.schedule}" for ${source.name}, skipping\n`,
      );
      continue;
    }
    cron.schedule(source.schedule, async () => {
      process.stderr.write(`[scheduler] tick: ${source.name}\n`);
      const r = await runSource(source);
      if (!r.ok) process.stderr.write(`[scheduler] ${source.name} failed: ${r.error}\n`);
    });
    process.stderr.write(`[scheduler] registered ${source.name} @ "${source.schedule}"\n`);
  }

  // Optional: run once on startup so data is fresh immediately.
  if (process.env.COACH_FETCH_ON_START === "1") {
    for (const source of enabled) await runSource(source);
  }

  process.stderr.write("[scheduler] running. Ctrl-C to stop.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
