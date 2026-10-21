---
description: "Archive every record to one JSON file."
---

# export

Archive every record to one JSON file.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs export --file=<path> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Say where the file is and how many rows each table holds. Nothing here lodges with a regulator or pays an invoice.
