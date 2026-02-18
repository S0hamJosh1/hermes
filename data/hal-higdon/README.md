# Hal Higdon training plans (source)

This folder holds the **source** Hal Higdon plan files (`.md` / `.txt`) used as data for Hermes. The app does **not** display these files verbatim; it parses them into structured week-by-week schedules for the planning algorithm.

- **Source files**: Add or update `.md` / `.txt` here (e.g. from the extracted “marathon plans” zip).
- **Parsed output** (optional): Run `npm run parse-plans` to write `parsed/*.json`. If `parsed/` is missing, the app parses from these source files on demand.

Plans are used as **parameterized workout templates** (distances, types, and structure), not copied as content.
