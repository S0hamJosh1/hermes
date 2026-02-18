/**
 * Parser for Hal Higdon plan files in data/hal-higdon.
 * Extracts week-by-week schedule tables into structured JSON for the algorithm.
 */

import * as fs from "fs";
import * as path from "path";
import type { HalHigdonPlan, HalHigdonPlanMeta, ParsedDayEntry, ParsedWeek } from "@/types/hal-higdon";

const MI_TO_KM = 1.60934;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseCell(cell: string, dayIndex: number, tableUnit: "mi" | "km"): ParsedDayEntry {
  const raw = cell.replace(/\*\*/g, "").trim();
  const lower = raw.toLowerCase();

  const entry: ParsedDayEntry = { dayOfWeek: dayIndex, type: "rest" };

  if (lower === "rest") return { ...entry, type: "rest" };
  if (lower === "cross") return { ...entry, type: "cross" };
  if (raw === "**Half Marathon**" || lower === "half marathon") return { ...entry, type: "race", label: "Half Marathon" };
  if (raw === "**Marathon**" || lower === "marathon") return { ...entry, type: "race", label: "Marathon" };

  const miRunMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:mi|m)\s*run$/i);
  if (miRunMatch) {
    const mi = parseFloat(miRunMatch[1]);
    return { dayOfWeek: dayIndex, type: "run", distanceMi: mi, distanceKm: Math.round(mi * MI_TO_KM * 10) / 10 };
  }

  const miPaceMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:mi|m)\s*pace$/i);
  if (miPaceMatch) {
    const mi = parseFloat(miPaceMatch[1]);
    return { dayOfWeek: dayIndex, type: "pace", distanceMi: mi, distanceKm: Math.round(mi * MI_TO_KM * 10) / 10 };
  }

  const kmRunMatch = raw.match(/^(\d+(?:\.\d+)?)\s*km\s*run$/i);
  if (kmRunMatch) {
    const km = parseFloat(kmRunMatch[1]);
    return { dayOfWeek: dayIndex, type: "run", distanceKm: km, distanceMi: Math.round((km / MI_TO_KM) * 10) / 10 };
  }

  const kmPaceMatch = raw.match(/^(\d+(?:\.\d+)?)\s*km\s*pace$/i);
  if (kmPaceMatch) {
    const km = parseFloat(kmPaceMatch[1]);
    return { dayOfWeek: dayIndex, type: "pace", distanceKm: km, distanceMi: Math.round((km / MI_TO_KM) * 10) / 10 };
  }

  const numMatch = raw.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    if (n >= 2 && n <= 35) {
      if (tableUnit === "km") return { dayOfWeek: dayIndex, type: "long_run", distanceKm: n, distanceMi: Math.round((n / MI_TO_KM) * 10) / 10 };
      return { dayOfWeek: dayIndex, type: "long_run", distanceMi: n, distanceKm: Math.round(n * MI_TO_KM * 10) / 10 };
    }
  }

  return { ...entry, type: "run" };
}

function parseTableRows(lines: string[], startIndex: number, tableUnit: "mi" | "km"): { weeks: ParsedWeek[]; nextIndex: number } {
  const weeks: ParsedWeek[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 8) break;
    const weekNum = parseInt(cells[0], 10);
    if (Number.isNaN(weekNum)) {
      i++;
      continue;
    }
    const days: ParsedDayEntry[] = [];
    for (let d = 0; d < 7; d++) {
      days.push(parseCell(cells[d + 1] ?? "", d, tableUnit));
    }
    weeks.push({ weekNumber: weekNum, days });
    i++;
  }
  return { weeks, nextIndex: i };
}

function findTableHeader(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 8 && cells[0] === "Week" && cells[1] === "Mon" && cells[7] === "Sun") return i;
  }
  return -1;
}

