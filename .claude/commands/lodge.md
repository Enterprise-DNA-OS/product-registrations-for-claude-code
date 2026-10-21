---
description: "Record a submission that has been lodged: a new application, a variation, a notification or a permit."
---

# lodge

Record a submission that has been lodged: a new application, a variation, a notification or a permit.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs lodge "<registration>" --kind=<new|variation|notification|permit|other> --title="<what>" --on=<YYYY-MM-DD> --regulator-ref=<reference> --owner="<name>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Only once it is lodged. Say the code it was given. Nothing here lodges with a regulator or pays an invoice.
