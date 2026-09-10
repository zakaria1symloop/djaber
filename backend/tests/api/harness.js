/**
 * API validation test harness for the Djaber backend.
 *
 * Every test asserts the FULL error contract:
 *   - HTTP status
 *   - `code` (stable machine key)
 *   - `message` non-empty AND actually translated for the requested language
 *   - `fields[]` entries for validation failures (field name + optional code)
 *
 * Usage from a module file:
 *   module.exports = async (t) => {
 *     await t.check('products — name missing', {
 *       method: 'POST', path: '/api/user-stock/products', auth: true, lang: 'fr',
 *       body: { sku: 'X', costPrice: 1, sellingPrice: 2, quantity: 1 },
 *       expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name' },
 *     });
 *   };
 */
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:6199';

const ARABIC_RE = /[؀-ۿ]/;
// Words that must never appear in a user-facing message (leaked internals).
const LEAK_RE = /(prisma|PrismaClient|invalid `prisma|at Object\.|node_modules|SELECT |INSERT |stack|ECONNREFUSED|Unknown argument|Argument `)/i;

class Harness {
  constructor() {
    this.results = [];
    this.ctx = {};       // seeded ids shared between modules
    this.tokens = {};    // { user, admin }
    this.currentModule = '(none)';
  }

  async raw(opts) {
    const { method = 'GET', path, body, lang, auth, token, headers = {}, form } = opts;
    const url = `${BASE}${path}`;
    const h = { ...headers };
    if (lang) h['Accept-Language'] = lang;
    const t = token !== undefined ? token : auth === 'admin' ? this.tokens.admin : auth ? this.tokens.user : null;
    if (t) h['Authorization'] = `Bearer ${t}`;
    let payload;
    if (form) {
      payload = form; // FormData — let fetch set the boundary
    } else if (body !== undefined) {
      h['Content-Type'] = h['Content-Type'] || 'application/json';
      payload = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers: h, body: payload });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }

  /** Run one expectation. `expect`: { status, code, field, fieldCode, minFields, noFields, skipTranslationCheck } */
  async check(name, opts) {
    const label = `${this.currentModule} › ${name}`;
    let r;
    try {
      r = await this.raw(opts);
    } catch (err) {
      this.results.push({ label, ok: false, issues: [`request failed: ${err.message}`], opts });
      return null;
    }
    const e = opts.expect || {};
    const issues = [];
    const j = r.json;

    if (e.status !== undefined && r.status !== e.status) {
      issues.push(`status ${r.status} ≠ expected ${e.status}${j?.code ? ` (code ${j.code})` : ''}`);
    }

    const isError = r.status >= 400;
    if (isError) {
      if (!j) {
        issues.push(`error body is not JSON: ${r.text.slice(0, 120)}`);
      } else {
        if (!j.code) issues.push('missing `code` in error body');
        if (!j.message) issues.push('missing `message` in error body');
        if (!j.error) issues.push('missing legacy `error` label');
        if (e.code && j.code !== e.code) issues.push(`code ${j.code} ≠ expected ${e.code}`);
        if (typeof j.message === 'string') {
          if (LEAK_RE.test(j.message)) issues.push(`message leaks internals: ${j.message.slice(0, 140)}`);
          if (/^[A-Z0-9_]+$/.test(j.message)) issues.push(`message is a raw code, not a sentence: ${j.message}`);
        }
        // Language check: an Arabic request must come back in Arabic.
        if (!e.skipTranslationCheck && opts.lang && opts.lang.startsWith('ar') && typeof j.message === 'string' && !ARABIC_RE.test(j.message)) {
          issues.push(`message not translated to ar: ${j.message.slice(0, 120)}`);
        }
        if (e.field) {
          const fields = Array.isArray(j.fields) ? j.fields : [];
          const hit = fields.find((f) => f.field === e.field);
          if (!hit) issues.push(`fields[] has no entry for "${e.field}" (got: ${fields.map((f) => f.field).join(', ') || 'none'})`);
          else {
            if (e.fieldCode && hit.code !== e.fieldCode) issues.push(`field "${e.field}" code ${hit.code} ≠ expected ${e.fieldCode}`);
            if (!hit.message) issues.push(`field "${e.field}" has no message`);
            if (opts.lang && opts.lang.startsWith('ar') && hit.message && !ARABIC_RE.test(hit.message)) issues.push(`field "${e.field}" message not translated to ar`);
          }
        }
        if (e.minFields && (!Array.isArray(j.fields) || j.fields.length < e.minFields)) {
          issues.push(`expected ≥ ${e.minFields} field errors, got ${Array.isArray(j.fields) ? j.fields.length : 0}`);
        }
        if (e.noFields && Array.isArray(j.fields) && j.fields.length > 0) {
          issues.push(`unexpected fields[] on a non-validation error`);
        }
      }
    }

    this.results.push({ label, ok: issues.length === 0, issues, status: r.status, code: j?.code, message: j?.message, opts });
    return r;
  }

  /** Assert a call SUCCEEDS (2xx) — used for seeding and for happy-path regressions. */
  async ok(name, opts) {
    const label = `${this.currentModule} › ${name}`;
    let r;
    try {
      r = await this.raw(opts);
    } catch (err) {
      this.results.push({ label, ok: false, issues: [`request failed: ${err.message}`], opts });
      return null;
    }
    const issues = [];
    const expected = opts.expect?.status;
    if (expected ? r.status !== expected : !(r.status >= 200 && r.status < 300)) {
      issues.push(`expected ${expected || '2xx'}, got ${r.status}: ${JSON.stringify(r.json)?.slice(0, 200)}`);
    }
    this.results.push({ label, ok: issues.length === 0, issues, status: r.status, opts });
    return r;
  }

  summary() {
    const failed = this.results.filter((r) => !r.ok);
    return { total: this.results.length, failed: failed.length, passed: this.results.length - failed.length, failures: failed };
  }
}

module.exports = { Harness, BASE };
