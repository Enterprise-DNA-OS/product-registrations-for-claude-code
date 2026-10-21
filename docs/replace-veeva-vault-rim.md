# Moving off Veeva Vault RIM

The bridge is a registration report: one row per registration with its number, regulator, status, product, holder and dates. Vault builds that report from the Registration records you already keep, and every consultant and spreadsheet can produce the same thing.

## 1. Export

- In Vault, create a report on Registration with these fields: the registration number, the regulator or health authority, the registration status, the product (code and name), the holder, the registration type, and the application, approval and expiry dates. Run it, then choose **Export to CSV** from the report's Actions menu. (Vault exports up to 100,000 rows to Excel; CSV has no such limit. If your vault uses localisation settings, export to text or Excel and save as CSV.)
- Or download the public register entries for your holders: the ARTG for TGA entries, PubCRIS for APVMA products. Save as CSV.
- From your accounts, export sales by product for the last two financial years: value excluding GST and export sales, and quantity.

## 2. Map the headings

The import reads these headings. Anything else fails before a row is written, so nothing half-loads.

**Registrations:** `Registration, Regulator, Status, Product, Product name, Holder, Kind, Applied, Granted, Expires, Manager`. Only `Registration` and `Status` are required. A current registration needs `Granted`. Without a `Regulator` or `Holder` column, pass `--regulator=` or `--holder=` for the whole file.

- `Registration` is the number as the regulator writes it. `aust l400101` and `AUST L 400101` read the same.
- `Regulator` is a code or name in the `regulators` table: TGA, APVMA, AICIS, ACVM, or one you add with `/customise`.
- `Status`: current, active, approved, registered or listed; application, pending, submitted or in review; suspended, cancelled, withdrawn, lapsed, expired, refused or rejected.
- `Kind`: listed, registered, device, agvet, introducer or product. Left empty, APVMA rows are agvet products and AICIS rows are introducer registrations.
- `Product`: a product code. New codes become products, named from `Product name`.
- `Holder`: a holder code or legal name. New names become holders.
- `Expires`: for APVMA, the 30 June the registration is paid up to; for AICIS, the 31 August; elsewhere, the certificate expiry. TGA entries have none.
- Dates as `YYYY-MM-DD` or `DD/MM/YYYY`.

**Sales:** `Registration, FY ending, Value, Quantity, Unit`. `FY ending` is the 30 June that ends the financial year. `Value` in dollars (`12,500.00` or `12500`).

If your headings differ, write a map file from this register's names to yours. The one in `tests/fixtures/map.json` maps the report headings used in the test fixture:

```json
{ "Registration": "Registration Number", "Regulator": "Health Authority", "Status": "Registration Status", "Granted": "Approval Date", "Expires": "Expiration Date" }
```

## 3. Run it

```bash
node scripts/registrations.mjs import registrations vault-registrations.csv --map=map.json --dry-run
node scripts/registrations.mjs import registrations vault-registrations.csv --map=map.json
node scripts/registrations.mjs import sales sales.csv --dry-run
node scripts/registrations.mjs import sales sales.csv
node scripts/registrations.mjs attention
```

A dry run reports the counts and writes nothing. A row that fails stops the whole file with the row number and the reason. Running the same file again skips what is already there; a row that changed is refused, so corrections go through the commands, not a re-import.

## 4. Finish by hand (or ask Claude Code)

- Mark the TGA entries on the annual charge exemption: "AUST L 400102 is on the annual charge exemption."
- Set AICIS registration levels, label versions and conditions.
- Record the renewals, declarations and invoices from this year so the calendar starts clean.

## What carries over

Registrations and their status, products, holders, and the application, approval and expiry dates. Sales by year. From then on, every rule date is worked out from those.

## What does not carry over

- Submission dossiers, publishing and archived documents. Vault Submissions, Publishing and Archive hold documents; this register holds the facts about each submission (what, when, the outcome). Keep the dossiers where your documents live.
- Workflows, tasks and approvals inside Vault. Record open ones as obligations.
- Registered details at product-variant level (pack sizes, strengths, formulations per market). Add the fields you need with `/customise`, or ask Enterprise DNA to bring them across.
- Audit trail history. Export the Registration History Report to Excel and keep it with your records; the register's own activity log starts on the day you import.
