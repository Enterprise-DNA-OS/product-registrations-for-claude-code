// The registrations desk: every read and write the CLI offers, in one place.
// scripts/registrations.mjs parses the command line; scripts/smoke.mjs drives this directly.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { REPO_ROOT } from './db.mjs';
import { parseCsv } from './csv.mjs';
import { table } from './format.mjs';

export const TABLES = ['rules', 'regulators', 'holders', 'products', 'registrations', 'conditions', 'submissions', 'labels',
  'renewals', 'sales', 'declarations', 'fees', 'obligations', 'activity'];

// Reads with no arguments. Each is one query against the shared views.
export const READS = {
  registrations: `select ref, regulator, market, kind, status, product, holder, granted_on, expires_on, ace, manager
      from registration_register order by regulator, ref`,
  products: `select p.code, p.name, p.category, p.status, p.manager,
      (select count(*)::int from registrations r where r.product_id = p.id and r.status = 'current') as current_registrations,
      (select string_agg(distinct g.country, ', ') from registrations r join regulators g on g.code = r.regulator where r.product_id = p.id and r.status = 'current') as markets
      from products p order by p.code`,
  holders: `select h.code, h.name, h.abn, h.role,
      (select count(*)::int from registrations r where r.holder_id = h.id and r.status = 'current') as current_registrations
      from holders h order by h.code`,
  regulators: 'select code, name, country, renewal, website from regulators order by country, code',
  applications: `select r.ref, r.regulator, p.code as product, s.code as submission, s.kind, s.title, s.lodged_on, current_date - s.lodged_on as days_waiting, s.owner
      from submissions s join registrations r on r.id = s.registration_id left join products p on p.id = r.product_id
      where s.outcome = 'pending' order by s.lodged_on`,
  submissions: `select s.code, r.ref, s.kind, s.title, s.lodged_on, s.outcome, s.decided_on,
      case when s.decided_on is not null then s.decided_on - s.lodged_on end as days_taken, s.owner
      from submissions s join registrations r on r.id = s.registration_id order by s.lodged_on desc`,
  calendar: `select due_on, days_left, label as what, ref, product, manager as owner, item as detail
      from open_dates where due_on <= current_date + 365 order by due_on, ref`,
  attention: 'select item, ref, product, owner, detail, due_on, days_left from attention_queue order by rank, due_on, ref',
  compliance: `select rule, severity, ref, product, finding from compliance_findings
      order by case severity when 'breach' then 0 else 1 end, rule, ref`,
  renewals: `select c.ref, c.product, c.kind as rule, c.item as detail, c.due_on, c.due_on - current_date as days_left, c.done_on as lodged_on
      from reg_calendar c where c.kind in ('APVMA-RENEWAL','AICIS-RENEWAL','EXPIRY') order by c.due_on, c.ref`,
  declarations: `select c.ref, c.product, c.kind as rule, c.item as detail, c.due_on, case when c.done_on is null then c.due_on - current_date end as days_left, c.done_on as lodged_on
      from reg_calendar c where c.kind in ('APVMA-LEVY','APVMA-RETURN','TGA-ACE','AICIS-DECL') order by c.due_on, c.kind, c.ref`,
  fees: `select f.code, r.ref, f.kind, f.period, f.currency, f.amount_cents, f.due_on, f.due_on - current_date as days_left, f.invoice
      from fees f join registrations r on r.id = f.registration_id where f.paid_on is null order by f.due_on`,
  labels: `select r.ref, p.code as product, l.version, l.approved_on, l.in_market_on, l.retired_on,
      case when l.in_market_on is not null and l.retired_on is null then case when l.approved_on is null then 'ON PACK, NOT APPROVED' else 'on pack' end
           when l.retired_on is not null then 'retired' else 'approved, not yet on pack' end as state
      from labels l join registrations r on r.id = l.registration_id left join products p on p.id = r.product_id order by r.ref, l.version`,
  ace: `select r.ref, p.code as product, r.granted_on, coalesce(s.value_cents, 0) as sales_last_fy_cents,
      (select d.lodged_on from declarations d where d.registration_id = r.id and d.kind = 'TGA-ACE' and d.period_ending = last_fy_end(current_date)) as declared_on,
      case when coalesce(s.value_cents, 0) > 0 then 'sold: notify turnover' else 'no turnover' end as state
      from registrations r left join products p on p.id = r.product_id
      left join sales s on s.registration_id = r.id and s.fy_ending = last_fy_end(current_date)
      where r.regulator = 'TGA' and r.ace and r.status = 'current' order by r.ref`,
  sales: `select r.ref, r.regulator, p.code as product, s.fy_ending, s.currency, s.value_cents, s.quantity, s.unit
      from sales s join registrations r on r.id = s.registration_id left join products p on p.id = r.product_id
      where s.fy_ending = last_fy_end(current_date) order by s.value_cents desc`,
  expiring: `select ref, regulator, product, expires_on, days_to_expiry as days_left, manager from registration_register
      where status = 'current' and expires_on is not null and expires_on <= current_date + 365 order by expires_on`,
  obligations: `select o.code, o.title, coalesce(r.ref, '') as registration, o.owner, o.due_on, o.due_on - current_date as days_left
      from obligations o left join registrations r on r.id = o.registration_id where o.done_on is null order by o.due_on, o.code`,
  rules: 'select code, jurisdiction, title, rule, source from rules order by jurisdiction desc, code',
  activity: 'select entity_id, action, actor, detail, created_at from activity order by created_at desc, id desc limit 50',
};

// Ten questions, each one query. /insights runs them all.
export const QUESTIONS = [
  ['Which registrations lapse or expire in the next twelve months, and who owns them?', READS.expiring],
  ['How many current registrations do we hold with each regulator, in each market?',
    `select regulator, market, count(*)::int as current, count(*) filter (where ace)::int as on_exemption from registration_register
     where status = 'current' group by regulator, market order by current desc`],
  ['Which products are registered in more than one market?',
    `select product, product_name, count(*)::int as registrations, string_agg(regulator, ', ' order by regulator) as regulators from registration_register
     where status = 'current' and product is not null group by product, product_name having count(*) > 1 order by registrations desc`],
  ['Which registrations sold nothing last financial year but are still current?',
    `select ref, regulator, product, ace, manager from registration_register where status = 'current' and product is not null
     and coalesce(sales_last_fy_cents, 0) = 0 order by regulator, ref`],
  ['What have we paid each regulator over the last twelve months?',
    `select g.code as regulator, f.currency, count(*)::int as invoices, sum(f.amount_cents)::bigint as paid_cents from fees f
     join registrations r on r.id = f.registration_id join regulators g on g.code = r.regulator
     where f.paid_on > current_date - 365 group by g.code, f.currency order by paid_cents desc`],
  ['What is the leviable value by holder for the last financial year, and how did it move?',
    `select h.code as holder, sum(s.value_cents) filter (where s.fy_ending = last_fy_end(current_date))::bigint as last_fy_cents,
       sum(s.value_cents) filter (where s.fy_ending = (last_fy_end(current_date) - interval '1 year')::date)::bigint as year_before_cents
     from sales s join registrations r on r.id = s.registration_id join holders h on h.id = r.holder_id
     where r.regulator = 'APVMA' group by h.code order by last_fy_cents desc nulls last`],
  ['How long do regulators take to decide, by kind of submission?',
    `select r.regulator, s.kind, count(*)::int as decided, round(avg(s.decided_on - s.lodged_on))::int as avg_days, max(s.decided_on - s.lodged_on) as longest_days
     from submissions s join registrations r on r.id = s.registration_id where s.decided_on is not null group by r.regulator, s.kind order by r.regulator, s.kind`],
  ['Which submissions are still waiting, and for how long?', READS.applications],
  ['Which labels on pack are not the approved version?',
    'select ref, product, version, in_market_on, approved_version, manager from unapproved_labels order by in_market_on'],
  ['Who carries the most open dates, and how many are late?',
    `select manager as owner, count(*)::int as open_items, count(*) filter (where days_left < 0)::int as late from open_dates
     where due_on <= current_date + 90 group by manager order by late desc, open_items desc`],
];

