import * as fs from "node:fs";
import * as path from "node:path";

type PlanMeta = {
  id: string;
  name: string;
  category: string;
  level: string;
  lengthWeeks: number;
  sourceFile: string;
};

type ParsedPlan = {
  meta: PlanMeta;
  weeksKm: { weekNumber: number; days: { type: string; label?: string }[] }[];
};

type TypicalWeekClaims = {
  runDays?: number;
  crossDays?: number;
  dayOffs?: number;
};

type TruthReport = {
  planId: string;
  sourceFile: string;
  level: string;
  claims: TypicalWeekClaims;
  observed: {
    avgRunDays: number;
    avgCrossDays: number;
    avgRestDays: number;
  };
  checks: {
    lengthMatches: boolean;
    runDaysMatches?: boolean;
    crossDaysMatches?: boolean;
    dayOffsMatches?: boolean;
  };
};

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "hal-higdon");
const PARSED_DIR = path.join(DATA_DIR, "parsed");

function normalizeLevel(level: string): string {
  return level.replace(/\s+/g, " ").trim().toLowerCase();
}

function levelMatchesHeading(level: string, heading: string): boolean {
  const a = normalizeLevel(level).replace(/[()]/g, "");
  const b = normalizeLevel(heading).replace(/[()]/g, "");
  if (b.includes(a)) return true;
  if (a.includes("half marathon 3") && b.includes("hm3")) return true;
  return false;
}

function splitAboutSections(content: string): { heading: string; body: string }[] {
  const lines = content.split(/\r?\n/);
  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^###\s+About the .+ Program/i.test(lines[i])) idxs.push(i);
  }
  const sections: { heading: string; body: string }[] = [];
  for (let i = 0; i < idxs.length; i++) {
    const start = idxs[i];
    const end = i + 1 < idxs.length ? idxs[i + 1] : lines.length;
    const heading = lines[start].replace(/^###\s+/, "").trim();
    const bodyLines: string[] = [];
    for (let j = start + 1; j < end; j++) {
      if (/^\|\s*Week\s*\|/i.test(lines[j])) break;
      bodyLines.push(lines[j]);
    }
    sections.push({ heading, body: bodyLines.join("\n") });
  }
  return sections;
}

function parseTypicalWeek(body: string): TypicalWeekClaims {
  const lineMatch = body.match(/\*\*Typical Week:\*\*\s*([^\n\r]+)/i);
  if (!lineMatch) return {};
  const line = lineMatch[1];
  const run = line.match(/(\d+)\s*Run/i);
  const cross = line.match(/(\d+)\s*(?:X-Train|Cross(?:-Training)?)/i);
  const dayOff = line.match(/(\d+)\s*Day Off/i);
  return {
    runDays: run ? parseInt(run[1], 10) : undefined,
    crossDays: cross ? parseInt(cross[1], 10) : undefined,
    dayOffs: dayOff ? parseInt(dayOff[1], 10) : undefined,
  };
}

function observedStructure(plan: ParsedPlan) {
  const weeks = plan.weeksKm ?? [];
  if (weeks.length === 0) return { avgRunDays: 0, avgCrossDays: 0, avgRestDays: 0 };
  let run = 0;
  let cross = 0;
  let rest = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      if (day.type === "cross") cross += 1;
      else if (day.type === "rest") rest += 1;

      if (day.type === "optional_run") {
        run += 0.5;
        if ((day.label ?? "").toLowerCase().includes("cross")) cross += 0.5;
      } else if (day.type !== "rest" && day.type !== "cross") {
        run += 1;
      }
    }
  }
  const n = weeks.length;
  return {
    avgRunDays: Number((run / n).toFixed(2)),
    avgCrossDays: Number((cross / n).toFixed(2)),
    avgRestDays: Number((rest / n).toFixed(2)),
  };
}

function withinOneDay(claimed: number | undefined, observed: number): boolean | undefined {
  if (claimed == null) return undefined;
  return Math.abs(claimed - observed) <= 1;
}

function main() {
  const indexPath = path.join(PARSED_DIR, "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error("Missing parsed index. Run npm run parse-plans first.");
  }
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { meta: PlanMeta }[];
  const reports: TruthReport[] = [];

  for (const item of index) {
    const meta = item.meta;
    const planPath = path.join(PARSED_DIR, `${meta.id.replace(/[^a-z0-9-]/gi, "-")}.json`);
    if (!fs.existsSync(planPath)) continue;
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as ParsedPlan;

    const sourcePath = path.join(DATA_DIR, meta.sourceFile);
    if (!fs.existsSync(sourcePath)) continue;
    const content = fs.readFileSync(sourcePath, "utf8");
    const sections = splitAboutSections(content);
    const matched = sections.find((s) => levelMatchesHeading(meta.level, s.heading)) ?? sections[0];
    const claims = matched ? parseTypicalWeek(matched.body) : {};
    const observed = observedStructure(plan);

    reports.push({
      planId: meta.id,
      sourceFile: meta.sourceFile,
      level: meta.level,
      claims,
      observed,
      checks: {
        lengthMatches: (meta.lengthWeeks || 0) === (plan.weeksKm?.length || 0),
        runDaysMatches: withinOneDay(claims.runDays, observed.avgRunDays),
        crossDaysMatches: withinOneDay(claims.crossDays, observed.avgCrossDays),
        dayOffsMatches: withinOneDay(claims.dayOffs, observed.avgRestDays),
      },
    });
  }

  const outPath = path.join(PARSED_DIR, "truth-report.json");
  fs.writeFileSync(outPath, JSON.stringify(reports, null, 2));

  const mismatches = reports.filter(
    (r) =>
      !r.checks.lengthMatches ||
      r.checks.runDaysMatches === false ||
      r.checks.crossDaysMatches === false ||
      r.checks.dayOffsMatches === false
  );

  console.log(`Audited ${reports.length} plans. Wrote ${outPath}`);
  if (mismatches.length > 0) {
    console.log(`Found ${mismatches.length} mismatch(es).`);
    for (const m of mismatches.slice(0, 10)) {
      console.log(`- ${m.planId}:`, JSON.stringify(m.checks));
    }
    process.exitCode = 1;
  } else {
    console.log("All extracted truths match parsed structures within tolerance.");
  }
}

main();
