---
description: "Record a registration's sales for a financial year: value excluding GST and exports, and quantity."
---

# record-sales

Record a registration's sales for a financial year: value excluding GST and exports, and quantity.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs record-sales "<registration>" --fy=<YYYY-06-30> --value=<amount> --quantity=<n> --unit=<unit> --currency=<AUD> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Recording a year again corrects it. Take the figures from the accounts. Nothing here lodges with a regulator or pays an invoice.