// Command name -> [positional args, allowed flags]. Unknown flags fail before anything is written.
const SPECS = {
  ...Object.fromEntries(Object.keys(READS).map((k) => [k, [0, []]])),
  due: [0, ['days']],
  insights: [0, []],
  registration: [1, []],
  product: [1, []],
  'add-holder': [0, ['actor', 'code', 'name', 'abn', 'role']],
  'add-product': [0, ['actor', 'code', 'name', 'brand', 'category', 'manager']],
  'add-registration': [0, ['actor', 'ref', 'regulator', 'holder', 'product', 'kind', 'status', 'applied', 'granted', 'expires', 'ace', 'level', 'manager', 'note']],
  grant: [1, ['actor', 'on', 'expires']],
  lodge: [1, ['actor', 'kind', 'title', 'on', 'regulator-ref', 'owner']],
  decide: [1, ['actor', 'outcome', 'on']],
  renew: [1, ['actor', 'on', 'years', 'receipt']],
  declare: [1, ['actor', 'kind', 'on', 'period', 'value', 'receipt']],
  'record-sales': [1, ['actor', 'fy', 'value', 'quantity', 'unit', 'currency']],
  'add-fee': [1, ['actor', 'kind', 'amount', 'due', 'period', 'invoice', 'currency', 'note']],
  'pay-fee': [1, ['actor', 'on']],
  'add-label': [1, ['actor', 'version', 'approved', 'note']],
  'approve-label': [1, ['actor', 'version', 'on']],
  'label-in-market': [1, ['actor', 'version', 'on']],
  'add-condition': [1, ['actor', 'number', 'text']],
  'add-obligation': [0, ['actor', 'title', 'registration', 'due', 'owner', 'note']],
  done: [1, ['actor', 'on']],
  end: [1, ['actor', 'on', 'status', 'reason']],
  import: [2, ['actor', 'map', 'dry-run', 'holder', 'regulator']],
  export: [0, ['file']],
  'weekly-review': [0, []],
  'draft-renewals': [0, []],
  'draft-levy': [0, []],
  'draft-ace': [0, []],
  'draft-aicis': [0, []],
  'draft-submission': [1, []],
};
export const COMMANDS = Object.keys(SPECS);

export function help() {
  return `Registrations desk. node scripts/registrations.mjs <command> [arguments] [--key=value] [--json]
${COMMANDS.join(', ')}
Exact syntax: docs/cli.md. Nothing here lodges with a regulator or pays an invoice.`;
}

// ---------- small helpers ----------

