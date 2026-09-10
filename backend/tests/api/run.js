/**
 * Runner: seeds a fresh account + fixtures, then executes every test module.
 * Usage: node run.js [module ...]   (default: all modules in ./modules)
 */
const fs = require('fs');
const path = require('path');
const { Harness, BASE } = require('./harness');

const MODULES_DIR = path.join(__dirname, 'modules');

async function seed(t) {
  t.currentModule = 'seed';
  const stamp = Date.now();
  const email = `apitest_${stamp}@djaber.test`;
  const password = 'Password123!';

  const reg = await t.ok('register test user', {
    method: 'POST', path: '/api/auth/register',
    body: { email, password, firstName: 'Api', lastName: 'Test' },
    expect: { status: 201 },
  });
  if (!reg || !reg.json?.token) throw new Error(`seed failed: cannot register (${reg?.status} ${JSON.stringify(reg?.json)?.slice(0, 300)})`);
  t.tokens.user = reg.json.token;
  t.ctx.userId = reg.json.user?.id;
  t.ctx.email = email;
  t.ctx.password = password;

  // Second user — used to prove cross-tenant isolation (404 on foreign ids).
  const other = await t.ok('register second user', {
    method: 'POST', path: '/api/auth/register',
    body: { email: `apitest_other_${stamp}@djaber.test`, password, firstName: 'Other', lastName: 'User' },
    expect: { status: 201 },
  });
  t.tokens.other = other?.json?.token;

  const post = async (label, p, body) => {
    const r = await t.ok(label, { method: 'POST', path: p, auth: true, body });
    return r?.json;
  };

  const cat = await post('seed category', '/api/user-stock/categories', { name: `Cat ${stamp}` });
  t.ctx.categoryId = cat?.category?.id ?? cat?.id;

  const sup = await post('seed supplier', '/api/user-stock/suppliers', { name: `Sup ${stamp}`, phone: '0550123456' });
  t.ctx.supplierId = sup?.supplier?.id ?? sup?.id;

  const unit = await post('seed unit', '/api/user-stock/units', { name: `Unit ${stamp}`, abbreviation: 'ut' });
  t.ctx.unitId = unit?.unit?.id ?? unit?.id;

  const prod = await post('seed product', '/api/user-stock/products', {
    name: `Prod ${stamp}`, sku: `SKU-${stamp}`, costPrice: 100, sellingPrice: 200, quantity: 50,
    categoryId: t.ctx.categoryId,
  });
  t.ctx.productId = prod?.product?.id ?? prod?.id;

  const prodV = await post('seed product with variants', '/api/user-stock/products', {
    name: `ProdVar ${stamp}`, sku: `SKUV-${stamp}`, costPrice: 100, sellingPrice: 200, quantity: 0, hasVariants: true,
  });
  t.ctx.variantProductId = prodV?.product?.id ?? prodV?.id;
  if (t.ctx.variantProductId) {
    const v = await post('seed variant', `/api/user-stock/products/${t.ctx.variantProductId}/variants`, {
      name: 'Rouge - M', sku: `SKUV-${stamp}-R`, costPrice: 100, sellingPrice: 200, quantity: 20,
    });
    t.ctx.variantId = v?.variant?.id ?? v?.id;
  }

  const client = await post('seed client', '/api/user-stock/clients', { name: `Client ${stamp}`, phone: `05${String(stamp).slice(-8)}` });
  t.ctx.clientId = client?.client?.id ?? client?.id;

  const agent = await post('seed agent', '/api/user-stock/agents', { name: `Agent ${stamp}`, personality: 'professional' });
  t.ctx.agentId = agent?.agent?.id ?? agent?.id;

  const order = await post('seed order', '/api/user-stock/orders', {
    clientName: 'Test Client', clientPhone: '0550123456',
    items: [{ productId: t.ctx.productId, quantity: 1, unitPrice: 200 }],
  });
  t.ctx.orderId = order?.order?.id ?? order?.id;

  const sale = await post('seed sale', '/api/user-stock/sales', {
    items: [{ productId: t.ctx.productId, quantity: 1, unitPrice: 200 }],
  });
  t.ctx.saleId = sale?.sale?.id ?? sale?.id;

  const purchase = await post('seed purchase', '/api/user-stock/purchases', {
    supplierId: t.ctx.supplierId,
    items: [{ productId: t.ctx.productId, quantity: 5, unitCost: 90 }],
  });
  t.ctx.purchaseId = purchase?.purchase?.id ?? purchase?.id;

  const caisse = await post('seed caisse entry', '/api/user-stock/caisse', {
    type: 'expense', amount: 500, category: 'other', description: 'test',
  });
  t.ctx.caisseId = caisse?.transaction?.id ?? caisse?.id;

  // A foreign product (owned by the second user) to test ownership checks.
  if (t.tokens.other) {
    const foreign = await t.ok('seed foreign product', {
      method: 'POST', path: '/api/user-stock/products', token: t.tokens.other,
      body: { name: 'Foreign', sku: `FSKU-${stamp}`, costPrice: 10, sellingPrice: 20, quantity: 5 },
    });
    t.ctx.foreignProductId = foreign?.json?.product?.id ?? foreign?.json?.id;
    const foreignClient = await t.ok('seed foreign client', {
      method: 'POST', path: '/api/user-stock/clients', token: t.tokens.other,
      body: { name: 'Foreign Client', phone: `06${String(stamp).slice(-8)}` },
    });
    t.ctx.foreignClientId = foreignClient?.json?.client?.id ?? foreignClient?.json?.id;
  }

  // Admin token: register a normal user, then flip isAdmin directly in the DB.
  const adminEmail = `apitest_admin_${stamp}@djaber.test`;
  const admin = await t.ok('register admin user', {
    method: 'POST', path: '/api/auth/register',
    body: { email: adminEmail, password, firstName: 'Adm', lastName: 'In' },
    expect: { status: 201 },
  });
  if (admin?.json?.token) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.user.update({ where: { email: adminEmail }, data: { isAdmin: true } });
      await prisma.$disconnect();
      t.tokens.admin = admin.json.token;
      t.ctx.adminUserId = admin.json.user?.id;
    } catch (err) {
      t.results.push({ label: 'seed › promote admin', ok: false, issues: [`cannot promote admin: ${err.message}`] });
    }
  }

  t.ctx.missingId = '00000000-0000-4000-8000-000000000000';
  return t.ctx;
}

