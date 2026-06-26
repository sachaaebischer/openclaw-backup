import { PlanSchema, paths, readJson } from "@coach/lib";

/**
 * Validates plan/current.json against the schema. The coach agent should run this
 * after writing a plan (`npm run validate-plan`) to catch mistakes deterministically.
 */
async function main() {
  const raw = await readJson<unknown>(paths.planJson());
  if (!raw) {
    console.error(`No plan found at ${paths.planJson()}`);
    process.exit(1);
  }
  const result = PlanSchema.safeParse(raw);
  if (!result.success) {
    console.error("Plan is INVALID:\n");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  const plan = result.data;
  const sessions = plan.days.reduce((n, d) => n + d.sessions.length, 0);
  console.log(`Plan OK: week of ${plan.week_start}, ${plan.days.length} days, ${sessions} sessions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
