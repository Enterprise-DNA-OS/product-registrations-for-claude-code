---
description: "Record an invoice from a regulator: an annual charge, levy, renewal or application fee."
---

# add-fee

Record an invoice from a regulator: an annual charge, levy, renewal or application fee.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-fee "<registration>" --kind="<annual charge|levy|renewal fee|application fee|late fee|registration charge|other>" --amount=<amount> --due=<YYYY-MM-DD> --period="<period>" --invoice=<number> --currency=<AUD> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Take the amount and due date from the invoice. Never estimate one. Nothing here lodges with a regulator or pays an invoice.