(async () => {
  const t = new Harness();
  console.log(`base: ${BASE}`);

  // Wait for the server.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }

  await seed(t);
  const seedFailures = t.summary().failed;
  if (seedFailures > 0) {
    console.log('SEED PROBLEMS:');
    for (const f of t.summary().failures) console.log(' -', f.label, f.issues.join('; '));
  }
  console.log('seeded ctx:', JSON.stringify(t.ctx));

  const only = process.argv.slice(2);
  const files = fs.existsSync(MODULES_DIR)
    ? fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith('.js')).filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
    : [];

  for (const file of files.sort()) {
    const mod = require(path.join(MODULES_DIR, file));
    t.currentModule = file.replace(/\.js$/, '');
    const before = t.results.length;
    try {
      await mod(t);
    } catch (err) {
      t.results.push({ label: `${t.currentModule} › MODULE CRASHED`, ok: false, issues: [err.stack?.slice(0, 500) || String(err)] });
    }
    console.log(`${t.currentModule}: ${t.results.length - before} checks`);
  }

  const s = t.summary();
  console.log(`\n=== ${s.passed}/${s.total} passed, ${s.failed} failed ===`);
  const tag = only.length > 0 ? only.join('_').replace(/[^\w.-]/g, '') : 'all';
  const out = path.join(__dirname, `results-${tag}.json`);
  fs.writeFileSync(out, JSON.stringify({ summary: { total: s.total, passed: s.passed, failed: s.failed }, ctx: t.ctx, results: t.results }, null, 1));
  for (const f of s.failures) {
    console.log(`FAIL ${f.label}`);
    for (const i of f.issues) console.log(`     ${i}`);
    if (f.opts) console.log(`     → ${f.opts.method || 'GET'} ${f.opts.path}${f.opts.body ? ' ' + JSON.stringify(f.opts.body).slice(0, 160) : ''}`);
  }
  console.log(`\nfull results: ${out}`);
})().catch((e) => { console.error('RUNNER CRASH', e); process.exit(1); });
