# Product Registrations for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR COMPANY, ITS SPONSOR AND REGISTRANT ENTITIES, AND THE MARKETS YOU SELL IN]
- **Operator:** [YOUR NAME], [regulatory affairs manager, quality manager, technical director or consultant]
- **What matters most:** no registration lost to a missed renewal, no exemption lost to a missed declaration, every levy and annual return in on time, and the label on pack always the approved one.

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a registration, run `/registration <number>` and read its dates, labels, submissions and history.
3. **Plain language.** Short sentences. Dates and dollars in tables. Say the date and how many days are left.
4. **Silent success, loud problems.** Lead with anything late: an APVMA product not renewed by 30 June is de-registered, and a missed $0 turnover declaration ends a TGA exemption for good.
5. **Stop at the line.** Anything that lodges, declares, pays or notifies a regulator waits for a yes in this session, and happens outside this system.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| TGA entries on the annual charge exemption: last year's sales and whether the $0 turnover declaration is in. | `/ace` |
| The last 50 changes to the register and who made them. | `/activity` |
| Record a condition written on a registration or certificate. | `/add-condition` |
| Record an invoice from a regulator: an annual charge, levy, renewal or application fee. | `/add-fee` |
| Add a holder: the TGA sponsor, APVMA registrant, AICIS introducer or overseas licence holder. | `/add-holder` |
| Add a label version to a registration, with its approval date if it has one. | `/add-label` |
| Add a dated obligation: a condition's report, a stability study, a commitment made to a regulator. | `/add-obligation` |
| Add a product to the register. | `/add-product` |
| Add a registration or a new application in any market. | `/add-registration` |
| Submissions still waiting for a decision, and how long each has waited. | `/applications` |
| Record that a label version was approved. | `/approve-label` |
| What needs a person today across every registration, worst first. | `/attention` |
| Every open date for the next twelve months, with the rule behind each. | `/calendar` |
| Check the register against the APVMA, TGA and AICIS dates, labels on pack, invoices and conditions, with the rule cited. | `/compliance` |
| Make this system yours in plain language. Add a field, change a rule, add a regulator or a market. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Record the regulator's decision on a submission. | `/decide` |
| Levy, annual return, $0 turnover and AICIS declarations for the latest periods, and which are in. | `/declarations` |
| Record a declaration that has been lodged: APVMA leviable value or annual return, a TGA $0 turnover declaration or notification of turnover, or the AICIS annual declaration. | `/declare` |
| Render the paperwork: a summary per registration, the APVMA levy working paper per holder and a regulatory calendar per company. | `/documents` |
| Mark an obligation done. | `/done` |
| Draft the TGA annual charge exemption list: which entries to declare at $0 and which to notify as trading. | `/draft-ace` |
| Draft the AICIS annual declaration working paper for the registration year that ended on 31 August. | `/draft-aicis` |
| Draft the APVMA levy and annual return working paper for the last financial year. | `/draft-levy` |
| Draft the renewals list: every APVMA, AICIS and certificate renewal due in the next 120 days, with fees on file. | `/draft-renewals` |
| Draft the record behind a submission: the registration, its conditions, labels and history. | `/draft-submission` |
| Everything due in the next N days (default 30), with the rule behind each date. | `/due` |
| Record that a registration was cancelled, lapsed or withdrawn. | `/end` |
| Registrations whose paid-up period or certificate ends in the next twelve months. | `/expiring` |
| Archive every record to one JSON file. | `/export` |
| Regulator invoices not yet paid, soonest first. | `/fees` |
| Record that an application was granted, with the end date the regulator set. | `/grant` |
| Holders and how many current registrations each holds. | `/holders` |
| Bring registrations across from a Veeva Vault RIM report or a spreadsheet, or sales from the accounts, saved as CSV. | `/import` |
| Ten questions answered across the whole register. | `/insights` |
| Record that a label version went on pack. The version it replaces is retired. | `/label-in-market` |
| Every label version: approved, on pack, retired, and any on pack that is not approved. | `/labels` |
| Record a submission that has been lodged: a new application, a variation, a notification or a permit. | `/lodge` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by npm run view. | `/new-view` |
| Open obligations from conditions and commitments, soonest first. | `/obligations` |
| Record that a regulator invoice was paid. | `/pay-fee` |
| One product in every market: its registrations, labels on pack, last year's sales and open dates. | `/product` |
| Products with how many current registrations each has, and in which markets. | `/products` |
| Record a registration's sales for a financial year: value excluding GST and exports, and quantity. | `/record-sales` |
| One registration in full: dates, submissions, labels, conditions, sales, declarations, renewals, fees and history. | `/registration` |
| The register: every registration with its regulator, market, status, product and holder. | `/registrations` |
| The regulators set up, their country and how their registrations renew. | `/regulators` |
| Record a renewal that has been lodged and paid. The end date moves on one or five years. | `/renew` |
| APVMA, AICIS and certificate renewals coming up in the next 120 days, and any already late. | `/renewals` |
| The rules in force, with their sources. | `/rules` |
| Sales by registration for the last financial year. | `/sales` |
| Every submission with its outcome and how long the regulator took. | `/submissions` |
| Render the read-only dashboards: this week, the regulatory calendar and the portfolio. | `/view` |
| Draft the Monday registrations review from attention, due and compliance. | `/weekly-review` |
If an ask fits nothing here, run the CLI directly (`node scripts/registrations.mjs --help`) and then propose a new command for it.

## Hard rules

- Never lodge, declare, pay or notify from here. Nothing in this folder talks to the TGA, the APVMA, AICIS or any other regulator. Draft to `drafts/`; a person lodges and then records it.
- Record what happened, never what should have happened. Do not record a renewal, declaration, submission, payment or approval until the operator confirms it was lodged or paid, with the date.
- Take registration numbers, dates, fees and conditions from the regulator's register, certificate or invoice. Never estimate one.
- Never declare $0 turnover for an entry that sold. The CLI refuses it; do not work around it.
- Never give regulatory advice or decide whether a product needs a registration, a variation or a new application. The holder and its regulatory adviser decide; the register records.
- Never delete records. End a registration, retire a label or mark an obligation done instead.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/registrations.mjs` the one CLI. `scripts/lib/registrations.mjs` every read, write, rule and import. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the register, the rules table, the regulators and the views, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `views.json` and `documents.json` the dashboards (`npm run view`) and paperwork (`npm run docs`), in the brand from `brand.json`.
- `docs/` the rules with sources, the CLI reference, and the guide for moving off Veeva Vault RIM.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/veeva-vault-rim
