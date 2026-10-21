---
description: "Add a registration or a new application in any market."
---

# add-registration

Add a registration or a new application in any market.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-registration --ref="<number as the regulator writes it>" --regulator=<TGA|APVMA|AICIS|ACVM|...> --holder=<holder> --product=<product> --applied=<YYYY-MM-DD> --granted=<YYYY-MM-DD> --expires=<YYYY-MM-DD> --ace --level=<1-8> --manager="<name>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Take every date from the regulator's register or certificate. An application has no grant date yet. --ace only for a TGA entry on the annual charge exemption; --level only for AICIS. Nothing here lodges with a regulator or pays an invoice.
