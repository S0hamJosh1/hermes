/**
 * Run this to regenerate data/hal-higdon/parsed/*.json from source plan files.
 * Usage: npx tsx scripts/parse-plans.ts
 */
import * as path from "path";
import * as fs from "fs";

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data", "hal-higdon");
const outDir = path.join(dataDir, "parsed");

// Inline minimal parser logic so script can run without Next/tsconfig paths.
const MI_TO_KM = 1.60934;

type ParsedDayEntry = {
  dayOfWeek: number;
  type: string;
  distanceKm?: number;
  distanceMi?: number;
  label?: string;
};

type ParsedWeek = { weekNumber: number; days: ParsedDayEntry[] };

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

function findTableHeader(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 8 && cells[0] === "Week" && cells[1] === "Mon" && cells[7] === "Sun") return i;
  }
  return -1;
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
    for (let d = 0; d < 7; d++) days.push(parseCell(cells[d + 1] ?? "", d, tableUnit));
    weeks.push({ weekNumber: weekNum, days });
    i++;
  }
  return { weeks, nextIndex: i };
}

function extractPlanMetaFromHeading(heading: string): { id: string; name: string; category: string; level: string } | null {
  const match = heading.match(/#?\s*(.+?)\s*Training\s*:\s*(.+?)(?:\s*$|\s*-)/i) || heading.match(/#?\s*(.+?)\s*:\s*(.+)/);
  if (!match) return null;
  const category = match[1].trim();
  const level = match[2].trim();
  const name = `${category} ${level}`;
  const id = name.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return { id, name, category, level };
}

function extractLengthWeeks(content: string): number {
  const m = content.match(/\*\*Length:\*\*\s*(\d+)\s*Weeks/i);
  return m ? parseInt(m[1], 10) : 0;
}

function inferMetaFromFilename(filename: string): { id: string; name: string; category: string; level: string; lengthWeeks: number } | null {
  const name = path.basename(filename, path.extname(filename));
  if (name.includes("novice-1") && name.includes("marathon")) return { id: "marathon-novice-1", name: "Marathon Novice 1", category: "Marathon", level: "Novice 1", lengthWeeks: 18 };
  if (name.includes("novice-2") && name.includes("marathon")) return { id: "marathon-novice-2", name: "Marathon Novice 2", category: "Marathon", level: "Novice 2", lengthWeeks: 18 };
  if (name.includes("intermediate-1") && name.includes("marathon")) return { id: "marathon-intermediate-1", name: "Marathon Intermediate 1", category: "Marathon", level: "Intermediate 1", lengthWeeks: 18 };
  if (name.includes("intermediate-2") && name.includes("marathon")) return { id: "marathon-intermediate-2", name: "Marathon Intermediate 2", category: "Marathon", level: "Intermediate 2", lengthWeeks: 18 };
  if (name.includes("advanced-1") && name.includes("marathon")) return { id: "marathon-advanced-1", name: "Marathon Advanced 1", category: "Marathon", level: "Advanced 1", lengthWeeks: 18 };
  if (name.includes("advanced-2") && name.includes("marathon")) return { id: "marathon-advanced-2", name: "Marathon Advanced 2", category: "Marathon", level: "Advanced 2", lengthWeeks: 18 };
  if (name.includes("half-marathon")) {
    const level = name.includes("novice-1") ? "Novice 1" : name.includes("novice-2") ? "Novice 2" : name.includes("intermediate-1") ? "Intermediate 1" : name.includes("intermediate-2") ? "Intermediate 2" : name.includes("advanced") ? "Advanced" : "Half Marathon 3";
    return { id: `half-marathon-${level.toLowerCase().replace(/\s+/g, "-")}`, name: `Half Marathon ${level}`, category: "Half Marathon", level, lengthWeeks: 12 };
  }
  if (name.includes("10k") || name.includes("10-k")) {
    const level = name.includes("novice") ? "Novice" : name.includes("intermediate") ? "Intermediate" : "Advanced";
    return { id: `10k-${level}`.toLowerCase(), name: `10K ${level}`, category: "10K", level, lengthWeeks: 8 };
  }
  if (name.includes("5k") || name.includes("5-k")) {
    const level = name.includes("novice") ? "Novice" : name.includes("intermediate") ? "Intermediate" : "Advanced";
    return { id: `5k-${level}`.toLowerCase(), name: `5K ${level}`, category: "5K", level, lengthWeeks: 8 };
  }
  return null;
}

function parseFile(content: string, sourceFile: string): { meta: any; weeksMi?: ParsedWeek[]; weeksKm: ParsedWeek[] }[] {
  const lines = content.split(/\r?\n/);
  const sections: { heading: string; start: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("# ") && (lines[i].includes("Training") || lines[i].includes("Marathon") || lines[i].includes("Half") || lines[i].includes("10K") || lines[i].includes("5K"))) {
      sections.push({ heading: lines[i], start: i });
    }
  }

  if (sections.length === 0) {
    const meta = inferMetaFromFilename(sourceFile);
    if (!meta) return [];
    const idx = findTableHeader(lines);
    if (idx < 0) return [];
    const { weeks } = parseTableRows(lines, idx + 2, "mi");
    const weeksKm = weeks.map((w) => ({
      weekNumber: w.weekNumber,
      days: w.days.map((d) => ({ ...d, distanceKm: d.distanceKm ?? (d.distanceMi != null ? Math.round(d.distanceMi * MI_TO_KM * 10) / 10 : undefined) })),
    }));
    return [{ meta: { ...meta, sourceFile, lengthWeeks: weeks.length }, weeksMi: weeks, weeksKm }];
  }

  const plans: { meta: any; weeksMi?: ParsedWeek[]; weeksKm: ParsedWeek[] }[] = [];
  for (let s = 0; s < sections.length; s++) {
    const start = sections[s].start;
    const end = s + 1 < sections.length ? sections[s + 1].start : lines.length;
    const sectionLines = lines.slice(start, end);
    const meta = extractPlanMetaFromHeading(sections[s].heading);
    if (!meta) continue;
    const lengthWeeks = extractLengthWeeks(sectionLines.join("\n")) || 0;
    const headerIdx = findTableHeader(sectionLines);
    if (headerIdx < 0) continue;

    const { weeks: weeksFirst, nextIndex } = parseTableRows(sectionLines, headerIdx + 2, "mi");
    const secondHeaderIdx = findTableHeader(sectionLines.slice(nextIndex).map((_, i) => sectionLines[nextIndex + i]));
    let weeksKm: ParsedWeek[];
    const weeksMi = weeksFirst.length ? weeksFirst : undefined;

    if (secondHeaderIdx >= 0) {
      const { weeks: w2 } = parseTableRows(sectionLines, nextIndex + secondHeaderIdx + 2, "km");
      weeksKm = w2.length > 0 ? w2 : weeksFirst;
    } else {
      weeksKm = weeksFirst.map((w) => ({
        weekNumber: w.weekNumber,
        days: w.days.map((d) => ({ ...d, distanceKm: d.distanceKm ?? (d.distanceMi != null ? Math.round(d.distanceMi * MI_TO_KM * 10) / 10 : undefined) })),
      }));
    }

    plans.push({
      meta: { ...meta, lengthWeeks: lengthWeeks || weeksKm.length, sourceFile },
      weeksMi,
      weeksKm,
    });
  }
  return plans;
}

function main() {
  if (!fs.existsSync(dataDir)) {
    console.error("Data dir not found:", dataDir);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(dataDir).filter((f) => /\.(md|txt)$/i.test(f) && f !== "parsed");
  const allPlans: any[] = [];
  for (const file of files) {
    const fullPath = path.join(dataDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const plans = parseFile(content, file);
    for (const p of plans) {
      allPlans.push(p);
    }
  }
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(allPlans.map((p) => ({ meta: p.meta, weeksCount: p.weeksKm?.length ?? 0 })), null, 2));
  for (const p of allPlans) {
    const safeId = (p.meta.id as string).replace(/[^a-z0-9-]/gi, "-");
    fs.writeFileSync(path.join(outDir, `${safeId}.json`), JSON.stringify(p, null, 2));
  }
  console.log("Parsed", allPlans.length, "plans into", outDir);
}

main();
