/**
 * Strips scraped website junk from Hal Higdon .md source files.
 *
 * Keeps:
 *   - Title (# heading)
 *   - "About the ... Program" section
 *   - "At a glance" metadata (Author, Length, etc.)
 *   - Hal's description of the program
 *   - Both schedule tables (miles and km)
 *   - Author attribution line
 *
 * Removes:
 *   - Navigation links, app promos, review forms
 *   - User reviews
 *   - Footer (cookie banners, privacy policy, social links, etc.)
 *   - "Additional Programs", "Books", link lists
 *
 * Usage: npx tsx scripts/clean-source-md.ts
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "hal-higdon");

const JUNK_START_PATTERNS = [
  /^#{1,4}\s+Reviews$/m,
  /^#{1,4}\s+Additional .* Programs$/m,
  /^#{1,4}\s+Leave a Review$/m,
  /^## STAY IN TOUCH$/m,
  /^### Run Like Hal$/m,
  /^### Training Programs$/m,
  /^### Useful Links$/m,
  /^### Contact Info$/m,
  /^## Programs$/m,
  /^## Books$/m,
  /^## \dK Training$/m,
  /^## Marathon Training$/m,
  /^## Half Marathon Training$/m,
  /^All contents © Hal Higdon/m,
  /^Digital Momentum$/m,
  /^Website powered by/m,
  /^This website uses cookies/m,
  /^Privacy & Cookies Policy$/m,
  /^Cookie settings/m,
  /^SAVE & ACCEPT$/m,
];

const HEADER_JUNK_PATTERNS = [
  /^- \[Transparency is important/,
  /^- \[Facebook\]/,
  /^- \[Twitter\]/,
  /^- \[Instagram\]/,
  /^\[!\[]\(https:\/\/www\.halhigdon\.com\/wp-content/,
  /^- \[Home\]/,
  /^- \[Run With Hal App\]/,
  /^- \[Training Programs\]/,
  /^\s+- \[All Training Programs\]/,
  /^\s+- \[Marathon Training\]/,
  /^\s+- \[Half Marathon Training\]/,
  /^\s+- \[5K Training\]/,
  /^\s+- \[8K Training\]/,
  /^\s+- \[10K Training\]/,
  /^\s+- \[15K/,
  /^\s+- \[Post Marathon/,
  /^\s+- \[Base Training\]/,
  /^\s+- \[More Training\]/,
  /^- \[Books\]/,
  /^- \[About Hal\]/,
  /^Jump to/,
  /^- \[Summary\]/,
  /^- \\\|$/,
  /^- \[Program Details\]/,
  /^- \[Training Schedule\]/,
  /^- \[Additional Programs\]/,
  /^- \[Reviews\]/,
  /^- Summary$/,
  /^- Program Details$/,
  /^- Training Schedule$/,
  /^- Additional Programs$/,
  /^- Reviews$/,
  /^Leave a review/,
  /^See all reviews/,
  /^Based on \d+ reviews/,
  /^\d+\.\d+$/,
  /^!\[]\(https:\/\/www\.halhigdon/,
  /^- Start training for free/,
  /^- Track your progress/,
  /^- Record your runs/,
  /^- Hal adapts to your/,
  /^- Train for multiple/,
  /^\[!\[]\(https:\/\/www\.halhigdon\.com\/wp-content.*RunWithHal/,
  /^- \[Miles\]/,
  /^- \[KMs\]/,
  /^- \[Print\]/,
];

function cleanFile(filePath: string): void {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  // Find the end of useful content: after the last table row
  let lastTableLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("|")) {
      lastTableLine = i;
    }
  }

  // Trim everything after the last table
  let useful = lastTableLine >= 0 ? lines.slice(0, lastTableLine + 1) : lines;

  // Remove header junk lines
  useful = useful.filter((line) => {
    const trimmed = line.trim();
    if (trimmed === "") return true;
    return !HEADER_JUNK_PATTERNS.some((p) => p.test(trimmed));
  });

  // Remove any remaining junk blocks that start with known patterns
  let result: string[] = [];
  for (const line of useful) {
    const isJunkStart = JUNK_START_PATTERNS.some((p) => p.test(line.trim()));
    if (isJunkStart) break;
    result.push(line);
  }

  // Remove trailing blank lines and add attribution
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }

  // Add attribution
  result.push("");
  result.push("---");
  result.push("");
  result.push("*All training programs by Hal Higdon. All contents © Hal Higdon, LLC. All rights reserved.*");
  result.push("");

  // Collapse triple+ blank lines
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of result) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  fs.writeFileSync(filePath, collapsed.join("\n"), "utf-8");
  const before = raw.length;
  const after = collapsed.join("\n").length;
  const pct = Math.round((1 - after / before) * 100);
  console.log(`  ${path.basename(filePath)}: ${before} → ${after} bytes (${pct}% reduced)`);
}

function main() {
  const files = fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => path.join(DATA_DIR, f));

  console.log(`Cleaning ${files.length} .md files in ${DATA_DIR}...\n`);

  for (const file of files) {
    cleanFile(file);
  }

  // Clean the multi-plan .txt file too
  const txtFile = path.join(DATA_DIR, "plan 1 - 3.txt");
  if (fs.existsSync(txtFile)) {
    cleanFile(txtFile);
  }

  console.log("\nDone.");
}

main();
