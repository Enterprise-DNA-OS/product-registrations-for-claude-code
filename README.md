<h1 align="center">Product Registrations for Claude Code</h1>

<p align="center">
  <strong>The open-source product registration register that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Veeva Vault RIM data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=veeva-vault-rim">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/veeva-vault-rim?utm_source=github&utm_medium=readme&utm_campaign=veeva-vault-rim">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-veeva-vault-rim">Instead of Veeva Vault RIM</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---


## What is this

Product Registrations for Claude Code is a register of every product registration a business holds, as a Postgres database and a set of agent commands. There is no web front end. Open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask: "what is late", "which APVMA products still need renewing", "draft the levy working paper", "is the label on pack the approved one".

**The bill it replaces.** Veeva publishes no price for Vault RIM. It is sold as a negotiated multi-year subscription with implementation on top, priced for pharmaceutical companies with regulatory departments. Smaller makers and importers either pay that, pay a regulatory consultancy to keep the register, or keep it in a spreadsheet and hope. [Research and sources](docs/research.md).

**What it covers.** Every registration in every market: ARTG entries with the TGA, agvet products with the APVMA, the AICIS business registration for cosmetics and industrial chemicals, and registrations overseas (New Zealand, Malaysia, anywhere with a certificate). For each: the holder, the product, the dates, the conditions, the label versions approved and on pack, the submissions and how long each regulator took, the invoices, and the sales behind every levy and declaration. With the date each Australian regulator puts on it: APVMA renewal, leviable value and annual return; the TGA annual charge exemption and its $0 turnover declaration; AICIS renewal and the annual declaration. Built for complementary medicine, agvet, veterinary and cosmetics businesses with a small regulatory team and a lot of dates.

Want the same register with a web front end, a link to your artwork system, or built on a different stack? That is a customisation, and it is what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=veeva-vault-rim).

## Why no front end