function extractPlanMetaFromHeading(heading: string, sourceFile: string): HalHigdonPlanMeta | null {
  // "# Marathon Training : Novice 1" or "Marathon Training : Intermediate 2"
  const match = heading.match(/#?\s*(.+?)\s*Training\s*:\s*(.+?)(?:\s*$|\s*-)/i) || heading.match(/#?\s*(.+?)\s*:\s*(.+)/);
  if (!match) return null;
  const category = match[1].trim();
  const level = match[2].trim();
  const name = `${category} ${level}`;
  const id = name.replace(/\s+/g, "-").toLowerCase();
  return { id, name, category, level, lengthWeeks: 0, sourceFile };
}

function extractLengthWeeks(content: string): number {
  const m = content.match(/\*\*Length:\*\*\s*(\d+)\s*Weeks/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Parse a single file that may contain one or more plans (e.g. plan 1 - 3.txt has 3 plans).
 */
export function parseHalHigdonFile(
  content: string,
  sourceFile: string
): HalHigdonPlan[] {
  const lines = content.split(/\r?\n/);
  const plans: HalHigdonPlan[] = [];
  const sections: { heading: string; start: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("# ") && (line.includes("Training") || line.includes("Marathon") || line.includes("Half") || line.includes("10K") || line.includes("5K"))) {
      sections.push({ heading: line, start: i });
    }
  }

  if (sections.length === 0) {
    const meta = inferMetaFromFilename(sourceFile);
    if (meta) {
      const idx = findTableHeader(lines);
      if (idx >= 0) {
        const { weeks } = parseTableRows(lines, idx + 2, "mi");
        const lengthWeeks = weeks.length || meta.lengthWeeks;
        const weeksKm = weeks.map((w) => ({
          weekNumber: w.weekNumber,
          days: w.days.map((d) => ({
            ...d,
            distanceKm: d.distanceKm ?? (d.distanceMi != null ? Math.round(d.distanceMi * MI_TO_KM * 10) / 10 : undefined),
          })),
        }));
        plans.push({
          meta: { ...meta, lengthWeeks, sourceFile },
          weeksMi: weeks,
          weeksKm: weeksKm,
        });
      }
    }
    return plans;
  }

  for (let s = 0; s < sections.length; s++) {
    const start = sections[s].start;
    const end = s + 1 < sections.length ? sections[s + 1].start : lines.length;
    const sectionLines = lines.slice(start, end);
    const meta = extractPlanMetaFromHeading(sections[s].heading, sourceFile);
    if (!meta) continue;

    const lengthWeeks = extractLengthWeeks(sectionLines.join("\n")) || 0;
    const headerIdx = findTableHeader(sectionLines);
    if (headerIdx < 0) continue;

    const { weeks: weeksFirst, nextIndex } = parseTableRows(sectionLines, headerIdx + 2, "mi");
    const secondHeaderIdx = findTableHeader(sectionLines.slice(nextIndex).map((_, i) => sectionLines[nextIndex + i]));
    let weeksKm: ParsedWeek[];
    let weeksMi: ParsedWeek[] | undefined = weeksFirst.length ? weeksFirst : undefined;

    if (secondHeaderIdx >= 0) {
      const secondStart = nextIndex + secondHeaderIdx + 2;
      const { weeks: w2 } = parseTableRows(sectionLines, secondStart, "km");
      weeksKm = w2.length > 0 ? w2 : weeksFirst;
    } else {
      weeksKm = weeksFirst.map((w) => ({
        weekNumber: w.weekNumber,
        days: w.days.map((d) => ({
          ...d,
          distanceKm: d.distanceKm ?? (d.distanceMi != null ? Math.round(d.distanceMi * MI_TO_KM * 10) / 10 : undefined),
        })),
      }));
    }

    plans.push({
      meta: { ...meta, lengthWeeks: lengthWeeks || weeksKm.length },
      weeksMi,
      weeksKm,
    });
  }

  return plans;
}

function inferMetaFromFilename(filename: string): HalHigdonPlanMeta | null {
  const name = path.basename(filename, path.extname(filename));
  if (name.includes("novice-1") && name.includes("marathon")) return { id: "marathon-novice-1", name: "Marathon Novice 1", category: "Marathon", level: "Novice 1", lengthWeeks: 18, sourceFile: filename };
  if (name.includes("novice-2") && name.includes("marathon")) return { id: "marathon-novice-2", name: "Marathon Novice 2", category: "Marathon", level: "Novice 2", lengthWeeks: 18, sourceFile: filename };
  if (name.includes("intermediate-1") && name.includes("marathon")) return { id: "marathon-intermediate-1", name: "Marathon Intermediate 1", category: "Marathon", level: "Intermediate 1", lengthWeeks: 18, sourceFile: filename };
  if (name.includes("intermediate-2") && name.includes("marathon")) return { id: "marathon-intermediate-2", name: "Marathon Intermediate 2", category: "Marathon", level: "Intermediate 2", lengthWeeks: 18, sourceFile: filename };
  if (name.includes("advanced-1") && name.includes("marathon")) return { id: "marathon-advanced-1", name: "Marathon Advanced 1", category: "Marathon", level: "Advanced 1", lengthWeeks: 18, sourceFile: filename };
  if (name.includes("advanced-2") && name.includes("marathon")) return { id: "marathon-advanced-2", name: "Marathon Advanced 2", category: "Marathon", level: "Advanced 2", lengthWeeks: 18, sourceFile: filename };
  if (name.includes("half-marathon")) {
    const level = name.includes("novice-1") ? "Novice 1" : name.includes("novice-2") ? "Novice 2" : name.includes("intermediate-1") ? "Intermediate 1" : name.includes("intermediate-2") ? "Intermediate 2" : name.includes("advanced") ? "Advanced" : "Half Marathon 3";
    return { id: name.slice(0, 50).replace(/\s+/g, "-"), name: `Half Marathon ${level}`, category: "Half Marathon", level, lengthWeeks: 12, sourceFile: filename };
  }
  if (name.includes("10k") || name.includes("10-k")) {
    const level = name.includes("novice") ? "Novice" : name.includes("intermediate") ? "Intermediate" : "Advanced";
    return { id: `10k-${level}`.toLowerCase(), name: `10K ${level}`, category: "10K", level, lengthWeeks: 8, sourceFile: filename };
  }
  if (name.includes("5k") || name.includes("5-k")) {
    const level = name.includes("novice") ? "Novice" : name.includes("intermediate") ? "Intermediate" : "Advanced";
    return { id: `5k-${level}`.toLowerCase(), name: `5K ${level}`, category: "5K", level, lengthWeeks: 8, sourceFile: filename };
  }
  return null;
}

/**
 * Parse all plan files in data/hal-higdon and return combined plans.
 * Writes parsed JSON to data/hal-higdon/parsed/ when outDir is provided.
 */
export function parseAllHalHigdonPlans(dataDir: string, outDir?: string): HalHigdonPlan[] {
  const allPlans: HalHigdonPlan[] = [];
  const files = fs.readdirSync(dataDir);

  for (const file of files) {
    if (file === "parsed" || file.startsWith(".")) continue;
    const fullPath = path.join(dataDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;
    if (!/\.(md|txt)$/i.test(file)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    const plans = parseHalHigdonFile(content, file);
    for (const p of plans) {
      allPlans.push(p);
    }
  }

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "index.json"),
      JSON.stringify(allPlans.map((p) => ({ meta: p.meta, weeksCount: p.weeksKm?.length ?? 0 })), null, 2)
    );
    for (const p of allPlans) {
      const safeId = p.meta.id.replace(/[^a-z0-9-]/gi, "-");
      fs.writeFileSync(path.join(outDir, `${safeId}.json`), JSON.stringify(p, null, 2));
    }
  }

  return allPlans;
}
