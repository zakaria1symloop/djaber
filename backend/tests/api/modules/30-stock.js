/**
 * Group "stock" — /api/user-stock: dashboard, units, categories, products,
 * stock adjustments, movements, images, expenses, margins, variants, suppliers.
 */

// --- spreadsheet helpers (bulk product import) -----------------------------
// CSV is a valid spreadsheet for the import endpoint, and building one needs no
// dependency — the endpoint parses .xlsx and .csv through the same reader.
function csvForm(csv, name = 'products.csv', type = 'text/csv') {
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type }), name);
  return fd;
}

// A tiny but valid 1x1 PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngBytes = () => Uint8Array.from(Buffer.from(PNG_B64, 'base64'));

function imageForm(field = 'images', name = 'pic.png', type = 'image/png', bytes = pngBytes()) {
  const fd = new FormData();
  fd.append(field, new Blob([bytes], { type }), name);
  return fd;
}

module.exports = async (t) => {
  const S = Date.now().toString().slice(-8);
  const P = '/api/user-stock';
  const missing = t.ctx.missingId;
  const other = t.tokens.other;

  // ---------------------------------------------------------------- fixtures
  const mk = async (label, path, body, token) => {
    const r = await t.ok(label, { method: 'POST', path, body, ...(token ? { token } : { auth: true }) });
    return r?.json ?? {};
  };

  // Foreign fixtures (second merchant) — used for cross-tenant 404 proofs.
  const fCat = (await mk('fixture: foreign category', `${P}/categories`, { name: `FCat ${S}` }, other)).category;
  const fUnit = (await mk('fixture: foreign unit', `${P}/units`, { name: `FUnit ${S}`, abbreviation: `fu${S}` }, other)).unit;
  const fSup = (await mk('fixture: foreign supplier', `${P}/suppliers`, { name: `FSup ${S}` }, other)).supplier;

  // Own fixtures.
  const myUnit2 = (await mk('fixture: own unit 2', `${P}/units`, { name: `MyUnit ${S}`, abbreviation: `mu${S}` })).unit;
  const emptyCat = (await mk('fixture: empty category', `${P}/categories`, { name: `EmptyCat ${S}` })).category;
  const imgProd = (await mk('fixture: product for images', `${P}/products`, {
    name: `ImgProd ${S}`, sku: `IMG-${S}`, costPrice: 10, sellingPrice: 20, quantity: 5,
  })).product;
  const expProd = (await mk('fixture: product for expenses', `${P}/products`, {
    name: `ExpProd ${S}`, sku: `EXP-${S}`, costPrice: 10, sellingPrice: 20, quantity: 5,
  })).product;

  // A system default unit (userId === null) to prove the 403 branch.
  const unitsList = await t.ok('units — list', { method: 'GET', path: `${P}/units`, auth: true });
  const systemUnit = (unitsList?.json?.units ?? []).find((u) => u.isDefault === true || u.userId === null);

  // ================================================================ AUTH (401)
  const authless = [
    ['GET', `${P}/dashboard`], ['GET', `${P}/units`], ['POST', `${P}/units`],
    ['GET', `${P}/categories`], ['POST', `${P}/categories`],
    ['GET', `${P}/products`], ['POST', `${P}/products`], ['GET', `${P}/movements`],
    ['GET', `${P}/suppliers`], ['POST', `${P}/suppliers`],
    ['GET', `${P}/products/${t.ctx.productId}/variants`],
    ['GET', `${P}/products/${t.ctx.productId}/images`],
    ['GET', `${P}/products/${t.ctx.productId}/expenses`],
    ['GET', `${P}/products/${t.ctx.productId}/margins`],
  ];
  for (const [method, path] of authless) {
    await t.check(`auth — ${method} ${path.replace(P, '')} without token`, {
      method, path, body: method === 'POST' ? {} : undefined,
      expect: { status: 401, code: 'UNAUTHORIZED' },
    });
  }
  await t.check('auth — garbage bearer token', {
    method: 'GET', path: `${P}/dashboard`, token: 'not.a.jwt',
    expect: { status: 401 },
  });

  // ================================================================ DASHBOARD
  await t.ok('dashboard — happy path', { method: 'GET', path: `${P}/dashboard`, auth: true });

  // ==================================================================== UNITS
  await t.check('units — create with no body', {
    method: 'POST', path: `${P}/units`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED', minFields: 2 },
  });
  await t.check('units — create missing abbreviation', {
    method: 'POST', path: `${P}/units`, auth: true, body: { name: `U ${S}` },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'abbreviation', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('units — name too long', {
    method: 'POST', path: `${P}/units`, auth: true, body: { name: 'x'.repeat(300), abbreviation: 'a' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('units — abbreviation too long', {
    method: 'POST', path: `${P}/units`, auth: true, body: { name: `U2 ${S}`, abbreviation: 'x'.repeat(50) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'abbreviation', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('units — duplicate name → 409', {
    method: 'POST', path: `${P}/units`, auth: true, body: { name: myUnit2?.name, abbreviation: 'zz' },
    expect: { status: 409, code: 'UNIT_ALREADY_EXISTS' },
  });
  await t.check('units — update unknown id → 404', {
    method: 'PUT', path: `${P}/units/${missing}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  await t.check('units — update foreign unit → 404', {
    method: 'PUT', path: `${P}/units/${fUnit?.id}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  await t.check('units — delete foreign unit → 404', {
    method: 'DELETE', path: `${P}/units/${fUnit?.id}`, auth: true,
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  if (systemUnit) {
    await t.check('units — update system default → 403', {
      method: 'PUT', path: `${P}/units/${systemUnit.id}`, auth: true, body: { name: 'hack' },
      expect: { status: 403, code: 'UNIT_SYSTEM_READONLY' },
    });
    await t.check('units — delete system default → 403', {
      method: 'DELETE', path: `${P}/units/${systemUnit.id}`, auth: true,
      expect: { status: 403, code: 'UNIT_SYSTEM_READONLY' },
    });
    await t.check('units — delete system default (ar)', {
      method: 'DELETE', path: `${P}/units/${systemUnit.id}`, auth: true, lang: 'ar',
      expect: { status: 403, code: 'UNIT_SYSTEM_READONLY' },
    });
  }
  await t.check('units — malformed id → 404', {
    method: 'PUT', path: `${P}/units/!!!`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  // unit in use → 422
  const usedUnit = (await mk('fixture: unit in use', `${P}/units`, { name: `UsedUnit ${S}`, abbreviation: `uu${S}` })).unit;
  await mk('fixture: product using unit', `${P}/products`, {
    name: `UnitProd ${S}`, sku: `UP-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1, unitId: usedUnit?.id,
  });
  await t.check('units — delete while products use it → 422', {
    method: 'DELETE', path: `${P}/units/${usedUnit?.id}`, auth: true,
    expect: { status: 422, code: 'UNIT_IN_USE' },
  });
  await t.check('units — delete while in use (fr)', {
    method: 'DELETE', path: `${P}/units/${usedUnit?.id}`, auth: true, lang: 'fr',
    expect: { status: 422, code: 'UNIT_IN_USE' },
  });
  const throwaway = (await mk('fixture: throwaway unit', `${P}/units`, { name: `Tmp ${S}`, abbreviation: `tm${S}` })).unit;
  await t.ok('units — update happy path', {
    method: 'PUT', path: `${P}/units/${throwaway?.id}`, auth: true, body: { name: `Tmp2 ${S}` },
  });
  await t.ok('units — delete happy path', { method: 'DELETE', path: `${P}/units/${throwaway?.id}`, auth: true });

  // =============================================================== CATEGORIES
  await t.ok('categories — list', { method: 'GET', path: `${P}/categories`, auth: true });
  await t.ok('categories — list with filters', {
    method: 'GET', path: `${P}/categories?search=Cat&minProducts=1&maxProducts=99&hasDescription=false&color=%236B7280`, auth: true,
  });
  await t.check('categories — create without name', {
    method: 'POST', path: `${P}/categories`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  // Was a real bug (Validator.requiredString stringified any value, so a
  // non-string name was stored as "[object Object]"). Fixed centrally in
  // middleware/validate.ts — a wrong-typed string field is now rejected.
  await t.check('categories — name wrong type (object) is rejected', {
    method: 'POST', path: `${P}/categories`, auth: true, body: { name: { a: 1 } },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_MUST_BE_STRING' },
  });
  await t.check('categories — name wrong type (array) is rejected', {
    method: 'POST', path: `${P}/categories`, auth: true, body: { name: ['a'] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_MUST_BE_STRING' },
  });
  await t.check('categories — name too long', {
    method: 'POST', path: `${P}/categories`, auth: true, body: { name: 'c'.repeat(300) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('categories — color too long', {
    method: 'POST', path: `${P}/categories`, auth: true, body: { name: `Col ${S}`, color: 'x'.repeat(40) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'color', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('categories — duplicate name → 409', {
    method: 'POST', path: `${P}/categories`, auth: true, body: { name: emptyCat?.name },
    expect: { status: 409, code: 'CATEGORY_ALREADY_EXISTS' },
  });
  await t.check('categories — duplicate name (ar)', {
    method: 'POST', path: `${P}/categories`, auth: true, lang: 'ar', body: { name: emptyCat?.name },
    expect: { status: 409, code: 'CATEGORY_ALREADY_EXISTS' },
  });
  await t.check('categories — duplicate name (fr)', {
    method: 'POST', path: `${P}/categories`, auth: true, lang: 'fr', body: { name: emptyCat?.name },
    expect: { status: 409, code: 'CATEGORY_ALREADY_EXISTS' },
  });
  await t.check('categories — update unknown id → 404', {
    method: 'PUT', path: `${P}/categories/${missing}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'CATEGORY_NOT_FOUND' },
  });
  await t.check('categories — update foreign category → 404', {
    method: 'PUT', path: `${P}/categories/${fCat?.id}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'CATEGORY_NOT_FOUND' },
  });
  await t.check('categories — delete foreign category → 404', {
    method: 'DELETE', path: `${P}/categories/${fCat?.id}`, auth: true,
    expect: { status: 404, code: 'CATEGORY_NOT_FOUND' },
  });
  await t.check('categories — delete with products → 422', {
    method: 'DELETE', path: `${P}/categories/${t.ctx.categoryId}`, auth: true,
    expect: { status: 422, code: 'CATEGORY_IN_USE' },
  });
  await t.check('categories — delete with products (ar)', {
    method: 'DELETE', path: `${P}/categories/${t.ctx.categoryId}`, auth: true, lang: 'ar',
    expect: { status: 422, code: 'CATEGORY_IN_USE' },
  });
  await t.ok('categories — update happy path', {
    method: 'PUT', path: `${P}/categories/${emptyCat?.id}`, auth: true, body: { name: `EmptyCat2 ${S}`, color: '#123456' },
  });
  await t.ok('categories — delete empty category', { method: 'DELETE', path: `${P}/categories/${emptyCat?.id}`, auth: true });

  // ================================================================= PRODUCTS
  await t.ok('products — list', { method: 'GET', path: `${P}/products`, auth: true });
  await t.ok('products — list with search/filters/pagination', {
    method: 'GET',
    path: `${P}/products?search=Prod&limit=5&page=1&sortBy=name&sortOrder=asc&minPrice=1&maxPrice=100000&minQty=0&isActive=true&lowStock=false`,
    auth: true,
  });
  await t.ok('products — list with margin filters', {
    method: 'GET', path: `${P}/products?minMargin=-1000&maxMargin=1000&limit=3`, auth: true,
  });
  await t.ok('products — list ignores junk pagination', {
    method: 'GET', path: `${P}/products?limit=abc&page=-4&offset=NaN`, auth: true,
  });
  await t.ok('products — list with lowStock=true', { method: 'GET', path: `${P}/products?lowStock=true`, auth: true });

  await t.check('products — create empty body', {
    method: 'POST', path: `${P}/products`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sku', fieldCode: 'FIELD_REQUIRED', minFields: 4 },
  });
  await t.check('products — missing name', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { sku: `A-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('products — costPrice not a number', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `B-${S}`, costPrice: 'abc', sellingPrice: 2, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'costPrice', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('products — costPrice negative', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `C-${S}`, costPrice: -5, sellingPrice: 2, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'costPrice', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('products — sellingPrice zero', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `D-${S}`, costPrice: 1, sellingPrice: 0, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sellingPrice', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('products — quantity not an integer', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `E-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1.5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('products — quantity NaN string', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `F-${S}`, costPrice: 1, sellingPrice: 2, quantity: 'many' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('products — selling < cost', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `G-${S}`, costPrice: 100, sellingPrice: 50, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sellingPrice', fieldCode: 'PRODUCT_SELLING_BELOW_COST' },
  });
  await t.check('products — selling < cost (ar)', {
    method: 'POST', path: `${P}/products`, auth: true, lang: 'ar',
    body: { name: 'X', sku: `G2-${S}`, costPrice: 100, sellingPrice: 50, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sellingPrice' },
  });
  await t.check('products — selling < cost (fr)', {
    method: 'POST', path: `${P}/products`, auth: true, lang: 'fr',
    body: { name: 'X', sku: `G3-${S}`, costPrice: 100, sellingPrice: 50, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sellingPrice' },
  });
  await t.check('products — name too long', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'n'.repeat(300), sku: `H-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('products — malformed categoryId', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `I-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1, categoryId: '!!' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'categoryId', fieldCode: 'FIELD_INVALID_ID' },
  });
  await t.check('products — unknown categoryId → 404', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `J-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1, categoryId: missing },
    expect: { status: 404, code: 'CATEGORY_NOT_FOUND' },
  });
  await t.check('products — foreign categoryId → 404', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `K-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1, categoryId: fCat?.id },
    expect: { status: 404, code: 'CATEGORY_NOT_FOUND' },
  });
  await t.check('products — foreign unitId → 404', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'X', sku: `L-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1, unitId: fUnit?.id },
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  await t.check('products — foreign unitId (fr)', {
    method: 'POST', path: `${P}/products`, auth: true, lang: 'fr',
    body: { name: 'X', sku: `L2-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1, unitId: fUnit?.id },
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  await t.check('products — duplicate SKU on create → 409', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: 'Dup', sku: `IMG-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1 },
    expect: { status: 409, code: 'PRODUCT_SKU_ALREADY_EXISTS' },
  });
  await t.check('products — duplicate SKU on create (ar)', {
    method: 'POST', path: `${P}/products`, auth: true, lang: 'ar',
    body: { name: 'Dup', sku: `IMG-${S}`, costPrice: 1, sellingPrice: 2, quantity: 1 },
    expect: { status: 409, code: 'PRODUCT_SKU_ALREADY_EXISTS' },
  });
  await t.check('products — malformed JSON body', {
    method: 'POST', path: `${P}/products`, auth: true, body: '{"name": ',
    expect: { status: 400, code: 'INVALID_JSON' },
  });

  const created = await t.ok('products — create happy path', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: {
      name: `New ${S}`, sku: `NEW-${S}`, costPrice: 10, sellingPrice: 30, quantity: 7,
      minQuantity: 2, categoryId: t.ctx.categoryId, unitId: myUnit2?.id, description: 'ok', unit: 'piece',
    },
    expect: { status: 201 },
  });
  const newProductId = created?.json?.product?.id;

  await t.check('products — get unknown id → 404', {
    method: 'GET', path: `${P}/products/${missing}`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('products — get foreign product → 404', {
    method: 'GET', path: `${P}/products/${t.ctx.foreignProductId}`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('products — get foreign product (ar)', {
    method: 'GET', path: `${P}/products/${t.ctx.foreignProductId}`, auth: true, lang: 'ar',
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.ok('products — get happy path', { method: 'GET', path: `${P}/products/${t.ctx.productId}`, auth: true });

  await t.check('products — update foreign product → 404', {
    method: 'PUT', path: `${P}/products/${t.ctx.foreignProductId}`, auth: true, body: { name: 'hack' },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('products — update duplicate SKU → 409', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true, body: { sku: `IMG-${S}` },
    expect: { status: 409, code: 'PRODUCT_SKU_ALREADY_EXISTS' },
  });
  await t.check('products — update negative costPrice', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true, body: { costPrice: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'costPrice', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('products — update non-integer minQuantity', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true, body: { minQuantity: 2.5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'minQuantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('products — update invalid isActive', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true, body: { isActive: 'maybe' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive' },
  });
  await t.check('products — update foreign categoryId → 404', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true, body: { categoryId: fCat?.id },
    expect: { status: 404, code: 'CATEGORY_NOT_FOUND' },
  });
  await t.check('products — update foreign unitId → 404', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true, body: { unitId: fUnit?.id },
    expect: { status: 404, code: 'UNIT_NOT_FOUND' },
  });
  await t.ok('products — update happy path', {
    method: 'PUT', path: `${P}/products/${newProductId}`, auth: true,
    body: { name: `New2 ${S}`, costPrice: 12, sellingPrice: 40, minQuantity: 3 },
  });
  await t.check('products — delete foreign product → 404', {
    method: 'DELETE', path: `${P}/products/${t.ctx.foreignProductId}`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('products — delete unknown → 404', {
    method: 'DELETE', path: `${P}/products/${missing}`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });

  // ======================================================= STOCK ADJUSTMENTS
  const adjPath = `${P}/products/${t.ctx.productId}/adjust`;
  await t.check('adjust — missing type and quantity', {
    method: 'POST', path: adjPath, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_REQUIRED', minFields: 2 },
  });
  await t.check('adjust — invalid type enum', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'teleport', quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('adjust — invalid type enum (ar)', {
    method: 'POST', path: adjPath, auth: true, lang: 'ar', body: { type: 'teleport', quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type' },
  });
  await t.check('adjust — invalid type enum (fr)', {
    method: 'POST', path: adjPath, auth: true, lang: 'fr', body: { type: 'teleport', quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type' },
  });
  await t.check('adjust — negative quantity', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'in', quantity: -3 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('adjust — non-integer quantity', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'in', quantity: 2.5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('adjust — zero quantity on "in"', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'in', quantity: 0 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'STOCK_QUANTITY_ZERO' },
  });
  await t.check('adjust — zero quantity on "out"', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'out', quantity: 0 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'STOCK_QUANTITY_ZERO' },
  });
  await t.check('adjust — reason too long', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'in', quantity: 1, reason: 'r'.repeat(300) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'reason', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('adjust — unknown product → 404', {
    method: 'POST', path: `${P}/products/${missing}/adjust`, auth: true, body: { type: 'in', quantity: 1 },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('adjust — foreign product → 404', {
    method: 'POST', path: `${P}/products/${t.ctx.foreignProductId}/adjust`, auth: true, body: { type: 'in', quantity: 1 },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('adjust — insufficient stock → 422', {
    method: 'POST', path: adjPath, auth: true, body: { type: 'out', quantity: 999999 },
    expect: { status: 422, code: 'STOCK_INSUFFICIENT', noFields: true },
  });
  await t.check('adjust — insufficient stock (ar)', {
    method: 'POST', path: adjPath, auth: true, lang: 'ar', body: { type: 'out', quantity: 999999 },
    expect: { status: 422, code: 'STOCK_INSUFFICIENT' },
  });
  await t.check('adjust — product with variants → 422', {
    method: 'POST', path: `${P}/products/${t.ctx.variantProductId}/adjust`, auth: true, body: { type: 'in', quantity: 1 },
    expect: { status: 422, code: 'PRODUCT_HAS_VARIANTS' },
  });
  await t.check('adjust — product with variants (fr)', {
    method: 'POST', path: `${P}/products/${t.ctx.variantProductId}/adjust`, auth: true, lang: 'fr', body: { type: 'in', quantity: 1 },
    expect: { status: 422, code: 'PRODUCT_HAS_VARIANTS' },
  });
  await t.ok('adjust — in happy path', { method: 'POST', path: adjPath, auth: true, body: { type: 'in', quantity: 3, reason: 'restock' } });
  await t.ok('adjust — out happy path', { method: 'POST', path: adjPath, auth: true, body: { type: 'out', quantity: 1 } });
  await t.ok('adjust — adjustment to zero is allowed', {
    method: 'POST', path: `${P}/products/${newProductId}/adjust`, auth: true, body: { type: 'adjustment', quantity: 0 },
  });
  await t.ok('adjust — return happy path', { method: 'POST', path: adjPath, auth: true, body: { type: 'return', quantity: 2 } });

  // ================================================================ MOVEMENTS
  await t.ok('movements — list', { method: 'GET', path: `${P}/movements`, auth: true });
  await t.ok('movements — type filter', { method: 'GET', path: `${P}/movements?type=in&limit=5`, auth: true });
  await t.ok('movements — date range + pagination', {
    method: 'GET', path: `${P}/movements?startDate=2000-01-01&endDate=2100-01-01&limit=2&page=2`, auth: true,
  });
  await t.ok('movements — productId filter', {
    method: 'GET', path: `${P}/movements?productId=${t.ctx.productId}`, auth: true,
  });
  await t.check('movements — invalid type filter', {
    method: 'GET', path: `${P}/movements?type=nope`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('movements — invalid startDate', {
    method: 'GET', path: `${P}/movements?startDate=not-a-date`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('movements — inverted date range', {
    method: 'GET', path: `${P}/movements?startDate=2030-01-01&endDate=2020-01-01`, auth: true,
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.check('movements — malformed productId', {
    method: 'GET', path: `${P}/movements?productId=%21%21`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'productId', fieldCode: 'FIELD_INVALID_ID' },
  });

  // =================================================================== IMAGES
  const imgBase = `${P}/products/${imgProd?.id}/images`;
  await t.ok('images — list (empty)', { method: 'GET', path: imgBase, auth: true });
  await t.check('images — list for foreign product → 404', {
    method: 'GET', path: `${P}/products/${t.ctx.foreignProductId}/images`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('images — upload with no file', {
    method: 'POST', path: imgBase, auth: true, form: new FormData(),
    expect: { status: 400, code: 'FILE_REQUIRED' },
  });
  await t.check('images — upload with a .txt file', {
    method: 'POST', path: imgBase, auth: true,
    form: imageForm('images', 'note.txt', 'text/plain', Uint8Array.from(Buffer.from('hello'))),
    expect: { status: 400, code: 'UPLOAD_INVALID_TYPE' },
  });
  await t.check('images — upload with a .txt file (ar)', {
    method: 'POST', path: imgBase, auth: true, lang: 'ar',
    form: imageForm('images', 'note.txt', 'text/plain', Uint8Array.from(Buffer.from('hello'))),
    expect: { status: 400, code: 'UPLOAD_INVALID_TYPE' },
  });
  await t.check('images — upload under the wrong field name', {
    method: 'POST', path: imgBase, auth: true, form: imageForm('photo'),
    expect: { status: 400, code: 'UPLOAD_UNEXPECTED_FIELD' },
  });
  await t.check('images — oversize file → 413', {
    method: 'POST', path: imgBase, auth: true,
    form: imageForm('images', 'big.png', 'image/png', new Uint8Array(6 * 1024 * 1024)),
    expect: { status: 413, code: 'FILE_TOO_LARGE' },
  });
  await t.check('images — upload to foreign product → 404', {
    method: 'POST', path: `${P}/products/${t.ctx.foreignProductId}/images`, auth: true, form: imageForm(),
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });

  const up1 = await t.ok('images — upload happy path #1', { method: 'POST', path: imgBase, auth: true, form: imageForm('images', 'a.png') });
  const up2 = await t.ok('images — upload happy path #2', { method: 'POST', path: imgBase, auth: true, form: imageForm('images', 'b.png') });
  const img1 = up1?.json?.images?.[0]?.id;
  const img2 = up2?.json?.images?.[0]?.id;

  await t.check('images — reorder with missing imageIds', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: {},
    expect: { status: 400, code: 'LIST_REQUIRED' },
  });
  await t.check('images — reorder with empty array', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: { imageIds: [] },
    expect: { status: 400, code: 'LIST_REQUIRED' },
  });
  await t.check('images — reorder with non-string ids', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: { imageIds: [1, 2] },
    expect: { status: 400, code: 'FIELD_INVALID_ID' },
  });
  await t.check('images — reorder with duplicate ids', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: { imageIds: [img1, img1] },
    expect: { status: 400, code: 'IMAGE_IDS_INVALID' },
  });
  await t.check('images — reorder with an id of another product', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: { imageIds: [img1, missing] },
    expect: { status: 400, code: 'IMAGE_IDS_INVALID' },
  });
  await t.check('images — reorder with too many ids', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: { imageIds: Array.from({ length: 101 }, (_, i) => `id-${i}`) },
    expect: { status: 400, code: 'TOO_MANY_FILES' },
  });
  await t.check('images — reorder on foreign product → 404', {
    method: 'PUT', path: `${P}/products/${t.ctx.foreignProductId}/images/reorder`, auth: true, body: { imageIds: [img1] },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.ok('images — reorder happy path', {
    method: 'PUT', path: `${imgBase}/reorder`, auth: true, body: { imageIds: [img2, img1] },
  });
  await t.check('images — set primary unknown image → 404', {
    method: 'PUT', path: `${imgBase}/${missing}/primary`, auth: true,
    expect: { status: 404, code: 'IMAGE_NOT_FOUND' },
  });
  await t.check('images — set primary on foreign product → 404', {
    method: 'PUT', path: `${P}/products/${t.ctx.foreignProductId}/images/${img1}/primary`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.ok('images — set primary happy path', { method: 'PUT', path: `${imgBase}/${img2}/primary`, auth: true });
  await t.check('images — delete unknown image → 404', {
    method: 'DELETE', path: `${imgBase}/${missing}`, auth: true,
    expect: { status: 404, code: 'IMAGE_NOT_FOUND' },
  });
  await t.check('images — delete unknown image (fr)', {
    method: 'DELETE', path: `${imgBase}/${missing}`, auth: true, lang: 'fr',
    expect: { status: 404, code: 'IMAGE_NOT_FOUND' },
  });
  await t.ok('images — delete happy path', { method: 'DELETE', path: `${imgBase}/${img1}`, auth: true });

  // ------------------------------------------------------------ analyze-image
  await t.check('analyze-image — no file', {
    method: 'POST', path: `${P}/products/analyze-image`, auth: true, form: new FormData(),
    expect: { status: 400, code: 'FILE_REQUIRED' },
  });
  await t.check('analyze-image — no file (ar)', {
    method: 'POST', path: `${P}/products/analyze-image`, auth: true, lang: 'ar', form: new FormData(),
    expect: { status: 400, code: 'FILE_REQUIRED' },
  });
  await t.check('analyze-image — wrong field name', {
    method: 'POST', path: `${P}/products/analyze-image`, auth: true, form: imageForm('picture'),
    expect: { status: 400, code: 'UPLOAD_UNEXPECTED_FIELD' },
  });
  await t.check('analyze-image — .txt file', {
    method: 'POST', path: `${P}/products/analyze-image`, auth: true,
    form: imageForm('image', 'note.txt', 'text/plain', Uint8Array.from(Buffer.from('hello'))),
    expect: { status: 400, code: 'UPLOAD_INVALID_TYPE' },
  });
  await t.check('analyze-image — without auth', {
    method: 'POST', path: `${P}/products/analyze-image`, form: new FormData(),
    expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  // No AI key in this env: the analysis itself must fail cleanly, never 500-leak.
  const analyzed = await t.check('analyze-image — valid png with no AI provider configured', {
    method: 'POST', path: `${P}/products/analyze-image`, auth: true, form: imageForm('image'),
    expect: {},
  });
  if (analyzed && analyzed.status >= 400 && ![502, 503].includes(analyzed.status)) {
    t.results.push({
      label: `${t.currentModule} › analyze-image — unavailable branch uses 502/503`,
      ok: false, issues: [`got ${analyzed.status} ${analyzed.json?.code}`],
    });
  }

  // ================================================================= EXPENSES
  const expBase = `${P}/products/${expProd?.id}/expenses`;
  await t.ok('expenses — list', { method: 'GET', path: expBase, auth: true });
  await t.check('expenses — list for foreign product → 404', {
    method: 'GET', path: `${P}/products/${t.ctx.foreignProductId}/expenses`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('expenses — create empty body', {
    method: 'POST', path: expBase, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category', fieldCode: 'FIELD_REQUIRED', minFields: 2 },
  });
  await t.check('expenses — invalid category enum', {
    method: 'POST', path: expBase, auth: true, body: { category: 'bribes', amount: 10 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('expenses — invalid category enum (fr)', {
    method: 'POST', path: expBase, auth: true, lang: 'fr', body: { category: 'bribes', amount: 10 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category' },
  });
  await t.check('expenses — amount zero', {
    method: 'POST', path: expBase, auth: true, body: { category: 'other', amount: 0 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('expenses — amount negative', {
    method: 'POST', path: expBase, auth: true, body: { category: 'other', amount: -5 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('expenses — amount not a number', {
    method: 'POST', path: expBase, auth: true, body: { category: 'other', amount: 'lots' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('expenses — invalid date', {
    method: 'POST', path: expBase, auth: true, body: { category: 'other', amount: 5, date: 'yesterday' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'date', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('expenses — description too long', {
    method: 'POST', path: expBase, auth: true, body: { category: 'other', amount: 5, description: 'd'.repeat(1100) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'description', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('expenses — create on foreign product → 404', {
    method: 'POST', path: `${P}/products/${t.ctx.foreignProductId}/expenses`, auth: true,
    body: { category: 'other', amount: 5 },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  const exp = await t.ok('expenses — create happy path', {
    method: 'POST', path: expBase, auth: true,
    body: { category: 'shipping', amount: 25, isPerUnit: true, description: 'DHL' },
    expect: { status: 201 },
  });
  const expenseId = exp?.json?.expense?.id;
  await t.check('expenses — update unknown id → 404', {
    method: 'PUT', path: `${expBase}/${missing}`, auth: true, body: { amount: 5 },
    expect: { status: 404, code: 'EXPENSE_NOT_FOUND' },
  });
  await t.check('expenses — update unknown id (ar)', {
    method: 'PUT', path: `${expBase}/${missing}`, auth: true, lang: 'ar', body: { amount: 5 },
    expect: { status: 404, code: 'EXPENSE_NOT_FOUND' },
  });
  await t.check('expenses — update with negative amount', {
    method: 'PUT', path: `${expBase}/${expenseId}`, auth: true, body: { amount: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('expenses — update with invalid category', {
    method: 'PUT', path: `${expBase}/${expenseId}`, auth: true, body: { category: 'nope' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('expenses — update through a foreign product path → 404', {
    method: 'PUT', path: `${P}/products/${t.ctx.foreignProductId}/expenses/${expenseId}`, auth: true, body: { amount: 5 },
    expect: { status: 404, code: 'EXPENSE_NOT_FOUND' },
  });
  await t.ok('expenses — update happy path', {
    method: 'PUT', path: `${expBase}/${expenseId}`, auth: true, body: { amount: 30, category: 'customs' },
  });
  await t.ok('margins — happy path', { method: 'GET', path: `${P}/products/${expProd?.id}/margins`, auth: true });
  await t.check('margins — foreign product → 404', {
    method: 'GET', path: `${P}/products/${t.ctx.foreignProductId}/margins`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('expenses — delete unknown → 404', {
    method: 'DELETE', path: `${expBase}/${missing}`, auth: true,
    expect: { status: 404, code: 'EXPENSE_NOT_FOUND' },
  });
  await t.ok('expenses — delete happy path', { method: 'DELETE', path: `${expBase}/${expenseId}`, auth: true });

  // ================================================================= VARIANTS
  const vBase = `${P}/products/${t.ctx.variantProductId}/variants`;
  await t.ok('variants — list', { method: 'GET', path: vBase, auth: true });
  await t.check('variants — list on foreign product → 404', {
    method: 'GET', path: `${P}/products/${t.ctx.foreignProductId}/variants`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('variants — create without name', {
    method: 'POST', path: vBase, auth: true, body: { quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('variants — negative quantity', {
    method: 'POST', path: vBase, auth: true, body: { name: `V ${S}`, quantity: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('variants — negative costPrice', {
    method: 'POST', path: vBase, auth: true, body: { name: `V ${S}`, costPrice: -2 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'costPrice', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('variants — non-integer quantity', {
    method: 'POST', path: vBase, auth: true, body: { name: `V ${S}`, quantity: 1.2 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('variants — name too long', {
    method: 'POST', path: vBase, auth: true, body: { name: 'v'.repeat(300) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('variants — duplicate name → 409', {
    method: 'POST', path: vBase, auth: true, body: { name: 'Rouge - M' },
    expect: { status: 409, code: 'VARIANT_ALREADY_EXISTS' },
  });
  await t.check('variants — duplicate name (ar)', {
    method: 'POST', path: vBase, auth: true, lang: 'ar', body: { name: 'Rouge - M' },
    expect: { status: 409, code: 'VARIANT_ALREADY_EXISTS' },
  });
  await t.check('variants — create on foreign product → 404', {
    method: 'POST', path: `${P}/products/${t.ctx.foreignProductId}/variants`, auth: true, body: { name: 'X' },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  const v2 = await t.ok('variants — create happy path', {
    method: 'POST', path: vBase, auth: true,
    body: { name: `Bleu - L ${S}`, sku: `VB-${S}`, costPrice: 50, sellingPrice: 90, quantity: 4, minQuantity: 1 },
    expect: { status: 201 },
  });
  const v2Id = v2?.json?.variant?.id;
  await t.check('variants — update unknown id → 404', {
    method: 'PUT', path: `${vBase}/${missing}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'VARIANT_NOT_FOUND' },
  });
  await t.check('variants — update through a foreign product path → 404', {
    method: 'PUT', path: `${P}/products/${t.ctx.foreignProductId}/variants/${v2Id}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('variants — update to a duplicate name → 409', {
    method: 'PUT', path: `${vBase}/${v2Id}`, auth: true, body: { name: 'Rouge - M' },
    expect: { status: 409, code: 'VARIANT_ALREADY_EXISTS' },
  });
  await t.check('variants — update negative sellingPrice', {
    method: 'PUT', path: `${vBase}/${v2Id}`, auth: true, body: { sellingPrice: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'sellingPrice', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('variants — update invalid isActive', {
    method: 'PUT', path: `${vBase}/${v2Id}`, auth: true, body: { isActive: 'perhaps' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'isActive' },
  });
  await t.ok('variants — update happy path', {
    method: 'PUT', path: `${vBase}/${v2Id}`, auth: true, body: { sellingPrice: 95, minQuantity: 2 },
  });

  // ---- variant stock adjust
  const vAdj = `${vBase}/${v2Id}/adjust`;
  await t.check('variant adjust — missing body', {
    method: 'POST', path: vAdj, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_REQUIRED', minFields: 2 },
  });
  await t.check('variant adjust — invalid type', {
    method: 'POST', path: vAdj, auth: true, body: { type: 'warp', quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('variant adjust — zero quantity on out', {
    method: 'POST', path: vAdj, auth: true, body: { type: 'out', quantity: 0 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'STOCK_QUANTITY_ZERO' },
  });
  await t.check('variant adjust — negative quantity', {
    method: 'POST', path: vAdj, auth: true, body: { type: 'in', quantity: -2 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_MUST_BE_NON_NEGATIVE' },
  });
  await t.check('variant adjust — insufficient stock → 422', {
    method: 'POST', path: vAdj, auth: true, body: { type: 'out', quantity: 100000 },
    expect: { status: 422, code: 'STOCK_INSUFFICIENT' },
  });
  await t.check('variant adjust — insufficient stock (fr)', {
    method: 'POST', path: vAdj, auth: true, lang: 'fr', body: { type: 'out', quantity: 100000 },
    expect: { status: 422, code: 'STOCK_INSUFFICIENT' },
  });
  await t.check('variant adjust — unknown variant → 404', {
    method: 'POST', path: `${vBase}/${missing}/adjust`, auth: true, body: { type: 'in', quantity: 1 },
    expect: { status: 404, code: 'VARIANT_NOT_FOUND' },
  });
  await t.check('variant adjust — foreign product path → 404', {
    method: 'POST', path: `${P}/products/${t.ctx.foreignProductId}/variants/${v2Id}/adjust`, auth: true,
    body: { type: 'in', quantity: 1 },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.ok('variant adjust — in happy path', { method: 'POST', path: vAdj, auth: true, body: { type: 'in', quantity: 5 } });
  await t.ok('variant adjust — out happy path', { method: 'POST', path: vAdj, auth: true, body: { type: 'out', quantity: 2 } });
  await t.ok('variant adjust — adjustment happy path', { method: 'POST', path: vAdj, auth: true, body: { type: 'adjustment', quantity: 9 } });

  await t.check('variants — delete unknown → 404', {
    method: 'DELETE', path: `${vBase}/${missing}`, auth: true,
    expect: { status: 404, code: 'VARIANT_NOT_FOUND' },
  });
  await t.check('variants — delete through a foreign product path → 404', {
    method: 'DELETE', path: `${P}/products/${t.ctx.foreignProductId}/variants/${v2Id}`, auth: true,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.ok('variants — delete happy path', { method: 'DELETE', path: `${vBase}/${v2Id}`, auth: true });

  // ================================================================ SUPPLIERS
  await t.ok('suppliers — list', { method: 'GET', path: `${P}/suppliers`, auth: true });
  await t.ok('suppliers — list with filters', {
    method: 'GET', path: `${P}/suppliers?search=Sup&isActive=true&minPurchases=0&maxTotalSpent=100000`, auth: true,
  });
  await t.check('suppliers — invalid startDate filter', {
    method: 'GET', path: `${P}/suppliers?startDate=nope`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('suppliers — inverted date range', {
    method: 'GET', path: `${P}/suppliers?startDate=2030-01-01&endDate=2020-01-01`, auth: true,
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.check('suppliers — create without name', {
    method: 'POST', path: `${P}/suppliers`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('suppliers — invalid email', {
    method: 'POST', path: `${P}/suppliers`, auth: true, body: { name: `S ${S}`, email: 'not-an-email' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL' },
  });
  await t.check('suppliers — invalid email (ar)', {
    method: 'POST', path: `${P}/suppliers`, auth: true, lang: 'ar', body: { name: `S ${S}`, email: 'nope@' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email' },
  });
  await t.check('suppliers — name too long', {
    method: 'POST', path: `${P}/suppliers`, auth: true, body: { name: 's'.repeat(300) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('suppliers — notes too long', {
    method: 'POST', path: `${P}/suppliers`, auth: true, body: { name: `S2 ${S}`, notes: 'n'.repeat(6000) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'notes', fieldCode: 'FIELD_TOO_LONG' },
  });
  const sup = await t.ok('suppliers — create happy path', {
    method: 'POST', path: `${P}/suppliers`, auth: true,
    body: { name: `MySup ${S}`, email: 'sup@example.com', phone: '0550112233', address: 'Alger', notes: 'ok' },
    expect: { status: 201 },
  });
  const supId = sup?.json?.supplier?.id;
  await t.check('suppliers — duplicate name on create → 409', {
    method: 'POST', path: `${P}/suppliers`, auth: true, body: { name: `MySup ${S}` },
    expect: { status: 409, code: 'SUPPLIER_ALREADY_EXISTS' },
  });
  await t.check('suppliers — duplicate name (fr)', {
    method: 'POST', path: `${P}/suppliers`, auth: true, lang: 'fr', body: { name: `MySup ${S}` },
    expect: { status: 409, code: 'SUPPLIER_ALREADY_EXISTS' },
  });
  await t.check('suppliers — update unknown → 404', {
    method: 'PUT', path: `${P}/suppliers/${missing}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'SUPPLIER_NOT_FOUND' },
  });
  await t.check('suppliers — update foreign supplier → 404', {
    method: 'PUT', path: `${P}/suppliers/${fSup?.id}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'SUPPLIER_NOT_FOUND' },
  });
  await t.check('suppliers — update with invalid email', {
    method: 'PUT', path: `${P}/suppliers/${supId}`, auth: true, body: { email: 'bad@@x' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL' },
  });
  await t.check('suppliers — delete foreign supplier → 404', {
    method: 'DELETE', path: `${P}/suppliers/${fSup?.id}`, auth: true,
    expect: { status: 404, code: 'SUPPLIER_NOT_FOUND' },
  });
  await t.ok('suppliers — update happy path', {
    method: 'PUT', path: `${P}/suppliers/${supId}`, auth: true, body: { name: `MySup2 ${S}`, notes: 'updated' },
  });
  await t.ok('suppliers — delete happy path', { method: 'DELETE', path: `${P}/suppliers/${supId}`, auth: true });

  // ============================================ SKU REUSE AFTER DELETE (bug 1)
  // A soft-deleted product used to keep its SKU reserved by @@unique([userId, sku]),
  // so the merchant got a 409 for a product they could no longer see.
  const reuseSku = `REUSE-${S}`;
  const reuseV1 = await t.ok('sku reuse — create the product to be deleted', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: `Reuse ${S}`, sku: reuseSku, costPrice: 10, sellingPrice: 20, quantity: 3 },
    expect: { status: 201 },
  });
  const reuseV1Id = reuseV1?.json?.product?.id;
  await t.check('sku reuse — same SKU while the product is alive → 409', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: `Reuse dup ${S}`, sku: reuseSku, costPrice: 10, sellingPrice: 20, quantity: 1 },
    expect: { status: 409, code: 'PRODUCT_SKU_ALREADY_EXISTS' },
  });
  await t.check('sku reuse — same SKU while alive (fr)', {
    method: 'POST', path: `${P}/products`, auth: true, lang: 'fr',
    body: { name: `Reuse dup ${S}`, sku: reuseSku, costPrice: 10, sellingPrice: 20, quantity: 1 },
    expect: { status: 409, code: 'PRODUCT_SKU_ALREADY_EXISTS' },
  });
  await t.ok('sku reuse — delete the product', {
    method: 'DELETE', path: `${P}/products/${reuseV1Id}`, auth: true,
  });
  const reuseV2 = await t.ok('sku reuse — recreate with the SAME SKU after delete → 201', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: `Reuse again ${S}`, sku: reuseSku, costPrice: 10, sellingPrice: 25, quantity: 7 },
    expect: { status: 201 },
  });
  const reuseV2Id = reuseV2?.json?.product?.id;
  if (reuseV2?.json?.product?.sku !== reuseSku) {
    t.results.push({ label: `${t.currentModule} › sku reuse — recreated product keeps the plain SKU`, ok: false,
      issues: [`sku is "${reuseV2?.json?.product?.sku}" instead of "${reuseSku}"`] });
  } else {
    t.results.push({ label: `${t.currentModule} › sku reuse — recreated product keeps the plain SKU`, ok: true, issues: [] });
  }
  // History is preserved: the deleted row still exists, with its SKU archived.
  const deadRow = await t.ok('sku reuse — the deleted product is still readable (history kept)', {
    method: 'GET', path: `${P}/products/${reuseV1Id}`, auth: true,
  });
  const deadOk = deadRow?.json?.product?.isActive === false
    && deadRow?.json?.product?.archivedSku === reuseSku
    && deadRow?.json?.product?.sku !== reuseSku;
  t.results.push({
    label: `${t.currentModule} › sku reuse — deleted product keeps archivedSku and released its sku`,
    ok: !!deadOk,
    issues: deadOk ? [] : [`got isActive=${deadRow?.json?.product?.isActive} sku=${deadRow?.json?.product?.sku} archivedSku=${deadRow?.json?.product?.archivedSku}`],
  });
  await t.ok('sku reuse — second delete then third create with the same SKU', {
    method: 'DELETE', path: `${P}/products/${reuseV2Id}`, auth: true,
  });
  await t.ok('sku reuse — third create with the same SKU → 201', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: `Reuse third ${S}`, sku: reuseSku, costPrice: 10, sellingPrice: 30, quantity: 1 },
    expect: { status: 201 },
  });

  // ======================================== DIGITAL / NON-TRACKED STOCK (bug 2)
  await t.check('digital — a tracked product still requires quantity', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: `Tracked ${S}`, sku: `TRK-${S}`, costPrice: 10, sellingPrice: 20 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'quantity', fieldCode: 'FIELD_REQUIRED' },
  });
  const digital = await t.ok('digital — create without quantity (trackStock: false) → 201', {
    method: 'POST', path: `${P}/products`, auth: true,
    body: { name: `Ebook ${S}`, sku: `EBOOK-${S}`, costPrice: 100, sellingPrice: 500, trackStock: false },
    expect: { status: 201 },
  });
  const digitalId = digital?.json?.product?.id;
  t.results.push({
    label: `${t.currentModule} › digital — created product is flagged trackStock: false`,
    ok: digital?.json?.product?.trackStock === false,
    issues: digital?.json?.product?.trackStock === false ? [] : [`trackStock is ${digital?.json?.product?.trackStock}`],
  });
  await t.check('digital — adjusting the stock of a digital product → 422', {
    method: 'POST', path: `${P}/products/${digitalId}/adjust`, auth: true,
    body: { type: 'in', quantity: 5 },
    expect: { status: 422, code: 'PRODUCT_NOT_STOCK_TRACKED' },
  });
  await t.check('digital — adjust refusal is translated (ar)', {
    method: 'POST', path: `${P}/products/${digitalId}/adjust`, auth: true, lang: 'ar',
    body: { type: 'out', quantity: 1 },
    expect: { status: 422, code: 'PRODUCT_NOT_STOCK_TRACKED' },
  });
  await t.check('digital — a digital product cannot carry variants', {
    method: 'POST', path: `${P}/products/${digitalId}/variants`, auth: true,
    body: { name: `V ${S}`, quantity: 1 },
    expect: { status: 422, code: 'PRODUCT_NOT_STOCK_TRACKED' },
  });
  // Creation writes NO opening stock movement: a digital product has no ledger.
  // (Checked before the sale/order below, which post their own movements from
  // the sales/orders controllers — out of this module's scope.)
  const digitalMovements = await t.ok('digital — creation wrote no stock movement', {
    method: 'GET', path: `${P}/movements?productId=${digitalId}`, auth: true,
  });
  const mvCount = digitalMovements?.json?.total ?? (digitalMovements?.json?.movements ?? []).length;
  t.results.push({
    label: `${t.currentModule} › digital — no opening stock movement for a digital product`,
    ok: mvCount === 0, issues: mvCount === 0 ? [] : [`${mvCount} movement(s) written`],
  });

  // The whole point: it sells and ships without ever hitting "insufficient stock".
  await t.ok('digital — can be SOLD without a stock error', {
    method: 'POST', path: `${P}/sales`, auth: true,
    body: { customerName: `Buyer ${S}`, items: [{ productId: digitalId, quantity: 4 }], paymentMethod: 'cash' },
    expect: { status: 201 },
  });
  await t.ok('digital — can be ORDERED without a stock error', {
    method: 'POST', path: `${P}/orders`, auth: true,
    body: { clientName: `Client ${S}`, items: [{ productId: digitalId, quantity: 9 }] },
    expect: { status: 201 },
  });
  // It must never show up as low stock, whatever its parked quantity.
  const lowStockList = await t.ok('digital — excluded from the lowStock filter', {
    method: 'GET', path: `${P}/products?lowStock=true&limit=200`, auth: true,
  });
  const inLow = (lowStockList?.json?.products ?? []).some((pr) => pr.id === digitalId);
  t.results.push({
    label: `${t.currentModule} › digital — not listed as low stock`,
    ok: !inLow, issues: inLow ? ['the digital product is reported as low stock'] : [],
  });

  // ==================================================== PRODUCT IMPORT (feature)
  const IMP = `${P}/products/import`;
  await t.check('import — without a token', {
    method: 'POST', path: IMP, expect: { status: 401, code: 'UNAUTHORIZED' },
  });
  await t.check('import — no file at all', {
    method: 'POST', path: IMP, auth: true, form: new FormData(),
    expect: { status: 400, code: 'FILE_REQUIRED' },
  });
  await t.check('import — an image is not a spreadsheet', {
    method: 'POST', path: IMP, auth: true, form: imageForm('file', 'pic.png', 'image/png'),
    expect: { status: 400, code: 'UPLOAD_INVALID_TYPE' },
  });
  // The field must be `file`; anything else is an upload error, not a parse error.
  const wrongField = new FormData();
  wrongField.append('sheet', new Blob(['name,sku,sellingPrice\nA,A-1,10\n'], { type: 'text/csv' }), 'p.csv');
  await t.check('import — wrong multipart field name', {
    method: 'POST', path: IMP, auth: true, form: wrongField,
    expect: { status: 400, code: 'UPLOAD_UNEXPECTED_FIELD' },
  });
  await t.check('import — header line without the required columns', {
    method: 'POST', path: IMP, auth: true, form: csvForm('foo,bar\n1,2\n'),
    expect: { status: 400, code: 'IMPORT_COLUMNS_MISSING' },
  });
  await t.check('import — header only, no product row', {
    method: 'POST', path: IMP, auth: true, form: csvForm('nom,reference,prix de vente\n'),
    expect: { status: 400, code: 'IMPORT_FILE_EMPTY' },
  });
  await t.check('import — file empty row report is translated (fr)', {
    method: 'POST', path: IMP, auth: true, lang: 'fr', form: csvForm('nom,reference,prix de vente\n'),
    expect: { status: 400, code: 'IMPORT_FILE_EMPTY' },
  });

  // Per-row report: 2 good rows, and one row per failure mode.
  const badCsv = [
    'Nom,Référence,Description,Prix d\'achat,Prix de vente,Quantité,Catégorie,Unité',
    `Bon produit A,IMPA-${S},desc A,100,250,5,Importée ${S},piece`,          // row 2 — ok
    `,IMPB-${S},no name,100,250,5,,`,                                        // row 3 — name required
    `Sans ref,,no sku,100,250,5,,`,                                          // row 4 — sku required
    `Prix pas un nombre,IMPC-${S},,100,abc,5,,`,                             // row 5 — sellingPrice NaN
    `Vente sous cout,IMPD-${S},,900,100,5,,`,                                // row 6 — selling < cost
    `Quantite decimale,IMPE-${S},,10,20,2.5,,`,                              // row 7 — quantity not integer
    `Doublon dans le fichier,IMPA-${S},,10,20,1,,`,                          // row 8 — duplicate of row 2
    `Deja en base,EBOOK-${S},,10,600,1,,`,                                   // row 9 — SKU of a live product
    `Bon produit B,IMPF-${S},desc B,,300,0,Importée ${S},kg`,                // row 10 — ok (no cost, qty 0)
  ].join('\n') + '\n';
  const badRep = await t.ok('import — mixed file returns a per-row report', {
    method: 'POST', path: IMP, auth: true, form: csvForm(badCsv, 'mixed.csv'),
  });
  const rep = badRep?.json ?? {};
  const byRow = (n) => (rep.errors ?? []).filter((e) => e.row === n);
  const repIssues = [];
  if (rep.imported !== 2) repIssues.push(`imported ${rep.imported} ≠ 2`);
  if (rep.skipped !== 7) repIssues.push(`skipped ${rep.skipped} ≠ 7`);
  if (rep.total !== 9) repIssues.push(`total ${rep.total} ≠ 9`);
  const expectRow = (n, field, code) => {
    const hit = byRow(n).find((e) => e.field === field && e.code === code);
    if (!hit) repIssues.push(`row ${n}: no ${field}/${code} (got ${JSON.stringify(byRow(n))})`);
    else if (!hit.message || /^[A-Z0-9_]+$/.test(hit.message)) repIssues.push(`row ${n}: message is not a sentence`);
  };
  expectRow(3, 'name', 'FIELD_REQUIRED');
  expectRow(4, 'sku', 'FIELD_REQUIRED');
  expectRow(5, 'sellingPrice', 'FIELD_MUST_BE_NUMBER');
  expectRow(6, 'sellingPrice', 'PRODUCT_SELLING_BELOW_COST');
  expectRow(7, 'quantity', 'FIELD_MUST_BE_INTEGER');
  expectRow(8, 'sku', 'IMPORT_DUPLICATE_SKU_IN_FILE');
  expectRow(9, 'sku', 'PRODUCT_SKU_ALREADY_EXISTS');
  if (byRow(2).length > 0) repIssues.push('row 2 should be valid');
  if (byRow(10).length > 0) repIssues.push('row 10 should be valid');
  t.results.push({
    label: `${t.currentModule} › import — per-row errors carry row + field + code + translated message`,
    ok: repIssues.length === 0, issues: repIssues,
  });

  // The two valid rows really landed, with the category created on the fly.
  const importedList = await t.ok('import — the valid rows are now listed', {
    method: 'GET', path: `${P}/products?search=IMPA-${S}`, auth: true,
  });
  const impA = (importedList?.json?.products ?? []).find((pr) => pr.sku === `IMPA-${S}`);
  t.results.push({
    label: `${t.currentModule} › import — imported product exists with its category created on the fly`,
    ok: !!impA && impA.category?.name === `Importée ${S}`,
    issues: impA ? (impA.category?.name === `Importée ${S}` ? [] : [`category is ${JSON.stringify(impA.category)}`]) : ['IMPA not found'],
  });
  // Re-importing the same file now clashes with the rows just created.
  const replay = await t.ok('import — replaying the same file imports nothing (SKUs now live)', {
    method: 'POST', path: IMP, auth: true, form: csvForm(badCsv, 'mixed.csv'),
  });
  t.results.push({
    label: `${t.currentModule} › import — replay imports 0 row and reports every SKU as taken`,
    ok: replay?.json?.imported === 0,
    issues: replay?.json?.imported === 0 ? [] : [`imported ${replay?.json?.imported} on replay`],
  });

  // A fully valid, English-headed sheet imports cleanly.
  const goodCsv = [
    'name,sku,description,costPrice,sellingPrice,quantity,category,unit',
    `Clean A ${S},CLEANA-${S},first,50,120,10,Clean cat ${S},piece`,
    `Clean B ${S},CLEANB-${S},second,60,130,0,Clean cat ${S},piece`,
    `Clean C ${S},CLEANC-${S},third,70,140,3,Clean cat ${S},`,
  ].join('\n') + '\n';
  const goodRep = await t.ok('import — a small valid file imports every row', {
    method: 'POST', path: IMP, auth: true, form: csvForm(goodCsv, 'clean.csv'),
  });
  const g = goodRep?.json ?? {};
  t.results.push({
    label: `${t.currentModule} › import — valid file: imported 3, skipped 0, no error`,
    ok: g.imported === 3 && g.skipped === 0 && (g.errors ?? []).length === 0,
    issues: (g.imported === 3 && g.skipped === 0 && (g.errors ?? []).length === 0)
      ? [] : [`got ${JSON.stringify({ imported: g.imported, skipped: g.skipped, errors: (g.errors ?? []).length })}`],
  });
  // An imported row with quantity > 0 gets its opening stock movement.
  const cleanA = (await t.ok('import — imported product is readable', {
    method: 'GET', path: `${P}/products?search=CLEANA-${S}`, auth: true,
  }))?.json?.products?.find((pr) => pr.sku === `CLEANA-${S}`);
  const cleanMv = cleanA ? await t.ok('import — opening stock movement written for an imported quantity', {
    method: 'GET', path: `${P}/movements?productId=${cleanA.id}`, auth: true,
  }) : null;
  t.results.push({
    label: `${t.currentModule} › import — imported quantity 10 wrote one "in" movement`,
    ok: !!cleanA && (cleanMv?.json?.movements ?? []).some((m) => m.type === 'in' && m.quantity === 10),
    issues: cleanA ? [] : ['CLEANA not found'],
  });
  await t.check('import — too many rows', {
    method: 'POST', path: IMP, auth: true,
    form: csvForm(
      'name,sku,sellingPrice\n' + Array.from({ length: 2001 }, (_, i) => `P${i},BULK-${S}-${i},10`).join('\n') + '\n',
      'huge.csv',
    ),
    expect: { status: 400, code: 'IMPORT_TOO_MANY_ROWS' },
  });

  // Cross-tenant sanity: the other merchant must not see my product.
  await t.check('cross-tenant — other merchant cannot read my product', {
    method: 'GET', path: `${P}/products/${t.ctx.productId}`, token: other,
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
  await t.check('cross-tenant — other merchant cannot adjust my product', {
    method: 'POST', path: adjPath, token: other, body: { type: 'in', quantity: 1 },
    expect: { status: 404, code: 'PRODUCT_NOT_FOUND' },
  });
};