- The front end was only there because the database was hard to talk to. That is no longer true.
- Your registrations sit in plain Postgres tables you own. The record an auditor, a buyer or a distributor asks for never lives in a system you rent.
- No seats and no charge per user. Regulatory, quality, marketing and the managing director can all ask. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what you give up too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/product-registrations-for-claude-code.git
cd product-registrations-for-claude-code
npm install
npm test
npm run demo
```

`npm run demo` loads a fictional group with twelve registrations across five regulators: complementary medicines on the ARTG, agvet products with the APVMA, an AICIS business registration, a New Zealand registration and one in Malaysia. Built in: a missed $0 turnover declaration, an exempt entry that sold, an APVMA product not renewed by 30 June, an unpaid annual charge, a label on pack that is not the approved one, a submission waiting 140 days and a condition's report overdue. Then open the folder in Claude Code and type `/attention`.

`npm run view` renders three read-only dashboards (this week, the regulatory calendar, the portfolio). `npm run docs` renders a summary per registration (for an auditor, a buyer or a distributor), the APVMA levy working paper per holder and a regulatory calendar per company, in your brand from `brand.json`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared register, no per-seat fee. Never load the demo seed into your real register.

## Five things a regulatory team does every week

1. **Watch the dates**: renewals, declarations and invoices across every regulator (`/calendar`, `/renewals`, `/declarations`, `/fees`).
2. **Keep the exemptions honest**: which TGA entries are still exempt and which started selling (`/ace`, `/draft-ace`).
3. **Get the money right**: last year's sales per product behind the APVMA levy and annual return (`/sales`, `/record-sales`, `/draft-levy`).
4. **Chase the regulator**: what is lodged, how long it has waited, what came back (`/applications`, `/lodge`, `/decide`).
5. **Check the pack**: the label on shelf is the approved version (`/labels`, `/label-in-market`, `/approve-label`).

`/weekly-review` drafts the Monday note from `/attention`, `/due` and `/compliance`.

## The commands

53 slash commands over one CLI (`node scripts/registrations.mjs`, 50 commands, [reference](docs/cli.md)).

| Command | What it does |
|---|---|
| `/ace` | TGA entries on the annual charge exemption: last year's sales and whether the $0 turnover declaration is in. |
| `/activity` | The last 50 changes to the register and who made them. |
| `/add-condition` | Record a condition written on a registration or certificate. |
| `/add-fee` | Record an invoice from a regulator: an annual charge, levy, renewal or application fee. |
| `/add-holder` | Add a holder: the TGA sponsor, APVMA registrant, AICIS introducer or overseas licence holder. |
| `/add-label` | Add a label version to a registration, with its approval date if it has one. |
| `/add-obligation` | Add a dated obligation: a condition's report, a stability study, a commitment made to a regulator. |
| `/add-product` | Add a product to the register. |
| `/add-registration` | Add a registration or a new application in any market. |
| `/applications` | Submissions still waiting for a decision, and how long each has waited. |
| `/approve-label` | Record that a label version was approved. |
| `/attention` | What needs a person today across every registration, worst first. |
| `/calendar` | Every open date for the next twelve months, with the rule behind each. |
| `/compliance` | Check the register against the APVMA, TGA and AICIS dates, labels on pack, invoices and conditions, with the rule cited. |
| `/customise` | Make this system yours in plain language. Add a field, change a rule, add a regulator or a market. Writes the migration, applies it, updates the commands that touch it. |
| `/decide` | Record the regulator's decision on a submission. |
| `/declarations` | Levy, annual return, $0 turnover and AICIS declarations for the latest periods, and which are in. |
| `/declare` | Record a declaration that has been lodged: APVMA leviable value or annual return, a TGA $0 turnover declaration or notification of turnover, or the AICIS annual declaration. |
| `/documents` | Render the paperwork: a summary per registration, the APVMA levy working paper per holder and a regulatory calendar per company. |
| `/done` | Mark an obligation done. |
| `/draft-ace` | Draft the TGA annual charge exemption list: which entries to declare at $0 and which to notify as trading. |
| `/draft-aicis` | Draft the AICIS annual declaration working paper for the registration year that ended on 31 August. |
| `/draft-levy` | Draft the APVMA levy and annual return working paper for the last financial year. |
| `/draft-renewals` | Draft the renewals list: every APVMA, AICIS and certificate renewal due in the next 120 days, with fees on file. |
| `/draft-submission` | Draft the record behind a submission: the registration, its conditions, labels and history. |
| `/due` | Everything due in the next N days (default 30), with the rule behind each date. |
| `/end` | Record that a registration was cancelled, lapsed or withdrawn. |
| `/expiring` | Registrations whose paid-up period or certificate ends in the next twelve months. |
| `/export` | Archive every record to one JSON file. |
| `/fees` | Regulator invoices not yet paid, soonest first. |
| `/grant` | Record that an application was granted, with the end date the regulator set. |
| `/holders` | Holders and how many current registrations each holds. |
| `/import` | Bring registrations across from a Veeva Vault RIM report or a spreadsheet, or sales from the accounts, saved as CSV. |
| `/insights` | Ten questions answered across the whole register. |
| `/label-in-market` | Record that a label version went on pack. The version it replaces is retired. |
| `/labels` | Every label version: approved, on pack, retired, and any on pack that is not approved. |
| `/lodge` | Record a submission that has been lodged: a new application, a variation, a notification or a permit. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by npm run view. |
| `/obligations` | Open obligations from conditions and commitments, soonest first. |
| `/pay-fee` | Record that a regulator invoice was paid. |
| `/product` | One product in every market: its registrations, labels on pack, last year's sales and open dates. |
| `/products` | Products with how many current registrations each has, and in which markets. |
| `/record-sales` | Record a registration's sales for a financial year: value excluding GST and exports, and quantity. |
| `/registration` | One registration in full: dates, submissions, labels, conditions, sales, declarations, renewals, fees and history. |
| `/registrations` | The register: every registration with its regulator, market, status, product and holder. |
| `/regulators` | The regulators set up, their country and how their registrations renew. |
| `/renew` | Record a renewal that has been lodged and paid. The end date moves on one or five years. |
| `/renewals` | APVMA, AICIS and certificate renewals coming up in the next 120 days, and any already late. |
| `/rules` | The rules in force, with their sources. |
| `/sales` | Sales by registration for the last financial year. |
| `/submissions` | Every submission with its outcome and how long the regulator took. |
| `/view` | Render the read-only dashboards: this week, the regulatory calendar and the portfolio. |
| `/weekly-review` | Draft the Monday registrations review from attention, due and compliance. |
## Ten questions Veeva Vault RIM's dashboards do not answer for you

`/insights` answers all ten from the demo data today.

1. Which registrations lapse or expire in the next twelve months, and who owns them?
2. How many current registrations do we hold with each regulator, in each market?
3. Which products are registered in more than one market?
4. Which registrations sold nothing last financial year but are still current?
5. What have we paid each regulator over the last twelve months?
6. What is the leviable value by holder for the last financial year, and how did it move?
7. How long do regulators take to decide, by kind of submission?
8. Which submissions are still waiting, and for how long?
9. Which labels on pack are not the approved version?
10. Who carries the most open dates, and how many are late?

## The rules, with sources

`/compliance` checks every record against the APVMA renewal rule (renew one month before 30 June; late renewal with the APVMA's agreement and a fee until 30 June; de-registered after it), the APVMA leviable value (31 October) and annual return (before 30 November), the TGA annual charge exemption ($0 turnover declaration 1 to 22 July, late until 15 September, never for an entry that sold), AICIS renewal (31 August) and the annual declaration (30 November), regulator invoices, labels on pack, and the conditions on your own registrations. Every finding cites its rule. The rules are rows in a table, so a change is a one-line migration, and another market is a set of rows. [docs/compliance.md](docs/compliance.md). It is a records check, not regulatory advice.

## Your first hour: ten things to ask for

1. "Put our company name and colours on the registration summaries."
2. "Set up our sponsor and registrant companies."
3. "Import our registrations from this Veeva report export. Dry run first."
4. "Import last year's sales by product from the accounts export."
5. "What is late, and what is due in the next 30 days?"
6. "Which TGA entries can we declare at $0, and which have started selling?"
7. "Draft the APVMA levy working paper."
8. "Which APVMA products need renewing before 30 May?"
9. "Version 5 of the herbicide label went on pack today."
10. "Add New Zealand's ACVM rules for our vet products" (through `/customise`).

## Instead of Veeva Vault RIM

The bridge is a registration report saved as CSV: build a report on registrations in Vault with the number, regulator, status, product, holder and dates, export it to CSV, and run `import registrations` with a dry run first. Headings are mapped with a small file. Sales come across from your accounts with `import sales`. Each import is all or nothing and safe to repeat. [docs/replace-veeva-vault-rim.md](docs/replace-veeva-vault-rim.md) covers what carries over and what does not.

## Architecture

```
product-registrations-for-claude-code/
  CLAUDE.md                      how the operator wants this run (routing table + house rules)
  AGENTS.md                      the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/              one slash command per recurring job
  scripts/registrations.mjs      the one CLI
  scripts/lib/registrations.mjs  every read, write, rule and import
  scripts/lib/db.mjs             one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/           the register, the rules, the regulators and the views, plain SQL
  supabase/seed.sql              a fictional group and its registrations
  views.json, documents.json     the dashboards and paperwork
  docs/                          the rules, the CLI, the migration guide
