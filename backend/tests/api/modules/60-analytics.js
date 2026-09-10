/**
 * Group "analytics" — /api/user-stock/analytics/* and /api/user-stock/reports/*
 * Read-only endpoints: the contract under test is the shared window parser
 * (utils/period.ts parseWindow) plus the `days` param on inactive-customers.
 */
const B = '/api/user-stock';

const ANALYTICS = [
  'analytics/products',
  'analytics/channels',
  'analytics/agents',
  'analytics/orders',
  'analytics/conversations',
  'analytics/responses',
  'analytics/consumption',
];

// Reports that go through parseWindow (accept period/startDate/endDate).
const WINDOWED_REPORTS = [
  'reports/profit-loss',
  'reports/cash-flow',
  'reports/cash-register',
  'reports/payments',
  'reports/expenses',
  'reports/tax-summary',
  'reports/discounts',
  'reports/sales',
  'reports/sales-by-category',
  'reports/top-products',
  'reports/return-ratio',
  'reports/purchases',
  'reports/product-purchases',
  'reports/suppliers',
  'reports/top-suppliers',
  'reports/dead-stock',
  'reports/stock-adjustments',
  'reports/top-customers',
];

// Reports with no period at all (the web client sends a bare URL).
const PLAIN_REPORTS = [
  'reports/inventory-valuation',
  'reports/stock-alerts',
  'reports/stock-aging',
  'reports/products',
];

const ALL_PATHS = [
  ...ANALYTICS,
  ...WINDOWED_REPORTS,
  ...PLAIN_REPORTS,
  'reports/inactive-customers',
];

const VALID_PERIODS = ['today', 'week', 'month', 'year'];
// Presets the web client normalises the echoed `period` to.
const ECHOED = { today: 'today', week: 'week', month: 'month', year: 'year', custom: 'month' };

const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const daysAgo = (n) => ymd(Date.now() - n * 86400000);

