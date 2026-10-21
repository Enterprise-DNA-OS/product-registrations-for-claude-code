-- Product Registrations for Claude Code: every product registration you hold, the dates regulators put on it,
-- and the money and declarations that keep it alive.
-- Runs on PostgreSQL 15+ and on embedded PGlite. No extensions.
-- The rules are rows, not code: /customise changes them with a new migration.
-- Amounts are whole cents. Australian regulators bill in Australian dollars; other markets carry their own currency.

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- The last 30 June before a day: the financial year the APVMA levy, the APVMA annual return
-- and the TGA annual charge exemption look back on.
create function last_fy_end(d date) returns date language sql immutable as $$
  select make_date(extract(year from (d - interval '6 months'))::int, 6, 30)
$$;

-- The last 31 August before a day: the end of the AICIS registration year the annual declaration covers.
create function aicis_year_end(d date) returns date language sql immutable as $$
  select case when d > make_date(extract(year from d)::int, 8, 31) then make_date(extract(year from d)::int, 8, 31)
              else make_date(extract(year from d)::int - 1, 8, 31) end
$$;

-- The rules the calendar and /compliance apply, each with its source.
create table rules (
  code text primary key,
  jurisdiction text not null,
  title text not null,
  label text not null,
  rule text not null,
  source text not null
);

-- Regulators. renewal says how expires_on works for that regulator's registrations:
--   apvma  expires 30 June, renewal due one month before
--   aicis  business registration expires 31 August
--   date   the expiry printed on the certificate (any other market)
--   none   the registration does not expire
create table regulators (
  code text primary key,
  name text not null,
  country text not null,
  renewal text not null default 'none' check (renewal in ('apvma','aicis','date','none')),
  website text
);

-- The legal holder of a registration: the TGA sponsor, the APVMA registrant, the AICIS introducer, the overseas licence holder.
create table holders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  abn text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  brand text,
  category text,                                  -- complementary medicine, veterinary chemical, herbicide, cosmetic
  manager text not null default 'unassigned',
  status text not null default 'active' check (status in ('active','discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One registration in one market. A product sold in three markets has three rows.
-- An AICIS business registration covers the business, not one product: product_id is empty.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                       -- as the regulator writes it: AUST L 400101, APVMA 88101
  regulator text not null references regulators(code),
  holder_id uuid not null references holders(id),
  product_id uuid references products(id),
  kind text not null default 'product' check (kind in ('listed medicine','registered medicine','device','agvet product','industrial chemicals introducer','product')),
  status text not null default 'current' check (status in ('application','current','suspended','cancelled','lapsed','refused','withdrawn')),
  applied_on date,
  granted_on date,
  expires_on date,                                -- paid up to (APVMA, AICIS) or the certificate expiry
  ended_on date,
  ace boolean not null default false,             -- TGA annual charge exemption in force for this entry
  level int check (level between 1 and 8),        -- AICIS registration level
  manager text not null default 'unassigned',
  note text,
  source text not null default 'manual',
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conditions written on the registration or certificate.
create table conditions (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id),
  number text not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (registration_id, number)
);

-- Anything lodged with a regulator: a new application, a variation, a notification, a permit.
create table submissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  registration_id uuid not null references registrations(id),
  kind text not null check (kind in ('new','variation','notification','permit','other')),
  title text not null,
  lodged_on date not null,
  regulator_ref text,
  outcome text not null default 'pending' check (outcome in ('pending','approved','refused','withdrawn')),
  decided_on date,
  owner text not null default 'unassigned',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Label versions. approved_on: the regulator approved it (or you signed it off where no approval applies).
-- in_market_on: the day it went on pack. One version in market at a time.
create table labels (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id),
  version text not null,
  approved_on date,
  in_market_on date,
  retired_on date,
  note text,
  created_at timestamptz not null default now(),
  unique (registration_id, version)
);

-- A renewal lodged and paid. period_ending is the expiry it renewed.
create table renewals (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id),
  period_ending date not null,
  lodged_on date not null,
  years int not null default 1 check (years in (1,5)),
  late boolean not null default false,
  receipt text,
  created_at timestamptz not null default now(),
  unique (registration_id, period_ending)
);

-- Sales per registration per financial year (ending 30 June). value_cents excludes GST and export sales,
-- the leviable value the APVMA asks for; quantity is what the annual return asks for.
create table sales (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id),
  fy_ending date not null,
  value_cents bigint not null check (value_cents >= 0),
  quantity numeric,
  unit text,
  currency text not null default 'AUD',
  source text not null default 'manual',
  source_hash text,
  created_at timestamptz not null default now(),
  unique (registration_id, fy_ending)
);