```

`npm test` runs every CLI command against a temporary database: the financial year and AICIS year arithmetic, APVMA renewal (one and five years, late and lapsed), levy and annual return dates, the TGA exemption and turnover, AICIS renewal and declaration, labels on pack, submissions, fees, obligations, both imports all or nothing, drafts, export and escaped HTML. The demo dates move with today, so the tests hold on any day of the year. The CI workflow runs it on Windows and Linux.

## Privacy

The register holds commercial information: what you sell, where, and how much. The free version assumes a trusted operator on a protected machine or a dedicated database with its own access controls. Actor labels in the activity log are labels, not signed identities. Keep `.data`, `exports`, `drafts`, `views` and `docs-out` out of git (the `.gitignore` does). Shared use with distributors or consultants needs real sign-in and permissions: that is part of what Enterprise DNA builds.

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, one small CLI, a slash command per recurring job, no front end, and a test for every rule.

## Want it installed and run for you?

Enterprise DNA installs Product Registrations for Claude Code for your business, brings your Veeva Vault RIM (or spreadsheet) register and sales across, adds the rules for every market you sell in, connects your accounts and artwork approvals, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=veeva-vault-rim)
- Read more: [enterprisedna.co/omni/instead-of/veeva-vault-rim](https://enterprisedna.co/omni/instead-of/veeva-vault-rim?utm_source=github&utm_medium=readme&utm_campaign=veeva-vault-rim)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Veeva and Vault are trademarks of Veeva Systems. This independent project is not affiliated with Veeva Systems, the TGA, the APVMA, AICIS or any regulator.
