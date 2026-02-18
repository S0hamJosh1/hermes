/**
 * Database seed script.
 * Usage: npm run db:seed
 *
 * Seeds workout templates from parsed Hal Higdon plans.
 * Does NOT seed user data — that comes from Strava OAuth.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type ParsedDayEntry = {
  dayOfWeek: number;
  type: string;
  distanceKm?: number;
  distanceMi?: number;
  label?: string;
};

type ParsedWeek = { weekNumber: number; days: ParsedDayEntry[] };
type ParsedPlan = {
  meta: { id: string; name: string; category: string; level: string; lengthWeeks: number };
  weeksKm: ParsedWeek[];
};

function mapWorkoutType(type: string): string {
  switch (type) {
    case "easy_run":
    case "run":       return "Easy Run";
    case "long_run":  return "Long Run";
    case "pace":
    case "pace_run":  return "Tempo";
    case "recovery":  return "Recovery";
    case "interval":  return "Interval";
    case "cross":
    case "cross_training": return "Cross Training";
    case "rest":      return "Rest";
    case "race":      return "Race";
    default:          return "Easy Run";
  }
}

function mapIntensityZone(type: string): string {
  switch (type) {
    case "rest":
    case "cross":
    case "cross_training":
    case "recovery":  return "Zone 1";
    case "run":
    case "easy_run":
    case "long_run":  return "Zone 2";
    case "pace":
    case "pace_run":  return "Zone 3";
    case "tempo":     return "Threshold";
    case "interval":  return "Zone 4";
    case "race":      return "Zone 3";
    default:          return "Zone 2";
  }
}

async function main() {
  console.log("Seeding workout templates from Hal Higdon plans...");

  const dataDir = path.join(process.cwd(), "data", "hal-higdon", "parsed");
  const indexPath = path.join(dataDir, "index.json");

  let plans: ParsedPlan[] = [];

  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as { meta: { id: string } }[];
    for (const { meta } of index) {
      const safeId = meta.id.replace(/[^a-z0-9-]/gi, "-");
      const filePath = path.join(dataDir, `${safeId}.json`);
      if (fs.existsSync(filePath)) {
        plans.push(JSON.parse(fs.readFileSync(filePath, "utf-8")));
      }
    }
  }

  if (plans.length === 0) {
    console.log("No parsed plans found. Run 'npm run parse-plans' first, or plans will be parsed on demand.");
    return;
  }

  // Clear existing templates before re-seeding
  await prisma.workoutTemplate.deleteMany({});

  let count = 0;
  for (const plan of plans) {
    for (const week of plan.weeksKm) {
      for (const day of week.days) {
        if (day.type === "rest" || day.type === "cross" || day.type === "cross_training") continue;
        if (!day.distanceKm || day.distanceKm <= 0) continue;

        await prisma.workoutTemplate.create({
          data: {
            templateName: `${plan.meta.name} W${week.weekNumber} ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][day.dayOfWeek]}`,
            workoutType: mapWorkoutType(day.type),
            distanceType: "fixed_km",
            baseDistanceKm: day.distanceKm,
            intensityZone: mapIntensityZone(day.type),
            minWeekNumber: week.weekNumber,
            maxWeekNumber: week.weekNumber,
            sourcePlan: plan.meta.name,
            sourceWeek: week.weekNumber,
          },
        });
        count++;
      }
    }
  }

  console.log(`Seeded ${count} workout templates from ${plans.length} plans.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