-- Declarations lodged with a regulator, one per registration per period.
create table declarations (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id),
  kind text not null check (kind in ('APVMA-LEVY','APVMA-RETURN','TGA-ACE','TGA-TURNOVER','AICIS-DECL')),
  period_ending date not null,
  lodged_on date not null,
  value_cents bigint,
  receipt text,
  created_at timestamptz not null default now(),
  unique (registration_id, kind, period_ending)
);

-- Invoices from regulators: annual charges, levies, renewal and application fees.
create table fees (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  registration_id uuid not null references registrations(id),
  kind text not null check (kind in ('annual charge','levy','renewal fee','application fee','late fee','registration charge','other')),
  period text,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'AUD',
  due_on date not null,
  paid_on date,
  invoice text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Anything else with a date: a condition's study results, a stability report, a post-market commitment.
create table obligations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  registration_id uuid references registrations(id),
  due_on date not null,
  owner text not null default 'unassigned',
  done_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activity (
  id bigint generated always as identity primary key,
  entity_id text not null,
  action text not null,
  actor text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create trigger holders_touch before update on holders for each row execute function touch_updated_at();
create trigger products_touch before update on products for each row execute function touch_updated_at();
create trigger registrations_touch before update on registrations for each row execute function touch_updated_at();
create trigger submissions_touch before update on submissions for each row execute function touch_updated_at();
create trigger fees_touch before update on fees for each row execute function touch_updated_at();
create trigger obligations_touch before update on obligations for each row execute function touch_updated_at();

create index registrations_product on registrations (product_id);
create index sales_registration on sales (registration_id, fy_ending);
create index fees_open on fees (due_on) where paid_on is null;
create index obligations_due on obligations (due_on) where done_on is null;

insert into rules (code, jurisdiction, title, label, rule, source) values
  ('APVMA-RENEWAL', 'AU', 'APVMA renewal of registration', 'APVMA renewal', 'Apply to renew no later than one month before the registration ends on 30 June. After 30 May a late renewal needs a written request and a late fee per product, and must be made before 30 June. A product not renewed by 30 June is de-registered and needs a new application. Renewal can be paid one year or five years ahead.', 'https://www.apvma.gov.au/registrations-and-permits/chemical-product-registration/renew-registration'),
  ('APVMA-LEVY', 'AU', 'APVMA leviable value', 'APVMA levy declaration', 'Declare the value of sales of each registered product for the financial year, excluding GST and generally excluding exports. The request goes out in September; declarations are due by 31 October. The levy is payable by 15 January.', 'https://www.apvma.gov.au/registrations-and-permits/chemical-product-registration/after-registration/levies/notice-levy-calculation'),
  ('APVMA-RETURN', 'AU', 'APVMA annual return', 'APVMA annual return', 'Lodge the annual return of the quantity of each registered product for the financial year before 30 November. Online reporting opens on 1 July. Not lodging is an offence and can bring a civil penalty.', 'https://www.apvma.gov.au/node/18326'),
  ('TGA-ACE', 'AU', 'TGA annual charge exemption', '$0 turnover declaration', 'An ARTG entry on the annual charge exemption stays exempt only while it has no turnover and a $0 turnover declaration is made each year between 1 and 22 July. A late declaration with a fee is possible until 15 September, a date that cannot be extended. With no declaration the TGA treats turnover as started and annual charges apply every year until the entry is cancelled.', 'https://www.tga.gov.au/how-we-regulate/fees-and-payments/annual-charges/annual-charge-exemption-scheme-ace/annual-charge-exemption-scheme'),
  ('TGA-TURNOVER', 'AU', 'TGA notification of turnover', 'turnover on an exempt entry', 'When an exempt ARTG entry starts generating turnover, notify the TGA. The exemption ends and the annual charge is payable that year and every year after until the entry is cancelled. Never declare $0 for an entry that sold.', 'https://www.tga.gov.au/how-we-regulate/fees-and-payments/annual-charges/annual-charge-exemption-scheme-ace/annual-charge-exemption-scheme'),
  ('AICIS-RENEWAL', 'AU', 'AICIS business registration', 'AICIS renewal', 'The registration year runs from 1 September to 31 August. A business that keeps importing or manufacturing industrial chemicals (cosmetics, soaps, paints) renews by 31 August each year, reporting the value introduced in the last financial year. Introducing without an active registration is an offence under the Industrial Chemicals Act 2019.', 'https://www.industrialchemicals.gov.au/business/getting-started-registration-importing-and-manufacturing/what-registration-and-who-must-register'),
  ('AICIS-DECL', 'AU', 'AICIS annual declaration', 'AICIS annual declaration', 'After each registration year ends on 31 August, every registered introducer submits an annual declaration by 30 November. An agent cannot submit it for you. Keep the records behind your registration and introductions for at least 5 years.', 'https://www.industrialchemicals.gov.au/business/reporting-and-record-keeping-obligations/annual-declaration-all-introducers'),
  ('EXPIRY', 'any', 'Certificate expiry', 'expiry', 'The expiry date on the registration certificate. Lodge the renewal before it, allowing for that regulator''s own lead time.', 'your registration certificate'),
  ('FEE', 'any', 'Regulator invoice', 'regulator invoice', 'The due date on the regulator''s invoice. TGA annual charge invoices are usually due by 15 September; the APVMA levy by 15 January.', 'the invoice'),
  ('LABEL', 'any', 'Label in market', 'label not approved', 'The label on pack should be the version approved for the registration. The register records which version is approved and which is in market.', 'your registration and approved label'),
  ('OBLIGATION', 'any', 'Conditions and commitments', 'obligation', 'The date written in a condition of registration or a commitment you made to the regulator. The register records it; the condition is the source.', 'your registration conditions');

insert into regulators (code, name, country, renewal, website) values
  ('TGA', 'Therapeutic Goods Administration', 'AU', 'none', 'https://www.tga.gov.au'),
  ('APVMA', 'Australian Pesticides and Veterinary Medicines Authority', 'AU', 'apvma', 'https://www.apvma.gov.au'),
  ('AICIS', 'Australian Industrial Chemicals Introduction Scheme', 'AU', 'aicis', 'https://www.industrialchemicals.gov.au'),
  ('ACVM', 'Agricultural Compounds and Veterinary Medicines (Ministry for Primary Industries)', 'NZ', 'none', 'https://www.mpi.govt.nz');

-- ---------- views ----------

-- One row per registration, with its product, holder and the latest sales year.
create view registration_register as
select r.id, r.ref, r.regulator, g.country as market, r.kind, r.status, p.code as product, p.name as product_name, h.code as holder,
       r.applied_on, r.granted_on, r.expires_on, r.ended_on, r.ace, r.level, r.manager,
       case when r.expires_on is not null then r.expires_on - current_date end as days_to_expiry,
       (select l.version from labels l where l.registration_id = r.id and l.in_market_on is not null and l.retired_on is null order by l.in_market_on desc limit 1) as label_in_market,
       (select s.value_cents from sales s where s.registration_id = r.id and s.fy_ending = last_fy_end(current_date)) as sales_last_fy_cents
from registrations r
join regulators g on g.code = r.regulator
join holders h on h.id = r.holder_id
left join products p on p.id = r.product_id;

-- Every dated obligation, done or not. kind is the rule code; due_on is the last day to act.
create view reg_calendar as
-- APVMA: renew one month before the registration ends on 30 June.
select r.id as registration_id, r.ref, p.code as product, r.manager, 'APVMA-RENEWAL' as kind,
       'Renew for the year from ' || (r.expires_on + 1) as item,
       (r.expires_on - interval '1 month')::date as due_on, n.lodged_on as done_on
from registrations r
join regulators g on g.code = r.regulator and g.renewal = 'apvma'
left join products p on p.id = r.product_id
left join renewals n on n.registration_id = r.id and n.period_ending = r.expires_on
where r.status = 'current' and r.expires_on is not null and r.expires_on <= current_date + 120
union all
-- APVMA: leviable value for the last financial year, by 31 October.
select r.id, r.ref, p.code, r.manager, 'APVMA-LEVY', 'Leviable value for the year ending ' || last_fy_end(current_date),
       make_date(extract(year from last_fy_end(current_date))::int, 10, 31), d.lodged_on
from registrations r
join regulators g on g.code = r.regulator and g.renewal = 'apvma'
left join products p on p.id = r.product_id
left join declarations d on d.registration_id = r.id and d.kind = 'APVMA-LEVY' and d.period_ending = last_fy_end(current_date)
where r.granted_on <= last_fy_end(current_date) and (r.ended_on is null or r.ended_on > last_fy_end(current_date) - 365)
union all
-- APVMA: annual return of quantities for the last financial year, before 30 November.
select r.id, r.ref, p.code, r.manager, 'APVMA-RETURN', 'Annual return of quantities for the year ending ' || last_fy_end(current_date),
       make_date(extract(year from last_fy_end(current_date))::int, 11, 29), d.lodged_on
from registrations r
join regulators g on g.code = r.regulator and g.renewal = 'apvma'
left join products p on p.id = r.product_id
left join declarations d on d.registration_id = r.id and d.kind = 'APVMA-RETURN' and d.period_ending = last_fy_end(current_date)
where r.granted_on <= last_fy_end(current_date) and (r.ended_on is null or r.ended_on > last_fy_end(current_date) - 365)
union all
-- TGA: $0 turnover declaration for exempt entries with no sales, 1 to 22 July.
select r.id, r.ref, p.code, r.manager, 'TGA-ACE', '$0 turnover declaration for the year ending ' || last_fy_end(current_date),
       last_fy_end(current_date) + 22, d.lodged_on
from registrations r
left join products p on p.id = r.product_id
left join declarations d on d.registration_id = r.id and d.kind = 'TGA-ACE' and d.period_ending = last_fy_end(current_date)
where r.regulator = 'TGA' and r.ace and r.granted_on <= last_fy_end(current_date)
  and coalesce((select s.value_cents from sales s where s.registration_id = r.id and s.fy_ending = last_fy_end(current_date)), 0) = 0
union all
-- AICIS: renew the business registration by 31 August.
select r.id, r.ref, p.code, r.manager, 'AICIS-RENEWAL', 'Renew for the registration year from ' || (r.expires_on + 1),
       r.expires_on, n.lodged_on
from registrations r
join regulators g on g.code = r.regulator and g.renewal = 'aicis'
left join products p on p.id = r.product_id
left join renewals n on n.registration_id = r.id and n.period_ending = r.expires_on
where r.status = 'current' and r.expires_on is not null and r.expires_on <= current_date + 120
union all
-- AICIS: annual declaration for the registration year that ended, by 30 November.
select r.id, r.ref, p.code, r.manager, 'AICIS-DECL', 'Annual declaration for the registration year ending ' || aicis_year_end(current_date),
       make_date(extract(year from aicis_year_end(current_date))::int, 11, 30), d.lodged_on
from registrations r
join regulators g on g.code = r.regulator and g.renewal = 'aicis'
left join products p on p.id = r.product_id
left join declarations d on d.registration_id = r.id and d.kind = 'AICIS-DECL' and d.period_ending = aicis_year_end(current_date)
where r.granted_on <= aicis_year_end(current_date) and (r.ended_on is null or r.ended_on > aicis_year_end(current_date))
union all
-- Any other market: the expiry on the certificate.
select r.id, r.ref, p.code, r.manager, 'EXPIRY', 'Certificate expires ' || r.expires_on || ': renew or let it go',
       r.expires_on - 1, null::date
from registrations r
join regulators g on g.code = r.regulator and g.renewal = 'date'
left join products p on p.id = r.product_id
where r.status = 'current' and r.expires_on is not null and r.expires_on <= current_date + 365
union all
select f.registration_id, r.ref, p.code, r.manager, 'FEE', upper(left(f.kind, 1)) || substr(f.kind, 2) || coalesce(' ' || f.period, '') || ' (' || f.code || ', ' || f.currency || ' ' || to_char(f.amount_cents / 100.0, 'FM999,999,990.00') || ')',
       f.due_on, f.paid_on
from fees f join registrations r on r.id = f.registration_id left join products p on p.id = r.product_id
union all
select o.registration_id, coalesce(r.ref, o.code), p.code, o.owner, 'OBLIGATION', o.title || ' (' || o.code || ')', o.due_on, o.done_on
from obligations o left join registrations r on r.id = o.registration_id left join products p on p.id = r.product_id;

-- Open items with the rule behind each and days left (negative = late).
create view open_dates as
select c.*, c.due_on - current_date as days_left, r.title as rule_title, r.label, r.rule, r.source
from reg_calendar c
join rules r on r.code = c.kind
where c.done_on is null;

-- Exempt TGA entries that sold in the last financial year and have not been notified.
create view ace_turnover as
select r.id, r.ref, p.code as product, r.manager, s.fy_ending, s.value_cents
from registrations r
join sales s on s.registration_id = r.id and s.fy_ending = last_fy_end(current_date) and s.value_cents > 0
left join products p on p.id = r.product_id
where r.regulator = 'TGA' and r.ace
  and not exists (select 1 from declarations d where d.registration_id = r.id and d.kind = 'TGA-TURNOVER');

-- Label versions in market that are not approved.
create view unapproved_labels as
select r.id, r.ref, p.code as product, r.manager, l.version, l.in_market_on,
       (select a.version from labels a where a.registration_id = r.id and a.approved_on is not null order by a.approved_on desc limit 1) as approved_version
from labels l
join registrations r on r.id = l.registration_id
left join products p on p.id = r.product_id
where l.in_market_on is not null and l.retired_on is null and l.approved_on is null and r.status = 'current';

-- What needs a person now, worst first.
create view attention_queue as
select case when days_left < 0 then 1 else 3 end as rank,
       case when days_left < 0 then 'late: ' else 'due: ' end || label as item,
       ref, product, manager as owner, item as detail, due_on, days_left
from open_dates
where days_left <= 30
union all
select 2, 'turnover on an exempt entry', ref, product, manager,
       'sold ' || to_char(value_cents / 100.0, 'FM999,999,990') || ' in the year ending ' || fy_ending || ': notify the TGA, annual charges now apply',
       fy_ending + 22, (fy_ending + 22) - current_date
from ace_turnover
union all
select 2, 'label not approved', ref, product, manager,
       'version ' || version || ' on pack since ' || in_market_on || coalesce(', approved version is ' || approved_version, ', no approved version on file'),
       in_market_on, in_market_on - current_date
from unapproved_labels
union all
select 4, 'submission still waiting', r.ref, p.code, s.owner,
       s.code || ' ' || s.kind || ': ' || s.title || ', lodged ' || s.lodged_on || ' (' || (current_date - s.lodged_on) || ' days)',
       s.lodged_on, s.lodged_on - current_date
from submissions s join registrations r on r.id = s.registration_id left join products p on p.id = r.product_id
where s.outcome = 'pending' and s.lodged_on <= current_date - 90;

-- Rule findings: late is a breach, due inside 30 days is a warning.
create view compliance_findings as
select kind as rule, case when days_left < 0 then 'breach' else 'warning' end as severity, ref, product,
       item || case when days_left < 0 then ': ' || abs(days_left) || ' days late (due ' || due_on || ')' else ': due ' || due_on || ', ' || days_left || ' days left' end
       || '. ' || rule as finding
from open_dates
where days_left <= 30
union all
-- An APVMA registration past 30 June with no renewal on file has ended.
select 'APVMA-RENEWAL', 'breach', r.ref, p.code,
       'Not renewed by ' || r.expires_on || '. The product is de-registered unless a renewal was lodged; record the renewal or mark it lapsed, and a new application is needed to sell it again.'
from registrations r join regulators g on g.code = r.regulator and g.renewal = 'apvma' left join products p on p.id = r.product_id
where r.status = 'current' and r.expires_on < current_date
  and not exists (select 1 from renewals n where n.registration_id = r.id and n.period_ending = r.expires_on)
union all
select 'TGA-TURNOVER', 'breach', ref, product,
       'On the annual charge exemption but sold ' || to_char(value_cents / 100.0, 'FM999,999,990') || ' in the year ending ' || fy_ending || '. Notify the TGA; the annual charge is payable.'
from ace_turnover
union all
select 'LABEL', 'warning', ref, product,
       'Label version ' || version || ' in market since ' || in_market_on || ' is not recorded as approved' || coalesce(' (approved: ' || approved_version || ')', '') || '.'
from unapproved_labels
union all
-- Renewals lodged late are findings even after they are in.
select case when g.renewal = 'aicis' then 'AICIS-RENEWAL' else 'APVMA-RENEWAL' end, 'warning', r.ref, p.code,
       'Renewal of the period ending ' || n.period_ending || ' lodged ' || n.lodged_on || ', after ' ||
       case when g.renewal = 'aicis' then n.period_ending::text else (n.period_ending - interval '1 month')::date::text end || '.'
from renewals n join registrations r on r.id = n.registration_id join regulators g on g.code = r.regulator left join products p on p.id = r.product_id
where n.lodged_on >= current_date - 365
  and (n.late or n.lodged_on > case when g.renewal = 'aicis' then n.period_ending else (n.period_ending - interval '1 month')::date end);

alter table rules enable row level security;
alter table regulators enable row level security;
alter table holders enable row level security;
alter table products enable row level security;
alter table registrations enable row level security;
alter table conditions enable row level security;
alter table submissions enable row level security;
alter table labels enable row level security;
alter table renewals enable row level security;
alter table sales enable row level security;
alter table declarations enable row level security;
alter table fees enable row level security;
alter table obligations enable row level security;
alter table activity enable row level security;
