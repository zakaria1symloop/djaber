/**
 * Group "stock" — /api/user-stock: dashboard, units, categories, products,
 * stock adjustments, movements, images, expenses, margins, variants, suppliers.
 */

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