const BOOL_FLAGS = new Set(['dry-run', 'ace']);
function flag(o, k) {
  if (o[k] === undefined) return false;
  if (o[k] !== true) throw Error(`--${k} takes no value`);
  return true;
}
function required(o, k) {
  const v = o[k];
  if (typeof v !== 'string' || !v.trim()) throw Error(`Required --${k}=value`);
  return v.trim();
}
function optional(o, k) {
  const v = o[k];
  if (v === undefined) return null;
  if (typeof v !== 'string' || !v.trim()) throw Error(`--${k} needs a value`);
  return v.trim();
}
export function today() { return new Date().toISOString().slice(0, 10); }
export function isoDate(s, label = 'date') {
  const v = String(s ?? '');
  const au = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = au ? `${au[3]}-${au[2].padStart(2, '0')}-${au[1].padStart(2, '0')}` : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`Invalid ${label}: ${s} (use YYYY-MM-DD)`);
  return iso;
}
export function cents(value) {
  const s = String(value ?? '').replace(/^\$/, '').replaceAll(',', '');
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(s)) throw Error('Amount must be a dollar figure like 1150 or 1,150.00');
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
// "aust l 400101", "AUST L400101" and " AUST  L 400101 " all mean AUST L 400101.
export function normaliseRef(s) {
  const v = String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!v || v.length > 60 || !/^[A-Z0-9][A-Z0-9 ./-]*$/.test(v)) throw Error(`Not a registration number: ${s}`);
  const artg = v.match(/^AUST\s?([LRS]|L\(A\))\s?(\d{3,7})$/);
  return artg ? `AUST ${artg[1]} ${artg[2]}` : v;
}
// The 30 June that ends the financial year a date falls in.
export function fyEnding(d) {
  const [y, m] = isoDate(d).split('-').map(Number);
  return `${m >= 7 ? y + 1 : y}-06-30`;
}
function money(c, cur = 'AUD') { return c == null ? 'none set' : `${cur === 'AUD' ? '$' : cur + ' '}` + (Number(c) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function actor(o) { return optional(o, 'actor') || 'operator'; }
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

async function audit(db, id, action, who, detail = {}) {
  await db.query('insert into activity (entity_id, action, actor, detail) values ($1, $2, $3, $4)', [String(id), action, who, JSON.stringify(detail)]);
}
async function one(db, sql, params) { return (await db.query(sql, params))[0]; }

// Find one record by code, number, id prefix or name. Ambiguous or missing: list and stop.
async function pick(db, kind, ref) {
  if (!ref) throw Error(`Missing ${kind} reference`);
  const q = {
    registration: "select r.id, r.ref as key, coalesce(p.name, h.name) as name from registrations r join holders h on h.id = r.holder_id left join products p on p.id = r.product_id order by r.ref",
    holder: 'select id, code as key, name from holders order by code',
    product: 'select id, code as key, name from products order by code',
    submission: 'select id, code as key, title as name from submissions order by code',
    fee: "select id, code as key, kind || coalesce(' ' || period, '') as name from fees order by code",
    obligation: 'select id, code as key, title as name from obligations order by code',
    regulator: 'select code as id, code as key, name from regulators order by code',
  }[kind];
  const rows = await db.query(q);
  const r = String(ref).toLowerCase();
  const squash = (s) => String(s).toLowerCase().replace(/\s+/g, '');
  let hits = rows.filter((x) => same(x.key, ref) || squash(x.key) === squash(ref) || same(x.id, ref) || same(x.name, ref));
  if (!hits.length) hits = rows.filter((x) => String(x.id).toLowerCase().startsWith(r) || squash(x.key).endsWith(squash(ref)) || squash(x.key).startsWith(squash(ref)) || String(x.name).toLowerCase().includes(r));
  if (hits.length !== 1) {
    throw Error(`${hits.length ? 'Ambiguous' : 'No matching'} ${kind}: ${ref}\n${(hits.length ? hits : rows).map((x) => `  ${x.key}  ${x.name}`).join('\n')}`);
  }
  return hits[0];
}
async function registrationRow(db, ref) {
  const hit = await pick(db, 'registration', ref);
  return one(db, `select r.*, g.renewal, g.country from registrations r join regulators g on g.code = r.regulator where r.id = $1`, [hit.id]);
}
async function update(db, tableName, id, values) {
  const keys = Object.keys(values);
  return one(db, `update ${tableName} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning *`, [id, ...Object.values(values)]);
}
async function insert(db, tableName, values) {
  const keys = Object.keys(values);
  return one(db, `insert into ${tableName} (${keys.join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, Object.values(values));
}
async function nextCode(db, tableName, prefix, width = 3) {
  const rows = await db.query(`select code from ${tableName} where code like $1`, [prefix + '%']);
  const max = rows.map((x) => Number(String(x.code).slice(prefix.length))).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(width, '0');
}
async function tx(db, fn) {
  await db.exec('BEGIN');
  try { const out = await fn(); await db.exec('COMMIT'); return out; } catch (e) { await db.exec('ROLLBACK'); throw e; }
}
function current(r) { if (r.status !== 'current') throw Error(`${r.ref} is ${r.status}, not current`); }
function notFuture(on, what = 'That date') { if (on > today()) throw Error(`${what} cannot be in the future`); }
const dstr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
function addYears(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
  return `${y + n}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
function minusMonth(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

function writeFile(file, content) {
  const f = path.resolve(file);
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  fs.writeFileSync(f, content, { flag: 'wx', mode: 0o600 });
  return f;
}
function outDir() { return process.env.OUTPUT_DIR || REPO_ROOT; }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function draft(name, body) {
  return { file: writeFile(path.join(outDir(), 'drafts', `${slug(name)}-${today()}-${randomUUID().slice(0, 8)}.md`), body) };
}
function mdTable(rows) {
  if (!rows.length) return 'Nil.';
  const keys = Object.keys(rows[0]);
  const cell = (v, k) => (v == null ? '' : k.endsWith('_cents') ? money(v) : v instanceof Date ? dstr(v) : String(v)).replaceAll('|', '/');
  return [`| ${keys.map((k) => k.replace(/_cents$/, '').replaceAll('_', ' ')).join(' | ')} |`, `|${keys.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${keys.map((k) => cell(r[k], k)).join(' | ')} |`)].join('\n');
}

// ---------- output ----------

function show(v, key) {
  if (v == null) return '';
  if (key.endsWith('_cents')) return (Number(v) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof v === 'object') return v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v);
  return v;
}
function render(rows) {
  if (!rows.length) return '(none)';
  return table(rows, Object.keys(rows[0]).map((key) => ({ key, label: key.replace(/_cents$/, '').replaceAll('_', ' '), format: (v) => show(v, key) })));
}
export function human(result) {
  if (Array.isArray(result) && result[0]?.question) return result.map((x) => `${x.question}\n${render(x.rows)}`).join('\n\n');
  if (Array.isArray(result)) return render(result);
  if (result && result.sections) return result.sections.map((s) => `${s.title}\n${render(s.rows)}`).join('\n\n');
  return JSON.stringify(result, null, 2);
}

// ---------- imports ----------
// registrations: a registration report saved as CSV (a Veeva Vault RIM report export, a consultant's register, a spreadsheet).
// sales: sales per registration per financial year, from the accounts.
export const REGISTRATION_COLUMNS = ['Registration', 'Regulator', 'Status', 'Product', 'Product name', 'Holder', 'Kind', 'Applied', 'Granted', 'Expires', 'Manager'];
export const SALES_COLUMNS = ['Registration', 'FY ending', 'Value', 'Quantity', 'Unit'];
const REQUIRED = { registrations: ['Registration', 'Status'], sales: ['Registration', 'FY ending', 'Value'] };
const STATUS_WORDS = { current: 'current', active: 'current', approved: 'current', registered: 'current', listed: 'current',
  application: 'application', pending: 'application', submitted: 'application', 'in review': 'application',
  suspended: 'suspended', cancelled: 'cancelled', canceled: 'cancelled', withdrawn: 'withdrawn', lapsed: 'lapsed', expired: 'lapsed', refused: 'refused', rejected: 'refused' };
const KIND_WORDS = { 'listed medicine': 'listed medicine', listed: 'listed medicine', 'registered medicine': 'registered medicine', registered: 'registered medicine',
  device: 'device', 'medical device': 'device', agvet: 'agvet product', 'agvet product': 'agvet product', 'agricultural chemical': 'agvet product', 'veterinary chemical': 'agvet product',
  introducer: 'industrial chemicals introducer', 'industrial chemicals introducer': 'industrial chemicals introducer', product: 'product' };

async function importCsv(db, args, o) {
  const [kind, file] = args;
  if (!['registrations', 'sales'].includes(kind)) throw Error('Supported imports: registrations (a registration report as CSV), sales (sales per registration per year as CSV)');
  const columns = kind === 'registrations' ? REGISTRATION_COLUMNS : SALES_COLUMNS;
  const dry = flag(o, 'dry-run');
  const who = actor(o);
  const map = o.map ? JSON.parse(fs.readFileSync(path.resolve(String(o.map)), 'utf8')) : {};
  for (const k of Object.keys(map)) if (!columns.includes(k)) throw Error(`--map names an unknown field: ${k}`);
  const rows = parseCsv(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!rows.length) throw Error('The file has no rows');
  const heading = (k) => map[k] || k;
  const known = new Set(columns.map(heading));
  for (const h of Object.keys(rows[0])) if (!known.has(h)) throw Error(`Unknown column "${h}". Map it with --map or remove it.`);
  for (const k of REQUIRED[kind]) if (!(heading(k) in rows[0])) throw Error(`Missing column "${heading(k)}"`);
  if (kind === 'registrations' && !(heading('Regulator') in rows[0]) && !o.regulator) throw Error('No Regulator column: add one or pass --regulator');
  if (kind === 'registrations' && !(heading('Holder') in rows[0]) && !o.holder) throw Error('No Holder column: add one or pass --holder');
  const get = (r, k) => String(r[heading(k)] ?? '').trim();
  const result = { kind, file: path.resolve(file), rows: rows.length, inserted: 0, skipped: 0, dry_run: dry };
  const defaultHolder = o.holder ? await pick(db, 'holder', String(o.holder)) : null;
  const defaultRegulator = o.regulator ? await pick(db, 'regulator', String(o.regulator)) : null;
  const holders = await db.query('select id, code, name from holders');
  const products = await db.query('select id, code, name from products');
  const regulators = await db.query('select code, name from regulators');
  const seen = new Set();
  await db.exec('BEGIN');
  try {
    for (const [i, r] of rows.entries()) {
      const line = `row ${i + 2}`;
      for (const k of REQUIRED[kind]) if (!get(r, k)) throw Error(`${line}: ${k} is empty`);
      let ref;
      try { ref = normaliseRef(get(r, 'Registration')); } catch (e) { throw Error(`${line}: ${e.message}`); }
      const hash = createHash('sha256').update(JSON.stringify(columns.map((k) => get(r, k)))).digest('hex');
      if (kind === 'sales') {
        const reg = await one(db, 'select id from registrations where ref = $1', [ref]);
        if (!reg) throw Error(`${line}: ${ref} is not in the register. Import the registrations first.`);
        const fy = isoDate(get(r, 'FY ending'), `${line} FY ending`);
        if (!fy.endsWith('-06-30')) throw Error(`${line}: FY ending must be a 30 June`);
        const existing = await one(db, 'select source_hash from sales where registration_id = $1 and fy_ending = $2', [reg.id, fy]);
        if (existing) {
          if (existing.source_hash === hash) { result.skipped++; continue; }
          throw Error(`${line}: sales for ${ref} in the year ending ${fy} are already recorded with different values. Correct them with record-sales.`);
        }
        let value;
        try { value = cents(get(r, 'Value')); } catch (e) { throw Error(`${line}: ${e.message}`); }
        const qty = get(r, 'Quantity') ? Number(get(r, 'Quantity').replaceAll(',', '')) : null;
        if (qty != null && !(qty >= 0)) throw Error(`${line}: Quantity must be a number`);
        await insert(db, 'sales', { registration_id: reg.id, fy_ending: fy, value_cents: value, quantity: qty, unit: get(r, 'Unit') || null, source: 'import', source_hash: hash });
        result.inserted++;
        continue;
      }
      if (seen.has(ref)) throw Error(`${line}: ${ref} appears twice. One row per registration.`);
      seen.add(ref);
      const existing = await one(db, 'select id, source_hash from registrations where ref = $1', [ref]);
      if (existing) {
        if (existing.source_hash === hash) { result.skipped++; continue; }
        throw Error(`${line}: ${ref} is already in the register with different values. Correct it with the commands, not a re-import.`);
      }
      const status = STATUS_WORDS[get(r, 'Status').toLowerCase()];
      if (!status) throw Error(`${line}: Status "${get(r, 'Status')}" is not one of ${Object.keys(STATUS_WORDS).join(', ')}`);
      const regName = get(r, 'Regulator');
      const regulator = regName ? regulators.find((g) => same(g.code, regName) || same(g.name, regName)) : defaultRegulator && { code: defaultRegulator.key };
      if (!regulator) throw Error(`${line}: regulator "${regName}" is not set up. Known: ${regulators.map((g) => g.code).join(', ')}. Add it with /customise.`);
      const kindWord = get(r, 'Kind') ? KIND_WORDS[get(r, 'Kind').toLowerCase()] : regulator.code === 'APVMA' ? 'agvet product' : regulator.code === 'AICIS' ? 'industrial chemicals introducer' : 'product';
      if (!kindWord) throw Error(`${line}: Kind "${get(r, 'Kind')}" is not one of ${Object.keys(KIND_WORDS).join(', ')}`);
      const d = (k) => (get(r, k) ? isoDate(get(r, k), `${line} ${k}`) : null);
      const granted = d('Granted');
      if (status === 'current' && !granted) throw Error(`${line}: a current registration needs its Granted date`);
      const holderName = get(r, 'Holder');
      let holder = holderName ? holders.find((h) => same(h.code, holderName) || same(h.name, holderName)) : defaultHolder && { id: defaultHolder.id };
      if (holderName && !holder) {
        holder = await insert(db, 'holders', { code: await nextCode(db, 'holders', 'H-'), name: holderName });
        holders.push(holder);
      }
      if (!holder) throw Error(`${line}: no Holder. Add one or pass --holder.`);
      const productCode = get(r, 'Product');
      let product = null;
      if (productCode) {
        product = products.find((p) => same(p.code, productCode) || same(p.name, productCode));
        if (!product) {
          product = await insert(db, 'products', { code: productCode.toUpperCase().slice(0, 20), name: get(r, 'Product name') || productCode });
          products.push(product);
        }
      }
      const reg = await insert(db, 'registrations', { ref, regulator: regulator.code, holder_id: holder.id, product_id: product?.id ?? null, kind: kindWord, status,
        applied_on: d('Applied'), granted_on: granted, expires_on: d('Expires'), manager: get(r, 'Manager') || 'unassigned', source: 'import', source_hash: hash });
      await audit(db, reg.id, 'import', who, { ref, file: path.basename(file) });
      result.inserted++;
    }
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return result;
}

// ---------- the commands ----------

const DECLARATION_KINDS = { levy: 'APVMA-LEVY', 'apvma-levy': 'APVMA-LEVY', return: 'APVMA-RETURN', 'apvma-return': 'APVMA-RETURN',
  ace: 'TGA-ACE', 'tga-ace': 'TGA-ACE', turnover: 'TGA-TURNOVER', 'tga-turnover': 'TGA-TURNOVER', aicis: 'AICIS-DECL', 'aicis-decl': 'AICIS-DECL' };
const DECLARATION_REGULATOR = { 'APVMA-LEVY': 'APVMA', 'APVMA-RETURN': 'APVMA', 'TGA-ACE': 'TGA', 'TGA-TURNOVER': 'TGA', 'AICIS-DECL': 'AICIS' };

export async function run(db, cmd, args = [], o = {}) {
  const spec = SPECS[cmd];
  if (!spec) throw Error(`Unknown command: ${cmd}\n${help()}`);
  if (args.length !== spec[0]) throw Error(`${cmd} takes ${spec[0]} argument(s), got ${args.length}`);
  for (const k of Object.keys(o)) {
    if (!spec[1].includes(k)) throw Error(`Unknown flag --${k} for ${cmd}`);
    if (!BOOL_FLAGS.has(k) && o[k] === true) throw Error(`--${k} needs a value`);
    if (BOOL_FLAGS.has(k) && o[k] !== true) throw Error(`--${k} takes no value`);
  }
  if (READS[cmd]) return db.query(READS[cmd]);
  const who = () => actor(o);
  switch (cmd) {
    case 'due': {
      const days = Number(o.days ?? 30);
      if (!Number.isInteger(days) || days < 0 || days > 730) throw Error('--days must be a whole number from 0 to 730');
      return db.query(`select due_on, days_left, label as what, ref, product, manager as owner, item as detail, rule
        from open_dates where days_left <= $1 order by due_on, ref`, [days]);
    }
    case 'insights': {
      const out = [];
      for (const [question, sql] of QUESTIONS) out.push({ question, rows: await db.query(sql) });
      return out;
    }
    case 'registration': {
      const r = await registrationRow(db, args[0]);
      const id = [r.id];
      return {
        ref: r.ref,
        sections: [
          { title: r.ref, rows: await db.query(`select ref, regulator, market, kind, status, product, product_name, holder, applied_on, granted_on, expires_on, ended_on, ace, level, manager
              from registration_register where id = $1`, id) },
          { title: 'Dates', rows: await db.query('select kind as rule, item, due_on, done_on from reg_calendar where registration_id = $1 order by due_on', id) },
          { title: 'Submissions', rows: await db.query('select code, kind, title, lodged_on, outcome, decided_on from submissions where registration_id = $1 order by lodged_on desc', id) },
          { title: 'Labels', rows: await db.query('select version, approved_on, in_market_on, retired_on, note from labels where registration_id = $1 order by version', id) },
          { title: 'Conditions', rows: await db.query('select number, text from conditions where registration_id = $1 order by number', id) },
          { title: 'Sales', rows: await db.query('select fy_ending, currency, value_cents, quantity, unit from sales where registration_id = $1 order by fy_ending desc', id) },
          { title: 'Declarations', rows: await db.query('select kind, period_ending, lodged_on, value_cents, receipt from declarations where registration_id = $1 order by period_ending desc, kind', id) },
          { title: 'Renewals', rows: await db.query('select period_ending, lodged_on, years, late, receipt from renewals where registration_id = $1 order by period_ending desc', id) },
          { title: 'Fees', rows: await db.query('select code, kind, period, currency, amount_cents, due_on, paid_on from fees where registration_id = $1 order by due_on desc', id) },
          { title: 'Obligations', rows: await db.query('select code, title, due_on, done_on, owner from obligations where registration_id = $1 order by due_on', id) },
          { title: 'History', rows: await db.query('select action, actor, detail, created_at from activity where entity_id = $1 order by created_at desc, id desc limit 20', [String(r.id)]) },
        ],
      };
    }
    case 'product': {
      const p = await pick(db, 'product', args[0]);
      return {
        product: p.key,
        sections: [
          { title: `${p.key} ${p.name}`, rows: await db.query('select code, name, brand, category, status, manager from products where id = $1', [p.id]) },
          { title: 'Registrations', rows: await db.query(`select ref, regulator, market, status, holder, granted_on, expires_on, ace, label_in_market, sales_last_fy_cents
              from registration_register where product = $1 order by regulator`, [p.key]) },
          { title: 'Open dates', rows: await db.query('select due_on, days_left, label as what, ref, item as detail from open_dates where product = $1 order by due_on', [p.key]) },
        ],
      };
    }
    case 'add-holder': {
      const code = required(o, 'code').toUpperCase();
      if (await one(db, 'select 1 from holders where code = $1', [code])) throw Error(`Holder ${code} already exists`);
      const h = await insert(db, 'holders', { code, name: required(o, 'name'), abn: optional(o, 'abn'), role: optional(o, 'role') });
      await audit(db, h.id, 'add-holder', who(), { code });
      return h;
    }
    case 'add-product': {
      const code = required(o, 'code').toUpperCase();
      if (await one(db, 'select 1 from products where code = $1', [code])) throw Error(`Product ${code} already exists`);
      const p = await insert(db, 'products', { code, name: required(o, 'name'), brand: optional(o, 'brand'), category: optional(o, 'category'), manager: optional(o, 'manager') || 'unassigned' });
      await audit(db, p.id, 'add-product', who(), { code });
      return p;
    }
    case 'add-registration': {
      const ref = normaliseRef(required(o, 'ref'));
      if (await one(db, 'select 1 from registrations where ref = $1', [ref])) throw Error(`${ref} is already in the register`);
      const regulator = (await pick(db, 'regulator', required(o, 'regulator'))).key;
      const g = await one(db, 'select renewal from regulators where code = $1', [regulator]);
      const holder = await pick(db, 'holder', required(o, 'holder'));
      const product = o.product ? await pick(db, 'product', required(o, 'product')) : null;
      const kind = optional(o, 'kind') || (regulator === 'APVMA' ? 'agvet product' : regulator === 'AICIS' ? 'industrial chemicals introducer' : regulator === 'TGA' ? 'listed medicine' : 'product');
      if (!Object.values(KIND_WORDS).includes(kind)) throw Error(`--kind must be one of ${[...new Set(Object.values(KIND_WORDS))].join(', ')}`);
      if (kind !== 'industrial chemicals introducer' && !product) throw Error('Name the product with --product (only an AICIS business registration has none)');
      const status = optional(o, 'status') || (o.granted ? 'current' : 'application');
      if (!['application', 'current'].includes(status)) throw Error('--status must be application or current');
      const applied = o.applied ? isoDate(o.applied, '--applied') : null;
      const granted = o.granted ? isoDate(o.granted, '--granted') : null;
      if (status === 'current' && !granted) throw Error('A current registration needs --granted (the regulator\'s date)');
      if (status === 'application' && granted) throw Error('An application has no grant date yet. Record the grant with grant.');
      if (applied && granted && granted < applied) throw Error('Granted cannot be before applied');
      if (granted) notFuture(granted, 'The grant date');
      const expires = o.expires ? isoDate(o.expires, '--expires') : null;
      if (g.renewal === 'apvma' && expires && !expires.endsWith('-06-30')) throw Error('APVMA registrations end on 30 June. Give the 30 June it is paid up to.');
      if (g.renewal === 'aicis' && expires && !expires.endsWith('-08-31')) throw Error('An AICIS registration year ends on 31 August.');
      if (status === 'current' && ['apvma', 'aicis', 'date'].includes(g.renewal) && !expires) throw Error(`A current ${regulator} registration needs --expires (the date it is paid up to or the certificate expiry)`);
      const ace = flag(o, 'ace');
      if (ace && regulator !== 'TGA') throw Error('--ace is the TGA annual charge exemption: TGA entries only');
      const level = o.level ? Number(o.level) : null;
      if (level != null && (regulator !== 'AICIS' || !Number.isInteger(level) || level < 1 || level > 8)) throw Error('--level is the AICIS registration level, 1 to 8');
      return tx(db, async () => {
        const r = await insert(db, 'registrations', { ref, regulator, holder_id: holder.id, product_id: product?.id ?? null, kind, status, applied_on: applied,
          granted_on: granted, expires_on: expires, ace, level, manager: optional(o, 'manager') || 'unassigned', note: optional(o, 'note') });
        await audit(db, r.id, 'add-registration', who(), { ref, regulator, status });
        return r;
      });
    }
    case 'grant': {
      const r = await registrationRow(db, args[0]);
      if (r.status !== 'application') throw Error(`${r.ref} is ${r.status}, not an application`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The grant date');
      if (r.applied_on && on < dstr(r.applied_on)) throw Error('Granted cannot be before applied');
      const expires = o.expires ? isoDate(o.expires, '--expires') : null;
      if (r.renewal === 'apvma' && (!expires || !expires.endsWith('-06-30'))) throw Error('APVMA registrations end on 30 June: give --expires as the 30 June it is paid up to');
      if (['aicis', 'date'].includes(r.renewal) && !expires) throw Error('Give --expires as printed on the certificate');
      return tx(db, async () => {
        const out = await update(db, 'registrations', r.id, { status: 'current', granted_on: on, expires_on: expires });
        await db.query("update submissions set outcome = 'approved', decided_on = $2 where registration_id = $1 and kind = 'new' and outcome = 'pending'", [r.id, on]);
        await audit(db, r.id, 'grant', who(), { on, expires });
        return out;
      });
    }
    case 'lodge': {
      const r = await registrationRow(db, args[0]);
      const kind = required(o, 'kind');
      if (!['new', 'variation', 'notification', 'permit', 'other'].includes(kind)) throw Error('--kind must be new, variation, notification, permit or other');
      if (kind === 'new' && r.status !== 'application') throw Error(`${r.ref} is already ${r.status}. A change to it is a variation.`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The lodgement date');
      return tx(db, async () => {
        const s = await insert(db, 'submissions', { code: await nextCode(db, 'submissions', 'SUB-'), registration_id: r.id, kind, title: required(o, 'title'), lodged_on: on,
          regulator_ref: optional(o, 'regulator-ref'), owner: optional(o, 'owner') || r.manager });
        await audit(db, r.id, 'lodge', who(), { code: s.code, kind, on });
        return s;
      });
    }
    case 'decide': {
      const hit = await pick(db, 'submission', args[0]);
      const s = await one(db, 'select * from submissions where id = $1', [hit.id]);
      if (s.outcome !== 'pending') throw Error(`${s.code} was already ${s.outcome} on ${dstr(s.decided_on)}`);
      const outcome = required(o, 'outcome');
      if (!['approved', 'refused', 'withdrawn'].includes(outcome)) throw Error('--outcome must be approved, refused or withdrawn');
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The decision date');
      if (on < dstr(s.lodged_on)) throw Error('The decision cannot be before the lodgement');
      return tx(db, async () => {
        const out = await update(db, 'submissions', s.id, { outcome, decided_on: on });
        if (s.kind === 'new' && outcome !== 'approved') await update(db, 'registrations', s.registration_id, { status: outcome === 'refused' ? 'refused' : 'withdrawn', ended_on: on });
        await audit(db, s.registration_id, 'decide', who(), { code: s.code, outcome, on });
        return out;
      });
    }
    case 'renew': {
      const r = await registrationRow(db, args[0]);
      current(r);
      if (!['apvma', 'aicis', 'date'].includes(r.renewal)) throw Error(`${r.regulator} registrations do not renew. Nothing to record.`);
      if (!r.expires_on) throw Error(`${r.ref} has no expiry on file. Set it with /customise or re-add the registration.`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The renewal date');
      const period = dstr(r.expires_on);
      const years = Number(o.years ?? 1);
      if (![1, 5].includes(years)) throw Error('--years must be 1 or 5');
      if (r.renewal === 'aicis' && years !== 1) throw Error('An AICIS registration renews one year at a time');
      if (r.renewal === 'apvma' && on > period) throw Error(`${r.ref} ended on ${period}. A product not renewed by 30 June is de-registered: mark it lapsed with end and lodge a new application.`);
      const late = r.renewal === 'apvma' ? on > minusMonth(period) : on > period;
      return tx(db, async () => {
        const n = await insert(db, 'renewals', { registration_id: r.id, period_ending: period, lodged_on: on, years, late, receipt: optional(o, 'receipt') });
        const next = addYears(period, years);
        await update(db, 'registrations', r.id, { expires_on: next });
        await audit(db, r.id, 'renew', who(), { period_ending: period, on, years, late, now_expires: next });
        return { ...n, now_expires: next, note: late ? (r.renewal === 'apvma' ? 'Lodged after the one month cut-off: a late renewal needs the APVMA\'s agreement and the late fee per product.' : 'Lodged after 31 August.') : 'On time.' };
      });
    }
    case 'declare': {
      const r = await registrationRow(db, args[0]);
      const kind = DECLARATION_KINDS[required(o, 'kind').toLowerCase()];
      if (!kind) throw Error(`--kind must be one of ${Object.keys(DECLARATION_KINDS).join(', ')}`);
      if (DECLARATION_REGULATOR[kind] !== r.regulator) throw Error(`${kind} is a ${DECLARATION_REGULATOR[kind]} declaration; ${r.ref} is with ${r.regulator}`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The declaration date');
      const [{ fy, ay }] = await db.query('select last_fy_end(current_date)::text as fy, aicis_year_end(current_date)::text as ay');
      const period = o.period ? isoDate(o.period, '--period') : kind === 'AICIS-DECL' ? ay : fy;
      if (kind === 'AICIS-DECL' ? !period.endsWith('-08-31') : !period.endsWith('-06-30')) throw Error(`--period must be the ${kind === 'AICIS-DECL' ? '31 August that ended the registration year' : '30 June that ended the financial year'}`);
      if (on <= period) throw Error('A declaration is lodged after the period it covers ends');
      if (kind === 'TGA-ACE' && !r.ace) throw Error(`${r.ref} is not on the annual charge exemption`);
      const sold = await one(db, 'select value_cents from sales where registration_id = $1 and fy_ending = $2', [r.id, period]);
      if (kind === 'TGA-ACE' && sold && Number(sold.value_cents) > 0) throw Error(`${r.ref} sold ${money(sold.value_cents)} in the year ending ${period}. A $0 turnover declaration would be false: notify turnover instead (--kind=turnover).`);
      let value = o.value ? cents(o.value) : null;
      if (kind === 'APVMA-LEVY') {
        if (value == null && sold) value = Number(sold.value_cents);
        if (value == null) throw Error('Give --value (the leviable value, excluding GST and exports) or record the year\'s sales first');
      }
      if (kind === 'TGA-ACE') value = 0;
      if (await one(db, 'select 1 from declarations where registration_id = $1 and kind = $2 and period_ending = $3', [r.id, kind, period])) throw Error(`${kind} for ${r.ref} and the period ending ${period} is already recorded`);
      return tx(db, async () => {
        const d = await insert(db, 'declarations', { registration_id: r.id, kind, period_ending: period, lodged_on: on, value_cents: value, receipt: optional(o, 'receipt') });
        if (kind === 'TGA-TURNOVER') await update(db, 'registrations', r.id, { ace: false });
        await audit(db, r.id, 'declare', who(), { kind, period, on, value_cents: value });
        return d;
      });
    }
    case 'record-sales': {
      const r = await registrationRow(db, args[0]);
      const fy = isoDate(required(o, 'fy'), '--fy');
      if (!fy.endsWith('-06-30')) throw Error('--fy is the 30 June that ends the financial year');
      if (fy > fyEnding(today())) throw Error('That financial year has not started');
      const value = cents(required(o, 'value'));
      const qty = o.quantity != null ? Number(String(o.quantity).replaceAll(',', '')) : null;
      if (qty != null && !(qty >= 0)) throw Error('--quantity must be a number');
      const currency = (optional(o, 'currency') || (r.country === 'AU' ? 'AUD' : null) || 'AUD').toUpperCase();
      return tx(db, async () => {
        const existing = await one(db, 'select id from sales where registration_id = $1 and fy_ending = $2', [r.id, fy]);
        const row = existing
          ? await update(db, 'sales', existing.id, { value_cents: value, quantity: qty, unit: optional(o, 'unit'), currency })
          : await insert(db, 'sales', { registration_id: r.id, fy_ending: fy, value_cents: value, quantity: qty, unit: optional(o, 'unit'), currency });
        await audit(db, r.id, existing ? 'correct-sales' : 'record-sales', who(), { fy, value_cents: value });
        return row;
      });
    }
    case 'add-fee': {
      const r = await registrationRow(db, args[0]);
      const kind = required(o, 'kind');
      if (!['annual charge', 'levy', 'renewal fee', 'application fee', 'late fee', 'registration charge', 'other'].includes(kind)) throw Error('--kind must be annual charge, levy, renewal fee, application fee, late fee, registration charge or other');
      return tx(db, async () => {
        const f = await insert(db, 'fees', { code: await nextCode(db, 'fees', 'FEE-'), registration_id: r.id, kind, period: optional(o, 'period'), amount_cents: cents(required(o, 'amount')),
          currency: (optional(o, 'currency') || 'AUD').toUpperCase(), due_on: isoDate(required(o, 'due'), '--due'), invoice: optional(o, 'invoice'), note: optional(o, 'note') });
        await audit(db, r.id, 'add-fee', who(), { code: f.code, kind });
        return f;
      });
    }
    case 'pay-fee': {
      const hit = await pick(db, 'fee', args[0]);
      const f = await one(db, 'select * from fees where id = $1', [hit.id]);
      if (f.paid_on) throw Error(`${f.code} was already paid on ${dstr(f.paid_on)}`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The payment date');
      const out = await update(db, 'fees', f.id, { paid_on: on });
      await audit(db, f.registration_id, 'pay-fee', who(), { code: f.code, on });
      return out;
    }
    case 'add-label': {
      const r = await registrationRow(db, args[0]);
      const version = required(o, 'version');
      if (await one(db, 'select 1 from labels where registration_id = $1 and version = $2', [r.id, version])) throw Error(`Label version ${version} is already on file for ${r.ref}`);
      const approved = o.approved ? isoDate(o.approved, '--approved') : null;
      if (approved) notFuture(approved, 'The approval date');
      const l = await insert(db, 'labels', { registration_id: r.id, version, approved_on: approved, note: optional(o, 'note') });
      await audit(db, r.id, 'add-label', who(), { version, approved });
      return l;
    }
    case 'approve-label': {
      const r = await registrationRow(db, args[0]);
      const l = await one(db, 'select * from labels where registration_id = $1 and version = $2', [r.id, required(o, 'version')]);
      if (!l) throw Error(`No label version ${o.version} on file for ${r.ref}`);
      if (l.approved_on) throw Error(`Version ${l.version} was approved on ${dstr(l.approved_on)}`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The approval date');
      const out = await update(db, 'labels', l.id, { approved_on: on });
      await audit(db, r.id, 'approve-label', who(), { version: l.version, on });
      return out;
    }
    case 'label-in-market': {
      const r = await registrationRow(db, args[0]);
      current(r);
      const l = await one(db, 'select * from labels where registration_id = $1 and version = $2', [r.id, required(o, 'version')]);
      if (!l) throw Error(`No label version ${o.version} on file for ${r.ref}. Add it with add-label first.`);
      if (l.in_market_on && !l.retired_on) throw Error(`Version ${l.version} is already on pack`);
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The date it went on pack');
      return tx(db, async () => {
        await db.query('update labels set retired_on = $3 where registration_id = $1 and id <> $2 and in_market_on is not null and retired_on is null', [r.id, l.id, on]);
        const out = await update(db, 'labels', l.id, { in_market_on: on, retired_on: null });
        await audit(db, r.id, 'label-in-market', who(), { version: l.version, on, approved: Boolean(l.approved_on) });
        return { ...out, warning: l.approved_on ? null : `Version ${l.version} is not recorded as approved. It now shows in /attention and /compliance.` };
      });
    }
    case 'add-condition': {
      const r = await registrationRow(db, args[0]);
      const number = required(o, 'number');
      if (await one(db, 'select 1 from conditions where registration_id = $1 and number = $2', [r.id, number])) throw Error(`Condition ${number} is already on ${r.ref}`);
      const c = await insert(db, 'conditions', { registration_id: r.id, number, text: required(o, 'text') });
      await audit(db, r.id, 'add-condition', who(), { number });
      return c;
    }
    case 'add-obligation': {
      const r = o.registration ? await registrationRow(db, required(o, 'registration')) : null;
      return tx(db, async () => {
        const ob = await insert(db, 'obligations', { code: await nextCode(db, 'obligations', 'OB-'), title: required(o, 'title'), registration_id: r?.id ?? null,
          due_on: isoDate(required(o, 'due'), '--due'), owner: optional(o, 'owner') || r?.manager || 'unassigned', note: optional(o, 'note') });
        await audit(db, ob.id, 'add-obligation', who(), { code: ob.code, registration: r?.ref ?? null });
        return ob;
      });
    }
    case 'done': {
      const hit = await pick(db, 'obligation', args[0]);
      const ob = await one(db, 'select * from obligations where id = $1', [hit.id]);
      if (ob.done_on) throw Error(`${ob.code} was done on ${dstr(ob.done_on)}`);
      const on = isoDate(o.on ?? today(), '--on');
      notFuture(on, 'The done date');
      const out = await update(db, 'obligations', ob.id, { done_on: on });
      await audit(db, ob.id, 'done', who(), { code: ob.code, on });
      return out;
    }
    case 'end': {
      const r = await registrationRow(db, args[0]);
      if (!['current', 'application', 'suspended'].includes(r.status)) throw Error(`${r.ref} has already ended (${r.status})`);
      const status = required(o, 'status');
      if (!['cancelled', 'lapsed', 'withdrawn'].includes(status)) throw Error('--status must be cancelled, lapsed or withdrawn');
      const on = isoDate(required(o, 'on'), '--on');
      notFuture(on, 'The end date');
      const out = await update(db, 'registrations', r.id, { status, ended_on: on, note: [r.note, optional(o, 'reason')].filter(Boolean).join(' ') || null });
      await audit(db, r.id, 'end', who(), { status, on, reason: optional(o, 'reason') });
      return out;
    }
    case 'import': return importCsv(db, args, o);
    case 'export': {
      const out = {};
      for (const t of TABLES) out[t] = await db.query(`select * from ${t}`);
      const file = optional(o, 'file') || path.join(outDir(), 'exports', `registrations-${today()}-${randomUUID().slice(0, 8)}.json`);
      writeFile(file, JSON.stringify(out, null, 2));
      return { file: path.resolve(file), tables: Object.fromEntries(TABLES.map((t) => [t, out[t].length])) };
    }
    case 'weekly-review': {
      const attention = await db.query(READS.attention);
      const due = await db.query('select due_on, days_left, label as what, ref, product, manager as owner from open_dates where days_left between 0 and 30 order by due_on, ref');
      const findings = await db.query(READS.compliance);
      const late = attention.filter((x) => x.days_left < 0).length;
      const body = `# Registrations review, week of ${today()}

${late ? `${late} item(s) are late. Start with those.` : 'Nothing is late.'} ${due.length} date(s) fall due in the next 30 days. ${findings.filter((f) => f.severity === 'breach').length} rule breach(es) on file.

## Needs a person

${mdTable(attention.map(({ due_on, ...x }) => ({ ...x, due_on: dstr(due_on) })))}

## Due in the next 30 days

${mdTable(due.map((x) => ({ ...x, due_on: dstr(x.due_on) })))}

## Rule checks

${mdTable(findings)}

Drafted from the register. Nothing has been lodged or paid.
`;
      return { ...draft('weekly-review', body), late, due: due.length };
    }
    case 'draft-renewals': {
      const rows = await db.query(`select c.ref, c.product, c.kind as rule, c.item as detail, c.due_on, c.due_on - current_date as days_left
        from reg_calendar c where c.kind in ('APVMA-RENEWAL','AICIS-RENEWAL','EXPIRY') and c.done_on is null order by c.due_on, c.ref`);
      const fees = await db.query(`select f.code, r.ref, f.kind, f.period, f.currency, f.amount_cents, f.due_on from fees f join registrations r on r.id = f.registration_id
        where f.paid_on is null and f.kind in ('renewal fee','registration charge','late fee') order by f.due_on`);
      const body = `# Renewals due, drafted ${today()}

Every renewal in the next 120 days, and any that are already late. APVMA renewals are due one month before the registration ends on 30 June; after that a late renewal needs the APVMA's agreement and a late fee per product, and a product not renewed by 30 June is de-registered. AICIS business registration renews by 31 August.

${mdTable(rows.map((x) => ({ ...x, due_on: dstr(x.due_on) })))}

## Renewal fees on file

${mdTable(fees.map((x) => ({ ...x, due_on: dstr(x.due_on) })))}

For the person lodging: renew each item through the regulator's portal, then record it here with renew and the receipt.
`;
      return { ...draft('renewals', body), items: rows.length };
    }
    case 'draft-levy': {
      const [{ fy }] = await db.query('select last_fy_end(current_date)::text as fy');
      const rows = await db.query(`select r.ref, p.name as product, h.code as holder, s.value_cents as leviable_value_cents, s.quantity, s.unit,
          (select d.lodged_on from declarations d where d.registration_id = r.id and d.kind = 'APVMA-LEVY' and d.period_ending = $1) as value_declared,
          (select d.lodged_on from declarations d where d.registration_id = r.id and d.kind = 'APVMA-RETURN' and d.period_ending = $1) as return_lodged
        from registrations r join holders h on h.id = r.holder_id left join products p on p.id = r.product_id
        left join sales s on s.registration_id = r.id and s.fy_ending = $1
        where r.regulator = 'APVMA' and r.granted_on <= $1 and (r.ended_on is null or r.ended_on > ($1::date - 365)) order by h.code, r.ref`, [fy]);
      const missing = rows.filter((x) => x.leviable_value_cents == null).map((x) => x.ref);
      const body = `# APVMA levy and annual return working paper, year ending ${fy}

Leviable value is the value of sales of each product for the year, excluding GST and generally excluding exports, declared by 31 October. The annual return of quantities goes in before 30 November. The levy is payable by 15 January.

${mdTable(rows.map((x) => ({ ...x, value_declared: dstr(x.value_declared), return_lodged: dstr(x.return_lodged) })))}

${missing.length ? `Sales not recorded yet for: ${missing.join(', ')}. Record them with record-sales before declaring.` : 'Sales are recorded for every product.'}

Check each value against the accounts before it is declared. Nothing here has been lodged.
`;
      return { ...draft(`apvma-levy-${fy}`, body), products: rows.length, missing };
    }
    case 'draft-ace': {
      const [{ fy }] = await db.query('select last_fy_end(current_date)::text as fy');
      const rows = await db.query(READS.ace);
      const declare = rows.filter((x) => x.state === 'no turnover' && !x.declared_on);
      const notify = rows.filter((x) => x.state !== 'no turnover');
      const body = `# TGA annual charge exemption, year ending ${fy}

$0 turnover declarations are made in TGA Business Services between 1 and 22 July. A late declaration with a fee is possible until 15 September, and that date cannot be extended. An entry that sold must not be declared at $0: notify the TGA that turnover has started.

## Declare $0 turnover

${mdTable(declare.map((x) => ({ ref: x.ref, product: x.product, granted_on: dstr(x.granted_on) })))}

## Notify turnover (do not declare $0)

${mdTable(notify.map((x) => ({ ref: x.ref, product: x.product, sales_last_fy_cents: x.sales_last_fy_cents })))}

## Already declared

${mdTable(rows.filter((x) => x.declared_on).map((x) => ({ ref: x.ref, product: x.product, declared_on: dstr(x.declared_on) })))}
`;
      return { ...draft(`tga-ace-${fy}`, body), declare: declare.length, notify: notify.length };
    }
    case 'draft-aicis': {
      const [{ ay, fy }] = await db.query('select aicis_year_end(current_date)::text as ay, last_fy_end(current_date)::text as fy');
      const rows = await db.query(`select r.ref, h.name as holder, r.level, r.expires_on,
          (select s.value_cents from sales s where s.registration_id = r.id and s.fy_ending = $2) as value_introduced_last_fy_cents,
          (select d.lodged_on from declarations d where d.registration_id = r.id and d.kind = 'AICIS-DECL' and d.period_ending = $1) as declared_on
        from registrations r join holders h on h.id = r.holder_id where r.regulator = 'AICIS' and r.status = 'current' order by r.ref`, [ay, fy]);
      const body = `# AICIS annual declaration working paper, registration year ending ${ay}

Every registered introducer submits an annual declaration by 30 November for the registration year that ended on 31 August. It must be submitted by the business itself; an agent cannot do it. Keep the records behind it for at least 5 years.

${mdTable(rows.map((x) => ({ ...x, expires_on: dstr(x.expires_on), declared_on: dstr(x.declared_on) })))}

Before submitting, confirm which introduction categories applied during the year from your import and manufacturing records. Nothing here has been submitted.
`;
      return { ...draft(`aicis-declaration-${ay}`, body), registrations: rows.length };
    }
    case 'draft-submission': {
      const hit = await pick(db, 'submission', args[0]);
      const s = await one(db, 'select * from submissions where id = $1', [hit.id]);
      const r = await one(db, 'select ref from registrations where id = $1', [s.registration_id]);
      const reg = await run(db, 'registration', [r.ref]);
      const body = `# ${s.code}: ${s.title}

${s.kind} for ${r.ref}, lodged ${dstr(s.lodged_on)}${s.regulator_ref ? ` (regulator reference ${s.regulator_ref})` : ''}. Outcome: ${s.outcome}${s.decided_on ? ` on ${dstr(s.decided_on)}` : ''}.

${reg.sections.filter((x) => ['Conditions', 'Labels', 'Submissions', 'Dates'].includes(x.title) || x.title === r.ref)
    .map((x) => `## ${x.title}\n\n${mdTable(x.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? dstr(v) : v]))))}`).join('\n\n')}

The record behind the submission, drafted from the register. The dossier itself lives with your regulatory documents.
`;
      return { ...draft(`${s.code}-${s.kind}`, body), submission: s.code };
    }
    default: throw Error(`Unknown command: ${cmd}`);
  }
}
