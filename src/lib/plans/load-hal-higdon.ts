/**
 * Load parsed Hal Higdon plans for the algorithm.
 * Prefer data/hal-higdon/parsed/*.json (generate with npm run parse-plans).
 * If parsed/ is missing, parses from source .md/.txt in data/hal-higdon/.
 */

import * as fs from "fs";
import * as path from "path";
import type { HalHigdonPlan } from "@/types/hal-higdon";
import { parseHalHigdonFile, parseAllHalHigdonPlans } from "./parse-hal-higdon";

const DATA_DIR = path.join(process.cwd(), "data", "hal-higdon");
const PARSED_DIR = path.join(DATA_DIR, "parsed");

/**
 * Load all parsed plans. Uses parsed/*.json if present; otherwise parses from source files.
 */
export function loadParsedPlans(): HalHigdonPlan[] {
  if (fs.existsSync(PARSED_DIR)) {
    const indexPath = path.join(PARSED_DIR, "index.json");
    if (fs.existsSync(indexPath)) {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as { meta: { id: string } }[];
      const plans: HalHigdonPlan[] = [];
      for (const { meta } of index) {
        const safeId = meta.id.replace(/[^a-z0-9-]/gi, "-");
        const filePath = path.join(PARSED_DIR, `${safeId}.json`);
        if (fs.existsSync(filePath)) {
          plans.push(JSON.parse(fs.readFileSync(filePath, "utf-8")) as HalHigdonPlan);
        }
      }
      if (plans.length > 0) return plans;
    }
  }
  if (fs.existsSync(DATA_DIR)) {
    return parseAllHalHigdonPlans(DATA_DIR);
  }
  return [];
}

/**
 * Load a single plan by id (e.g. "marathon-novice-1").
 */
export function loadParsedPlanById(id: string): HalHigdonPlan | null {
  const safeId = id.replace(/[^a-z0-9-]/gi, "-");
  const filePath = path.join(PARSED_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as HalHigdonPlan;
}
