---
description: "Record a declaration that has been lodged: APVMA leviable value or annual return, a TGA $0 turnover declaration or notification of turnover, or the AICIS annual declaration."
---

# declare

Record a declaration that has been lodged: APVMA leviable value or annual return, a TGA $0 turnover declaration or notification of turnover, or the AICIS annual declaration.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs declare "<registration>" --kind=<levy|return|ace|turnover|aicis> --on=<YYYY-MM-DD> --period=<YYYY-MM-DD> --value=<amount> --receipt=<receipt> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Only record it once the person confirms it was lodged. A $0 declaration is refused for an entry that sold. Nothing here lodges with a regulator or pays an invoice.
