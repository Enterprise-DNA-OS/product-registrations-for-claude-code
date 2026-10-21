---
description: "Record that a registration was cancelled, lapsed or withdrawn."
---

# end

Record that a registration was cancelled, lapsed or withdrawn.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs end "<registration>" --status=<cancelled|lapsed|withdrawn> --on=<YYYY-MM-DD> --reason="<why>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Never delete a registration. Ending it keeps its history. Nothing here lodges with a regulator or pays an invoice.