module.exports = async (t) => {
  // ---------------------------------------------------------------------
  // 1. 401 with no token — every endpoint.
  // ---------------------------------------------------------------------
  for (const p of ALL_PATHS) {
    await t.check(`401 no token — ${p}`, {
      path: `${B}/${p}`,
      token: null,
      expect: { status: 401 },
    });
  }

  // ---------------------------------------------------------------------
  // 2. period enum — invalid value must be rejected on EVERY windowed endpoint.
  // ---------------------------------------------------------------------
  for (const p of [...ANALYTICS, ...WINDOWED_REPORTS]) {
    await t.check(`period=bogus → 400 — ${p}`, {
      path: `${B}/${p}?period=quarter`,
      auth: true,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'period', fieldCode: 'FIELD_INVALID_ENUM' },
    });
  }
  // Non-string / array-shaped period (?period=a&period=b → express gives an array).
  await t.check('period repeated (array) → 400', {
    path: `${B}/analytics/products?period=week&period=month`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'period', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  // Empty period must be tolerated (defaults to month) — URLSearchParams can emit it.
  await t.ok('period= (blank) → 200 default month', {
    path: `${B}/analytics/products?period=`,
    auth: true,
  });

  // ---------------------------------------------------------------------
  // 3. Custom range validation (exercised on a representative sample).
  // ---------------------------------------------------------------------
  const SAMPLE = ['analytics/products', 'analytics/conversations', 'reports/profit-loss', 'reports/top-customers'];

  for (const p of SAMPLE) {
    await t.check(`period=custom without dates → 400 — ${p}`, {
      path: `${B}/${p}?period=custom`,
      auth: true,
      expect: { status: 400, code: 'ANALYTICS_CUSTOM_RANGE_REQUIRED', noFields: true },
    });
    await t.check(`startDate alone → 400 endDate required — ${p}`, {
      path: `${B}/${p}?startDate=2026-01-01`,
      auth: true,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'endDate', fieldCode: 'FIELD_REQUIRED' },
    });
    await t.check(`endDate alone → 400 startDate required — ${p}`, {
      path: `${B}/${p}?endDate=2026-01-01`,
      auth: true,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_REQUIRED' },
    });
    await t.check(`unparseable dates → 400 — ${p}`, {
      path: `${B}/${p}?period=custom&startDate=not-a-date&endDate=also-bad`,
      auth: true,
      expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE', minFields: 2 },
    });
    await t.check(`start > end → 400 INVALID_DATE_RANGE — ${p}`, {
      path: `${B}/${p}?period=custom&startDate=2026-06-01&endDate=2026-01-01`,
      auth: true,
      expect: { status: 400, code: 'INVALID_DATE_RANGE', noFields: true },
    });
    await t.check(`range > 2 years → 400 — ${p}`, {
      path: `${B}/${p}?period=custom&startDate=2019-01-01&endDate=2026-01-01`,
      auth: true,
      expect: { status: 400, code: 'ANALYTICS_RANGE_TOO_LONG', noFields: true },
    });
  }

  // Impossible calendar dates must be rejected, not rolled over by JS.
  await t.check('rolled-over date 2026-02-30 → 400', {
    path: `${B}/analytics/products?period=custom&startDate=2026-02-30&endDate=2026-03-01`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('month 13 → 400', {
    path: `${B}/reports/sales?period=custom&startDate=2026-13-01&endDate=2026-13-05`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  // Exactly at the 2-year limit must still be accepted.
  await t.ok('range at the 2-year limit → 200', {
    path: `${B}/reports/profit-loss?period=custom&startDate=${daysAgo(730)}&endDate=${ymd(Date.now())}`,
    auth: true,
  });

  // ---------------------------------------------------------------------
  // 4. Every valid preset → 200 with the echoed `period` the web app expects.
  // ---------------------------------------------------------------------
  const windowed = [...ANALYTICS, ...WINDOWED_REPORTS];
  for (const p of windowed) {
    for (const period of VALID_PERIODS) {
      const r = await t.ok(`${p} — period=${period} → 200`, {
        path: `${B}/${p}?period=${period}`,
        auth: true,
      });
      if (r && r.status === 200 && r.json && 'period' in r.json && r.json.period !== ECHOED[period]) {
        t.results.push({
          label: `${t.currentModule} › ${p} echoes period=${period}`,
          ok: false,
          issues: [`echoed period "${r.json.period}" ≠ "${ECHOED[period]}"`],
        });
      }
    }
  }

  // Valid custom range on every windowed endpoint, incl. the echoed period.
  const cStart = daysAgo(30);
  const cEnd = ymd(Date.now());
  for (const p of windowed) {
    const r = await t.ok(`${p} — valid custom range → 200`, {
      path: `${B}/${p}?period=custom&startDate=${cStart}&endDate=${cEnd}`,
      auth: true,
    });
    if (r && r.status === 200 && r.json && 'period' in r.json && r.json.period !== 'month') {
      t.results.push({
        label: `${t.currentModule} › ${p} echoes period for custom`,
        ok: false,
        issues: [`custom range echoed period "${r.json.period}" ≠ "month" (web type is today|week|month|year)`],
      });
    }
  }

  // A long custom range (> 92 days) switches the bucket to monthly — must not blow up.
  for (const p of ['analytics/orders', 'analytics/conversations', 'reports/cash-flow', 'reports/sales']) {
    await t.ok(`${p} — 200-day custom range (monthly buckets) → 200`, {
      path: `${B}/${p}?period=custom&startDate=${daysAgo(200)}&endDate=${cEnd}`,
      auth: true,
    });
  }
  // Single-day range (start == end).
  await t.ok('single-day custom range → 200', {
    path: `${B}/reports/sales?period=custom&startDate=${cEnd}&endDate=${cEnd}`,
    auth: true,
  });
  // ISO timestamps (not just YYYY-MM-DD) must parse.
  await t.ok('ISO timestamp range → 200', {
    path: `${B}/reports/sales?period=custom&startDate=${encodeURIComponent(new Date(Date.now() - 5 * 86400000).toISOString())}&endDate=${encodeURIComponent(new Date().toISOString())}`,
    auth: true,
  });

  // ---------------------------------------------------------------------
  // 5. Period-less reports → 200 with and without stray params.
  // ---------------------------------------------------------------------
  for (const p of PLAIN_REPORTS) {
    await t.ok(`${p} — bare URL → 200`, { path: `${B}/${p}`, auth: true });
    // A stray period must never break a period-less report.
    await t.ok(`${p} — with stray period=year → 200`, { path: `${B}/${p}?period=year`, auth: true });
  }

  // ---------------------------------------------------------------------
  // 6. inactive-customers `days`.
  // ---------------------------------------------------------------------
  await t.check('inactive-customers days=abc → 400', {
    path: `${B}/reports/inactive-customers?days=abc`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'days', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('inactive-customers days=0 → 400', {
    path: `${B}/reports/inactive-customers?days=0`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'days' },
  });
  await t.check('inactive-customers days=-30 → 400', {
    path: `${B}/reports/inactive-customers?days=-30`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'days' },
  });
  await t.check('inactive-customers days=5000 → 400', {
    path: `${B}/reports/inactive-customers?days=5000`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'days' },
  });
  await t.check('inactive-customers days=30.5 → 400 (not an integer)', {
    path: `${B}/reports/inactive-customers?days=30.5`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'days', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  // Every threshold the web dashboard offers.
  for (const d of [30, 60, 90]) {
    const r = await t.ok(`inactive-customers days=${d} → 200`, {
      path: `${B}/reports/inactive-customers?days=${d}`,
      auth: true,
    });
    if (r && r.status === 200 && r.json && r.json.thresholdDays !== d) {
      t.results.push({
        label: `${t.currentModule} › inactive-customers echoes thresholdDays=${d}`,
        ok: false,
        issues: [`thresholdDays ${r.json.thresholdDays} ≠ ${d}`],
      });
    }
  }
  await t.ok('inactive-customers days=3650 (max) → 200', {
    path: `${B}/reports/inactive-customers?days=3650`,
    auth: true,
  });
  await t.ok('inactive-customers no days → 200 (default 60)', {
    path: `${B}/reports/inactive-customers`,
    auth: true,
  });

  await t.ok('inactive-customers days= (blank) → 200 default', {
    path: `${B}/reports/inactive-customers?days=`,
    auth: true,
  });
  await t.check('inactive-customers days=1e5 → 400', {
    path: `${B}/reports/inactive-customers?days=1e5`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'days', fieldCode: 'FIELD_OUT_OF_RANGE' },
  });

  // ---------------------------------------------------------------------
  // 6b. Mixed shapes: dates + an explicit preset, and a bracketed param name.
  // ---------------------------------------------------------------------
  await t.ok('dates + period=today → 200 (range wins, period echoed)', {
    path: `${B}/reports/sales?period=today&startDate=${cStart}&endDate=${cEnd}`,
    auth: true,
  });
  await t.check('startDate[]=… → endDate alone → 400', {
    path: `${B}/analytics/products?startDate[]=2026-01-01&endDate=2026-01-02`,
    auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_REQUIRED' },
  });

  // ---------------------------------------------------------------------
  // 7. Empty account — every endpoint must answer a well-formed 200, not 500.
  // ---------------------------------------------------------------------
  for (const p of ALL_PATHS) {
    const r = await t.ok(`empty account — ${p} → 200`, {
      path: `${B}/${p}`,
      token: t.tokens.other,
    });
    if (r && r.status === 200) {
      const j = r.json;
      if (!j || typeof j !== 'object' || Array.isArray(j)) {
        t.results.push({
          label: `${t.currentModule} › empty account body shape — ${p}`,
          ok: false,
          issues: [`expected a JSON object, got ${JSON.stringify(j)?.slice(0, 120)}`],
        });
      } else {
        // No NaN / null numeric totals may leak into the dashboard.
        const bad = JSON.stringify(j).includes('null,"NaN"') || /:NaN/.test(JSON.stringify(j));
        if (bad) {
          t.results.push({
            label: `${t.currentModule} › empty account has NaN — ${p}`,
            ok: false,
            issues: ['response contains NaN'],
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // 8. Cross-tenant: the seeded account's data must never leak to `other`.
  //    The invariant is "never sees OUR rows" — not "sees nothing": other
  //    modules legitimately give the second merchant sales of their own.
  // ---------------------------------------------------------------------
  const mine = await t.ok('top-products for the seeded account', {
    path: `${B}/reports/top-products?period=year`, auth: true,
  });
  const theirs = await t.ok('top-products for the second merchant', {
    path: `${B}/reports/top-products?period=year`, token: t.tokens.other,
  });
  const ids = (r) => (Array.isArray(r?.json?.products) ? r.json.products.map((p) => p.id ?? p.productId).filter(Boolean) : []);
  const mineIds = new Set(ids(mine));
  const overlap = ids(theirs).filter((id) => mineIds.has(id));
  t.results.push({
    label: `${t.currentModule} › cross-tenant: second merchant never sees our products`,
    ok: overlap.length === 0,
    issues: overlap.length === 0 ? [] : [`LEAK: foreign report contains our product ids ${overlap.join(', ')}`],
  });

  // ---------------------------------------------------------------------
  // 9. Translations — 5 codes × ar / fr.
  // ---------------------------------------------------------------------
  const I18N = [
    ['FIELD_INVALID_ENUM/period', `${B}/analytics/products?period=quarter`, { status: 400, code: 'VALIDATION_FAILED', field: 'period' }],
    ['ANALYTICS_CUSTOM_RANGE_REQUIRED', `${B}/reports/profit-loss?period=custom`, { status: 400, code: 'ANALYTICS_CUSTOM_RANGE_REQUIRED' }],
    ['INVALID_DATE_RANGE', `${B}/reports/sales?startDate=2026-06-01&endDate=2026-01-01`, { status: 400, code: 'INVALID_DATE_RANGE' }],
    ['ANALYTICS_RANGE_TOO_LONG', `${B}/reports/sales?startDate=2019-01-01&endDate=2026-01-01`, { status: 400, code: 'ANALYTICS_RANGE_TOO_LONG' }],
    ['FIELD_INVALID_DATE', `${B}/analytics/orders?startDate=zzz&endDate=zzz`, { status: 400, code: 'VALIDATION_FAILED', field: 'startDate' }],
    ['FIELD_OUT_OF_RANGE/days', `${B}/reports/inactive-customers?days=99999`, { status: 400, code: 'VALIDATION_FAILED', field: 'days' }],
    ['UNAUTHORIZED', `${B}/reports/sales`, { status: 401 }],
  ];
  for (const [label, path, expect] of I18N) {
    for (const lang of ['ar', 'fr']) {
      await t.check(`${lang} — ${label}`, {
        path,
        auth: expect.status === 401 ? undefined : true,
        token: expect.status === 401 ? null : undefined,
        lang,
        expect,
      });
    }
  }
  // French messages must not be the English string (spot-check on two codes).
  const frA = await t.raw({ path: `${B}/reports/profit-loss?period=custom`, auth: true, lang: 'fr' });
  const enA = await t.raw({ path: `${B}/reports/profit-loss?period=custom`, auth: true, lang: 'en' });
  if (frA.json?.message && frA.json.message === enA.json?.message) {
    t.results.push({
      label: `${t.currentModule} › fr translation of ANALYTICS_CUSTOM_RANGE_REQUIRED`,
      ok: false,
      issues: [`fr message identical to en: ${frA.json.message}`],
    });
  } else {
    t.results.push({ label: `${t.currentModule} › fr translation of ANALYTICS_CUSTOM_RANGE_REQUIRED`, ok: true, issues: [] });
  }
  // Interpolation must be resolved, not left as {maxYears}.
  const interp = await t.raw({ path: `${B}/reports/sales?startDate=2019-01-01&endDate=2026-01-01`, auth: true, lang: 'fr' });
  const hasPlaceholder = typeof interp.json?.message === 'string' && /\{\w+\}/.test(interp.json.message);
  t.results.push({
    label: `${t.currentModule} › ANALYTICS_RANGE_TOO_LONG interpolates {maxYears}`,
    ok: !hasPlaceholder,
    issues: hasPlaceholder ? [`unresolved placeholder in: ${interp.json.message}`] : [],
  });

  // ---------------------------------------------------------------------
  // 10. WEB CONTRACT sweep — every query string the dashboard can produce.
  //     analytics-api / ai-analytics-api / reports-api all build
  //     `period=<preset|custom>[&startDate&endDate]`.
  // ---------------------------------------------------------------------
  for (const p of windowed) {
    // The exact shape the client sends for a custom range (period=custom + both dates).
    await t.ok(`web contract — ${p}?period=custom&startDate&endDate`, {
      path: `${B}/${p}?period=custom&startDate=${cStart}&endDate=${cEnd}`,
      auth: true,
    });
  }
};
