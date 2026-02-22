import * as fs from "fs";
import * as path from "path";

const dataDir = path.join(process.cwd(), "data", "hal-higdon");

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function dedupeFilename(base: string, used: Set<string>): string {
    let candidate = `${base}.md`;
    let i = 2;
    while (used.has(candidate)) {
        candidate = `${base}-${i}.md`;
        i++;
    }
    used.add(candidate);
    return candidate;
}

function extractPlanHeading(lines: string[]): string | null {
    const heading = lines.find((l) => /^#\s+.+training\s*:/i.test(l.trim()));
    return heading ? heading.replace(/^#\s+/, "").trim() : null;
}

function compactBlankLines(lines: string[]): string[] {
    const out: string[] = [];
    let blankStreak = 0;
    for (const line of lines) {
        if (!line.trim()) {
            blankStreak++;
            if (blankStreak <= 1) out.push("");
        } else {
            blankStreak = 0;
            out.push(line);
        }
    }
    return out;
}

function sanitizePlanContent(raw: string): string {
    const lines = raw.split(/\r?\n/);
    const startIdx = lines.findIndex((l) => /^#\s+.+training\s*:/i.test(l.trim()));
    const working = startIdx >= 0 ? lines.slice(startIdx) : lines;

    const cleaned = working
        .map((line) => line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"))
        .filter((line) => {
            const t = line.trim();
            if (!t) return true;
            if (/^https?:\/\//i.test(t)) return false;
            if (t.includes("http://") || t.includes("https://")) return false;
            if (/^\[!?\[.*\]\(.*\)\]\(.*\)$/.test(t)) return false;
            if (/^jump to/i.test(t)) return false;
            if (/^\|\s*$/.test(t)) return false;
            // Keep schedule/menu headings but drop noisy nav bullets.
            if (/^- /.test(t) && !/^-\s*(summary|program details|training schedule|additional programs|reviews)\b/i.test(t)) {
                return false;
            }
            return true;
        });

    return compactBlankLines(cleaned).join("\n").trim() + "\n";
}

function cleanFilenameFromHeading(heading: string): string {
    // "5K Training : Advanced" -> "5k-training-advanced"
    return slugify(heading);
}

function main() {
    if (!fs.existsSync(dataDir)) {
        console.error("Data directory not found:", dataDir);
        process.exit(1);
    }

    const entries = fs.readdirSync(dataDir);
    const mdFiles = entries.filter(
        (f) => f.toLowerCase().endsWith(".md") && f !== "README.md"
    );
    const used = new Set<string>(entries);
    let processed = 0;

    for (const oldName of mdFiles) {
        const oldPath = path.join(dataDir, oldName);
        const raw = fs.readFileSync(oldPath, "utf-8");
        const lines = raw.split(/\r?\n/);
        const heading = extractPlanHeading(lines);
        const base = heading
            ? cleanFilenameFromHeading(heading)
            : slugify(path.basename(oldName, ".md"));
        const newName = dedupeFilename(base, used);
        const newPath = path.join(dataDir, newName);
        const sanitized = sanitizePlanContent(raw);

        fs.writeFileSync(newPath, sanitized, "utf-8");
        if (newName !== oldName) {
            fs.unlinkSync(oldPath);
        }
        processed++;
    }

    console.log(`Cleaned ${processed} markdown source files.`);
}

main();
