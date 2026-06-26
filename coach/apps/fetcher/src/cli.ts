import { runAll } from "./run.js";

/**
 * One-shot fetch runner. Examples:
 *   npm run fetch                      # all enabled sources
 *   npm run fetch -- --source mock     # one source (even if disabled)
 *   npm run fetch -- --source polar,garmin
 */
async function main() {
  const args = process.argv.slice(2);
  let only: string[] | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" || args[i] === "-s") {
      only = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  const results = await runAll({ only });
  const failed = results.filter((r) => !r.ok);
  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
