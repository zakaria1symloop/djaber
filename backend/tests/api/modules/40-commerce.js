/**
 * Group "commerce": /orders, /sales, /purchases, /clients, /caisse.
 */
const B = '/api/user-stock';

module.exports = async (t) => {
  const stamp = Date.now();
  const P = t.ctx.productId;
  const VP = t.ctx.variantProductId;
  const V = t.ctx.variantId;
  const MISS = t.ctx.missingId;

  const line = (extra = {}) => ({ productId: P, quantity: 1, unitPrice: 100, ...extra });

  // A foreign order / sale / purchase / caisse row owned by the SECOND user.
  const fOrder = await t.ok('seed foreign order', {
    method: 'POST', path: `${B}/orders`, token: t.tokens.other,
    body: { clientName: 'F', items: [{ productId: t.ctx.foreignProductId, quantity: 1, unitPrice: 10 }] },
  });
  const foreignOrderId = fOrder?.json?.order?.id;
  const fSale = await t.ok('seed foreign sale', {
    method: 'POST', path: `${B}/sales`, token: t.tokens.other,
    body: { items: [{ productId: t.ctx.foreignProductId, quantity: 1, unitPrice: 10 }] },
  });
  const foreignSaleId = fSale?.json?.sale?.id;
  const fPurchase = await t.ok('seed foreign purchase', {
    method: 'POST', path: `${B}/purchases`, token: t.tokens.other,
    body: { items: [{ productId: t.ctx.foreignProductId, quantity: 1, unitCost: 5 }] },
  });
  const foreignPurchaseId = fPurchase?.json?.purchase?.id;
  const fCaisse = await t.ok('seed foreign caisse', {
    method: 'POST', path: `${B}/caisse`, token: t.tokens.other,
    body: { type: 'expense', amount: 10, category: 'other' },
  });
  const foreignCaisseId = fCaisse?.json?.transaction?.id;

  const productQty = async (label) => {
    const r = await t.raw({ method: 'GET', path: `${B}/products/${P}`, auth: true });
    return Number(r.json?.product?.quantity ?? NaN);
  };

  // ==========================================================================
  // ORDERS — auth + list filters
  // ==========================================================================
  await t.check('orders — list without auth', {
    method: 'GET', path: `${B}/orders`, expect: { status: 401 },
  });
  await t.check('orders — list with a garbage token', {
    method: 'GET', path: `${B}/orders`, token: 'not-a-jwt', expect: { status: 401 },
  });
  await t.check('orders — status enum', {
    method: 'GET', path: `${B}/orders?status=bogus`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('orders — paymentStatus enum (ar)', {
    method: 'GET', path: `${B}/orders?paymentStatus=nope`, auth: true, lang: 'ar',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentStatus', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('orders — deliveryStatus enum', {
    method: 'GET', path: `${B}/orders?deliveryStatus=flying`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'deliveryStatus' },
  });
  await t.check('orders — confirmationStatus enum (fr)', {
    method: 'GET', path: `${B}/orders?confirmationStatus=maybe`, auth: true, lang: 'fr',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'confirmationStatus' },
  });
  await t.check('orders — startDate not a date', {
    method: 'GET', path: `${B}/orders?startDate=hello`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'startDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('orders — inverted date range', {
    method: 'GET', path: `${B}/orders?startDate=2025-06-02&endDate=2025-06-01`, auth: true,
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.check('orders — minTotal negative', {
    method: 'GET', path: `${B}/orders?minTotal=-5`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'minTotal' },
  });
  await t.ok('orders — list happy', { method: 'GET', path: `${B}/orders?limit=5&page=1`, auth: true });
  await t.ok('orders — list tolerates junk pagination', { method: 'GET', path: `${B}/orders?limit=abc&page=-3`, auth: true });
  await t.ok('orders — list with valid filters', { method: 'GET', path: `${B}/orders?status=pending&paymentStatus=pending&limit=2`, auth: true });
  await t.ok('orders — stats', { method: 'GET', path: `${B}/orders/stats?period=month`, auth: true });
  await t.check('orders — stats without auth', { method: 'GET', path: `${B}/orders/stats`, expect: { status: 401 } });

  // GET one
  await t.check('orders — get unknown id', {
    method: 'GET', path: `${B}/orders/${MISS}`, auth: true, expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders — get malformed id', {
    method: 'GET', path: `${B}/orders/not-an-id`, auth: true, expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders — get another merchant order (ar)', {
    method: 'GET', path: `${B}/orders/${foreignOrderId}`, auth: true, lang: 'ar',
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.ok('orders — get own order', { method: 'GET', path: `${B}/orders/${t.ctx.orderId}`, auth: true });

  // ==========================================================================
  // ORDERS — create validation
  // ==========================================================================
  await t.check('orders — create without auth', {
    method: 'POST', path: `${B}/orders`, body: { clientName: 'x', items: [line()] }, expect: { status: 401 },
  });
  await t.check('orders — clientName missing', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'clientName', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('orders — clientName too long', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x'.repeat(300), items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'clientName', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('orders — items missing', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items', fieldCode: 'LIST_REQUIRED' },
  });
  await t.check('orders — items not an array', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: 'nope' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items' },
  });
  await t.check('orders — items empty array', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items' },
  });
  await t.check('orders — item productId missing', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [{ quantity: 1 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].productId', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('orders — item productId malformed', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [{ productId: 'zzz!!', quantity: 1 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].productId', fieldCode: 'FIELD_INVALID_ID' },
  });
  await t.check('orders — item quantity zero', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [line({ quantity: 0 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('orders — item quantity negative (ar)', {
    method: 'POST', path: `${B}/orders`, auth: true, lang: 'ar', body: { clientName: 'x', items: [line({ quantity: -2 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('orders — item quantity fractional', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [line({ quantity: 1.5 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('orders — item quantity not a number', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [line({ quantity: 'many' })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('orders — item unitPrice negative', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [line({ unitPrice: -1 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].unitPrice' },
  });
  await t.check('orders — discount negative', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', discount: -10, items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'discount' },
  });
  await t.check('orders — paymentMethod enum', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', paymentMethod: 'bitcoin', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentMethod', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('orders — status enum on create', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', status: 'teleported', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status' },
  });
  await t.check('orders — source enum on create', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', source: 'pigeon', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'source' },
  });
  await t.check('orders — orderDate far in the future', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', orderDate: '2999-01-01', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'orderDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('orders — several bad fields at once', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { items: [line({ quantity: 0 })], discount: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', minFields: 3 },
  });
  await t.check('orders — clientId malformed', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', clientId: '!!!', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'clientId', fieldCode: 'FIELD_INVALID_ID' },
  });
  await t.check('orders — clientId unknown', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', clientId: MISS, items: [line()] },
    expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('orders — clientId owned by another merchant', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', clientId: t.ctx.foreignClientId, items: [line()] },
    expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('orders — unknown productId', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [line({ productId: MISS })] },
    expect: { status: 400, code: 'PRODUCTS_NOT_FOUND' },
  });
  await t.check('orders — productId owned by another merchant', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [line({ productId: t.ctx.foreignProductId })] },
    expect: { status: 400, code: 'PRODUCTS_NOT_FOUND' },
  });
  await t.check('orders — insufficient stock (ar)', {
    method: 'POST', path: `${B}/orders`, auth: true, lang: 'ar', body: { clientName: 'x', items: [line({ quantity: 999999 })] },
    expect: { status: 422, code: 'ORDER_INSUFFICIENT_STOCK' },
  });
  await t.check('orders — variant product without variantId', {
    method: 'POST', path: `${B}/orders`, auth: true, body: { clientName: 'x', items: [{ productId: VP, quantity: 1, unitPrice: 100 }] },
    expect: { status: 400, code: 'ORDER_VARIANT_REQUIRED' },
  });
  await t.check('orders — variant not found (fr)', {
    method: 'POST', path: `${B}/orders`, auth: true, lang: 'fr',
    body: { clientName: 'x', items: [{ productId: VP, variantId: MISS, quantity: 1, unitPrice: 100 }] },
    expect: { status: 404, code: 'ORDER_VARIANT_NOT_FOUND' },
  });

  // ==========================================================================
  // ORDERS — happy path + side effects
  // ==========================================================================
  const qtyBefore = await productQty();
  const created = await t.ok('orders — create happy path', {
    method: 'POST', path: `${B}/orders`, auth: true,
    body: { clientName: 'Happy Client', clientPhone: '0551234567', clientId: t.ctx.clientId, items: [line({ quantity: 2 })] },
    expect: { status: 201 },
  });
  const orderA = created?.json?.order?.id;
  const qtyAfter = await productQty();
  t.results.push({
    label: `${t.currentModule} › orders — create deducted stock by 2`,
    ok: qtyAfter === qtyBefore - 2,
    issues: qtyAfter === qtyBefore - 2 ? [] : [`stock ${qtyBefore} → ${qtyAfter}, expected -2`],
  });
  await t.ok('orders — variant order happy path', {
    method: 'POST', path: `${B}/orders`, auth: true,
    body: { clientName: 'Variant Client', items: [{ productId: VP, variantId: V, quantity: 1, unitPrice: 200 }] },
    expect: { status: 201 },
  });

  // ==========================================================================
  // ORDERS — update
  // ==========================================================================
  await t.check('orders — update unknown id', {
    method: 'PUT', path: `${B}/orders/${MISS}`, auth: true, body: { status: 'confirmed' },
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders — update another merchant order', {
    method: 'PUT', path: `${B}/orders/${foreignOrderId}`, auth: true, body: { status: 'confirmed' },
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders — update without auth', {
    method: 'PUT', path: `${B}/orders/${orderA}`, body: { status: 'confirmed' }, expect: { status: 401 },
  });
  await t.check('orders — update status enum', {
    method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { status: 'levitating' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('orders — update deliveryStatus enum', {
    method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { deliveryStatus: 'teleporting' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'deliveryStatus' },
  });
  await t.check('orders — update amountPaid negative', {
    method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { amountPaid: -50 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amountPaid' },
  });
  await t.ok('orders — confirm', { method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { status: 'confirmed' } });
  await t.ok('orders — ship', { method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { status: 'shipped' } });
  await t.check('orders — forbidden transition shipped → pending', {
    method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { status: 'pending' },
    expect: { status: 422, code: 'ORDER_INVALID_TRANSITION' },
  });
  await t.check('orders — forbidden transition shipped → cancelled (ar)', {
    method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, lang: 'ar', body: { status: 'cancelled' },
    expect: { status: 422, code: 'ORDER_INVALID_TRANSITION' },
  });
  await t.ok('orders — deliver', { method: 'PUT', path: `${B}/orders/${orderA}`, auth: true, body: { status: 'delivered' } });
  const delivered = await t.raw({ method: 'GET', path: `${B}/orders/${orderA}`, auth: true });
  const dOrder = delivered.json?.order;
  t.results.push({
    label: `${t.currentModule} › orders — delivering auto-pays the order`,
    ok: dOrder?.paymentStatus === 'paid' && Number(dOrder?.amountPaid) === Number(dOrder?.total),
    issues: dOrder?.paymentStatus === 'paid' ? [] : [`paymentStatus=${dOrder?.paymentStatus} amountPaid=${dOrder?.amountPaid}/${dOrder?.total}`],
  });
  const caisseForOrder = await t.raw({ method: 'GET', path: `${B}/caisse?limit=200`, auth: true });
  const autoRow = (caisseForOrder.json?.transactions || []).find((x) => x.sourceId === orderA && x.isAutomatic);
  t.results.push({
    label: `${t.currentModule} › orders — delivered order created an automatic caisse income row`,
    ok: !!autoRow && autoRow.type === 'income',
    issues: autoRow ? [] : ['no automatic caisse row for the delivered order'],
  });
  await t.check('orders — delete a delivered order', {
    method: 'DELETE', path: `${B}/orders/${orderA}`, auth: true,
    expect: { status: 422, code: 'ORDER_DELETE_DELIVERED' },
  });
  await t.check('orders — delete a delivered order (fr)', {
    method: 'DELETE', path: `${B}/orders/${orderA}`, auth: true, lang: 'fr',
    expect: { status: 422, code: 'ORDER_DELETE_DELIVERED' },
  });

  // Terminal order (cancelled): stock restored, payment frozen.
  const qtyB4 = await productQty();
  const cancelMe = await t.ok('orders — create order to cancel', {
    method: 'POST', path: `${B}/orders`, auth: true,
    body: { clientName: 'Cancel Me', items: [line({ quantity: 3 })] }, expect: { status: 201 },
  });
  const orderB = cancelMe?.json?.order?.id;
  await t.ok('orders — cancel it', { method: 'PUT', path: `${B}/orders/${orderB}`, auth: true, body: { status: 'cancelled' } });
  const qtyAfterCancel = await productQty();
  t.results.push({
    label: `${t.currentModule} › orders — cancel restored the stock`,
    ok: qtyAfterCancel === qtyB4,
    issues: qtyAfterCancel === qtyB4 ? [] : [`stock ${qtyB4} → ${qtyAfterCancel} after create+cancel, expected unchanged`],
  });
  await t.check('orders — resurrect a cancelled order', {
    method: 'PUT', path: `${B}/orders/${orderB}`, auth: true, body: { status: 'confirmed' },
    expect: { status: 422, code: 'ORDER_TERMINAL' },
  });
  await t.check('orders — pay a cancelled order (ar)', {
    method: 'PUT', path: `${B}/orders/${orderB}`, auth: true, lang: 'ar', body: { amountPaid: 100 },
    expect: { status: 422, code: 'ORDER_TERMINAL_PAYMENT_LOCKED' },
  });
  await t.ok('orders — delete the cancelled order', { method: 'DELETE', path: `${B}/orders/${orderB}`, auth: true });
  const qtyAfterDelete = await productQty();
  t.results.push({
    label: `${t.currentModule} › orders — deleting an already-cancelled order does not double-credit stock`,
    ok: qtyAfterDelete === qtyB4,
    issues: qtyAfterDelete === qtyB4 ? [] : [`stock ${qtyB4} → ${qtyAfterDelete}, expected unchanged`],
  });
  await t.check('orders — delete unknown id', {
    method: 'DELETE', path: `${B}/orders/${MISS}`, auth: true, expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders — delete another merchant order', {
    method: 'DELETE', path: `${B}/orders/${foreignOrderId}`, auth: true, expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });

  // ==========================================================================
  // ORDERS — calls
  // ==========================================================================
  const callOrderRes = await t.ok('orders — create order for calls', {
    method: 'POST', path: `${B}/orders`, auth: true,
    body: { clientName: 'Call Me', clientPhone: '0551112233', items: [line()] }, expect: { status: 201 },
  });
  const orderC = callOrderRes?.json?.order?.id;
  await t.check('orders/calls — result missing', {
    method: 'POST', path: `${B}/orders/${orderC}/calls`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'result', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('orders/calls — result enum (ar)', {
    method: 'POST', path: `${B}/orders/${orderC}/calls`, auth: true, lang: 'ar', body: { result: 'hung_up' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'result', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('orders/calls — unknown order', {
    method: 'POST', path: `${B}/orders/${MISS}/calls`, auth: true, body: { result: 'picked_up' },
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders/calls — another merchant order', {
    method: 'POST', path: `${B}/orders/${foreignOrderId}/calls`, auth: true, body: { result: 'picked_up' },
    expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders/calls — without auth', {
    method: 'POST', path: `${B}/orders/${orderC}/calls`, body: { result: 'picked_up' }, expect: { status: 401 },
  });
  await t.ok('orders/calls — log a call', {
    method: 'POST', path: `${B}/orders/${orderC}/calls`, auth: true, body: { result: 'picked_up', notes: 'confirmed by phone' },
  });
  const afterCall = await t.raw({ method: 'GET', path: `${B}/orders/${orderC}`, auth: true });
  t.results.push({
    label: `${t.currentModule} › orders — a picked_up call confirms the order`,
    ok: afterCall.json?.order?.status === 'confirmed' && afterCall.json?.order?.confirmationStatus === 'confirmed',
    issues: afterCall.json?.order?.status === 'confirmed' ? [] : [`status=${afterCall.json?.order?.status} confirmation=${afterCall.json?.order?.confirmationStatus}`],
  });
  await t.ok('orders/calls — list calls', { method: 'GET', path: `${B}/orders/${orderC}/calls`, auth: true });
  await t.check('orders/calls — list on unknown order', {
    method: 'GET', path: `${B}/orders/${MISS}/calls`, auth: true, expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  await t.check('orders/calls — list on another merchant order', {
    method: 'GET', path: `${B}/orders/${foreignOrderId}/calls`, auth: true, expect: { status: 404, code: 'ORDER_NOT_FOUND' },
  });
  // A rejected call on a not-yet-shipped order auto-cancels + restores stock.
  const qtyBeforeReject = await productQty();
  await t.ok('orders/calls — rejected call', {
    method: 'POST', path: `${B}/orders/${orderC}/calls`, auth: true, body: { result: 'rejected' },
  });
  const rejected = await t.raw({ method: 'GET', path: `${B}/orders/${orderC}`, auth: true });
  t.results.push({
    label: `${t.currentModule} › orders — rejected call cancels the order and restores stock`,
    ok: rejected.json?.order?.status === 'cancelled' && (await productQty()) === qtyBeforeReject + 1,
    issues: rejected.json?.order?.status === 'cancelled' ? [] : [`status=${rejected.json?.order?.status}`],
  });

  // ==========================================================================
  // SALES
  // ==========================================================================
  await t.check('sales — list without auth', { method: 'GET', path: `${B}/sales`, expect: { status: 401 } });
  await t.check('sales — paymentStatus enum', {
    method: 'GET', path: `${B}/sales?paymentStatus=owed`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentStatus', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('sales — paymentMethod enum (fr)', {
    method: 'GET', path: `${B}/sales?paymentMethod=goats`, auth: true, lang: 'fr',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentMethod' },
  });
  await t.check('sales — inverted date range (ar)', {
    method: 'GET', path: `${B}/sales?startDate=2025-06-02&endDate=2025-06-01`, auth: true, lang: 'ar',
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.ok('sales — list happy', { method: 'GET', path: `${B}/sales?limit=5`, auth: true });
  await t.ok('sales — stats', { method: 'GET', path: `${B}/sales/stats?period=month`, auth: true });
  await t.check('sales — get unknown', {
    method: 'GET', path: `${B}/sales/${MISS}`, auth: true, expect: { status: 404, code: 'SALE_NOT_FOUND' },
  });
  await t.check('sales — get another merchant sale', {
    method: 'GET', path: `${B}/sales/${foreignSaleId}`, auth: true, expect: { status: 404, code: 'SALE_NOT_FOUND' },
  });
  await t.ok('sales — get own sale', { method: 'GET', path: `${B}/sales/${t.ctx.saleId}`, auth: true });

  await t.check('sales — items missing', {
    method: 'POST', path: `${B}/sales`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items', fieldCode: 'LIST_REQUIRED' },
  });
  await t.check('sales — quantity zero', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line({ quantity: 0 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('sales — quantity fractional', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line({ quantity: 2.4 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('sales — unitPrice negative', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line({ unitPrice: -3 })] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].unitPrice' },
  });
  await t.check('sales — productId malformed', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [{ productId: '???', quantity: 1 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].productId', fieldCode: 'FIELD_INVALID_ID' },
  });
  await t.check('sales — unknown product', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line({ productId: MISS })] },
    expect: { status: 400, code: 'PRODUCTS_NOT_FOUND' },
  });
  await t.check('sales — product owned by another merchant', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line({ productId: t.ctx.foreignProductId })] },
    expect: { status: 400, code: 'PRODUCTS_NOT_FOUND' },
  });
  await t.check('sales — paymentMethod enum on create', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { paymentMethod: 'seashells', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentMethod' },
  });
  await t.check('sales — paymentStatus enum on create', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { paymentStatus: 'someday', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentStatus' },
  });
  await t.check('sales — saleDate far in the future', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { saleDate: '2999-01-01', items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'saleDate', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('sales — customerName too long', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { customerName: 'y'.repeat(400), items: [line()] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'customerName', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('sales — insufficient stock', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line({ quantity: 999999 })] },
    expect: { status: 422, code: 'SALE_INSUFFICIENT_STOCK' },
  });
  await t.check('sales — variant required (ar)', {
    method: 'POST', path: `${B}/sales`, auth: true, lang: 'ar', body: { items: [{ productId: VP, quantity: 1, unitPrice: 50 }] },
    expect: { status: 400, code: 'SALE_VARIANT_REQUIRED' },
  });
  await t.check('sales — variant not found', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [{ productId: VP, variantId: MISS, quantity: 1, unitPrice: 50 }] },
    expect: { status: 404, code: 'SALE_VARIANT_NOT_FOUND' },
  });

  const saleQtyBefore = await productQty();
  const saleRes = await t.ok('sales — create happy path (paid)', {
    method: 'POST', path: `${B}/sales`, auth: true,
    body: { customerName: 'Walk In', items: [line({ quantity: 2 })] }, expect: { status: 201 },
  });
  const saleA = saleRes?.json?.sale?.id;
  const saleQtyAfter = await productQty();
  t.results.push({
    label: `${t.currentModule} › sales — create deducted stock by 2`,
    ok: saleQtyAfter === saleQtyBefore - 2,
    issues: saleQtyAfter === saleQtyBefore - 2 ? [] : [`stock ${saleQtyBefore} → ${saleQtyAfter}`],
  });
  const saleCaisse = await t.raw({ method: 'GET', path: `${B}/caisse?limit=200`, auth: true });
  const saleRow = (saleCaisse.json?.transactions || []).find((x) => x.sourceId === saleA && x.isAutomatic);
  t.results.push({
    label: `${t.currentModule} › sales — a paid sale posts an automatic caisse income row`,
    ok: !!saleRow && saleRow.type === 'income' && saleRow.category === 'sale',
    issues: saleRow ? [] : ['no automatic caisse row for the paid sale'],
  });
  await t.check('sales — delete a paid sale (ar)', {
    method: 'DELETE', path: `${B}/sales/${saleA}`, auth: true, lang: 'ar',
    expect: { status: 422, code: 'SALE_DELETE_PAID' },
  });

  await t.check('sales — update unknown', {
    method: 'PUT', path: `${B}/sales/${MISS}`, auth: true, body: { paymentStatus: 'paid' },
    expect: { status: 404, code: 'SALE_NOT_FOUND' },
  });
  await t.check('sales — update another merchant sale', {
    method: 'PUT', path: `${B}/sales/${foreignSaleId}`, auth: true, body: { paymentStatus: 'paid' },
    expect: { status: 404, code: 'SALE_NOT_FOUND' },
  });
  await t.check('sales — update paymentStatus enum', {
    method: 'PUT', path: `${B}/sales/${saleA}`, auth: true, body: { paymentStatus: 'eventually' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentStatus' },
  });
  await t.check('sales — update amountPaid negative', {
    method: 'PUT', path: `${B}/sales/${saleA}`, auth: true, body: { amountPaid: -1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amountPaid' },
  });
  await t.ok('sales — set payment back to pending', {
    method: 'PUT', path: `${B}/sales/${saleA}`, auth: true, body: { paymentStatus: 'pending' },
  });
  const afterUnpay = await t.raw({ method: 'GET', path: `${B}/caisse?limit=200`, auth: true });
  const stillThere = (afterUnpay.json?.transactions || []).find((x) => x.sourceId === saleA && x.isAutomatic);
  t.results.push({
    label: `${t.currentModule} › sales — un-paying a sale removes the automatic caisse row`,
    ok: !stillThere,
    issues: stillThere ? ['automatic caisse row survived the un-payment'] : [],
  });
  await t.ok('sales — delete the now-unpaid sale', { method: 'DELETE', path: `${B}/sales/${saleA}`, auth: true });
  const saleQtyRestored = await productQty();
  t.results.push({
    label: `${t.currentModule} › sales — delete restored the stock`,
    ok: saleQtyRestored === saleQtyBefore,
    issues: saleQtyRestored === saleQtyBefore ? [] : [`stock ${saleQtyBefore} → ${saleQtyRestored} after create+delete`],
  });
  await t.check('sales — delete unknown', {
    method: 'DELETE', path: `${B}/sales/${MISS}`, auth: true, expect: { status: 404, code: 'SALE_NOT_FOUND' },
  });
  await t.check('sales — delete another merchant sale', {
    method: 'DELETE', path: `${B}/sales/${foreignSaleId}`, auth: true, expect: { status: 404, code: 'SALE_NOT_FOUND' },
  });

  // ==========================================================================
  // PURCHASES
  // ==========================================================================
  await t.check('purchases — list without auth', { method: 'GET', path: `${B}/purchases`, expect: { status: 401 } });
  await t.check('purchases — status enum', {
    method: 'GET', path: `${B}/purchases?status=shipped`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('purchases — paymentStatus enum', {
    method: 'GET', path: `${B}/purchases?paymentStatus=later`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentStatus' },
  });
  await t.ok('purchases — list happy', { method: 'GET', path: `${B}/purchases?limit=5`, auth: true });
  await t.ok('purchases — stats', { method: 'GET', path: `${B}/purchases/stats?period=month`, auth: true });
  await t.check('purchases — get unknown', {
    method: 'GET', path: `${B}/purchases/${MISS}`, auth: true, expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.check('purchases — get another merchant purchase (ar)', {
    method: 'GET', path: `${B}/purchases/${foreignPurchaseId}`, auth: true, lang: 'ar',
    expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.ok('purchases — get own purchase', { method: 'GET', path: `${B}/purchases/${t.ctx.purchaseId}`, auth: true });

  await t.check('purchases — items missing', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { supplierId: t.ctx.supplierId },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items', fieldCode: 'LIST_REQUIRED' },
  });
  await t.check('purchases — quantity zero', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { items: [{ productId: P, quantity: 0, unitCost: 10 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('purchases — quantity fractional', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { items: [{ productId: P, quantity: 3.7, unitCost: 10 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].quantity', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('purchases — unitCost negative', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { items: [{ productId: P, quantity: 1, unitCost: -4 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].unitCost' },
  });
  await t.check('purchases — supplierId malformed', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { supplierId: '###', items: [{ productId: P, quantity: 1, unitCost: 5 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'supplierId', fieldCode: 'FIELD_INVALID_ID' },
  });
  await t.check('purchases — supplierId unknown', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { supplierId: MISS, items: [{ productId: P, quantity: 1, unitCost: 5 }] },
    expect: { status: 404, code: 'SUPPLIER_NOT_FOUND' },
  });
  await t.check('purchases — unknown product', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { items: [{ productId: MISS, quantity: 1, unitCost: 5 }] },
    expect: { status: 400, code: 'PRODUCTS_NOT_FOUND' },
  });
  await t.check('purchases — product owned by another merchant', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { items: [{ productId: t.ctx.foreignProductId, quantity: 1, unitCost: 5 }] },
    expect: { status: 400, code: 'PRODUCTS_NOT_FOUND' },
  });
  await t.check('purchases — paymentMethod enum', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { paymentMethod: 'crypto', items: [{ productId: P, quantity: 1, unitCost: 5 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'paymentMethod' },
  });
  await t.check('purchases — variant required (fr)', {
    method: 'POST', path: `${B}/purchases`, auth: true, lang: 'fr', body: { items: [{ productId: VP, quantity: 1, unitCost: 5 }] },
    expect: { status: 400, code: 'PURCHASE_VARIANT_REQUIRED' },
  });
  await t.check('purchases — variant not found', {
    method: 'POST', path: `${B}/purchases`, auth: true, body: { items: [{ productId: VP, variantId: MISS, quantity: 1, unitCost: 5 }] },
    expect: { status: 404, code: 'PURCHASE_VARIANT_NOT_FOUND' },
  });

  const purRes = await t.ok('purchases — create happy path', {
    method: 'POST', path: `${B}/purchases`, auth: true,
    body: { supplierId: t.ctx.supplierId, items: [{ productId: P, quantity: 10, unitCost: 50 }] },
    expect: { status: 201 },
  });
  const purchaseA = purRes?.json?.purchase?.id;
  const purchaseAItem = purRes?.json?.purchase?.items?.[0]?.id;

  await t.check('purchases — update unknown', {
    method: 'PUT', path: `${B}/purchases/${MISS}`, auth: true, body: { status: 'cancelled' },
    expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.check('purchases — update another merchant purchase', {
    method: 'PUT', path: `${B}/purchases/${foreignPurchaseId}`, auth: true, body: { status: 'cancelled' },
    expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.check('purchases — update status enum', {
    method: 'PUT', path: `${B}/purchases/${purchaseA}`, auth: true, body: { status: 'delivered' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'status', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('purchases — PUT cannot set received', {
    method: 'PUT', path: `${B}/purchases/${purchaseA}`, auth: true, body: { status: 'received' },
    expect: { status: 422, code: 'PURCHASE_STATUS_VIA_RECEIVE' },
  });
  await t.check('purchases — PUT cannot set partial (ar)', {
    method: 'PUT', path: `${B}/purchases/${purchaseA}`, auth: true, lang: 'ar', body: { status: 'partial' },
    expect: { status: 422, code: 'PURCHASE_STATUS_VIA_RECEIVE' },
  });
  await t.check('purchases — update amountPaid negative', {
    method: 'PUT', path: `${B}/purchases/${purchaseA}`, auth: true, body: { amountPaid: -2 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amountPaid' },
  });
  await t.ok('purchases — pay part of it', {
    method: 'PUT', path: `${B}/purchases/${purchaseA}`, auth: true, body: { amountPaid: 100 },
  });

  // Receive
  await t.check('purchases/receive — items missing', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true, body: {},
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items', fieldCode: 'LIST_REQUIRED' },
  });
  await t.check('purchases/receive — itemId malformed', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true, body: { items: [{ itemId: '@@@', receivedQty: 1 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].itemId', fieldCode: 'FIELD_INVALID_ID' },
  });
  await t.check('purchases/receive — negative receivedQty', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true, body: { items: [{ itemId: purchaseAItem, receivedQty: -1 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].receivedQty' },
  });
  await t.check('purchases/receive — fractional receivedQty', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true, body: { items: [{ itemId: purchaseAItem, receivedQty: 1.5 }] },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'items[0].receivedQty', fieldCode: 'FIELD_MUST_BE_INTEGER' },
  });
  await t.check('purchases/receive — unknown purchase', {
    method: 'POST', path: `${B}/purchases/${MISS}/receive`, auth: true, body: { items: [{ itemId: purchaseAItem, receivedQty: 1 }] },
    expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.check('purchases/receive — another merchant purchase', {
    method: 'POST', path: `${B}/purchases/${foreignPurchaseId}/receive`, auth: true, body: { items: [{ itemId: purchaseAItem, receivedQty: 1 }] },
    expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.check('purchases/receive — unknown itemId', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true, body: { items: [{ itemId: MISS, receivedQty: 1 }] },
    expect: { status: 404, code: 'PURCHASE_ITEM_NOT_FOUND' },
  });
  await t.check('purchases/receive — over-receive (ar)', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true, lang: 'ar',
    body: { items: [{ itemId: purchaseAItem, receivedQty: 99 }] },
    expect: { status: 422, code: 'PURCHASE_OVER_RECEIVE' },
  });
  const recvBefore = await productQty();
  await t.ok('purchases/receive — receive 4 of 10', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true,
    body: { items: [{ itemId: purchaseAItem, receivedQty: 4 }] },
  });
  const recvAfter = await productQty();
  t.results.push({
    label: `${t.currentModule} › purchases — receiving 4 units raised the stock by 4`,
    ok: recvAfter === recvBefore + 4,
    issues: recvAfter === recvBefore + 4 ? [] : [`stock ${recvBefore} → ${recvAfter}, expected +4`],
  });
  const partial = await t.raw({ method: 'GET', path: `${B}/purchases/${purchaseA}`, auth: true });
  t.results.push({
    label: `${t.currentModule} › purchases — partial receipt sets status "partial"`,
    ok: partial.json?.purchase?.status === 'partial',
    issues: partial.json?.purchase?.status === 'partial' ? [] : [`status=${partial.json?.purchase?.status}`],
  });
  await t.check('purchases — delete a partially received purchase', {
    method: 'DELETE', path: `${B}/purchases/${purchaseA}`, auth: true,
    expect: { status: 422, code: 'PURCHASE_DELETE_NOT_PENDING' },
  });
  await t.check('purchases/receive — over-receive the remainder', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true,
    body: { items: [{ itemId: purchaseAItem, receivedQty: 7 }] },
    expect: { status: 422, code: 'PURCHASE_OVER_RECEIVE' },
  });
  await t.ok('purchases/receive — receive the remaining 6', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true,
    body: { items: [{ itemId: purchaseAItem, receivedQty: 6 }] },
  });
  await t.check('purchases/receive — already fully received', {
    method: 'POST', path: `${B}/purchases/${purchaseA}/receive`, auth: true,
    body: { items: [{ itemId: purchaseAItem, receivedQty: 1 }] },
    expect: { status: 422, code: 'PURCHASE_ALREADY_RECEIVED' },
  });
  await t.check('purchases — cannot leave the terminal "received" status', {
    method: 'PUT', path: `${B}/purchases/${purchaseA}`, auth: true, body: { status: 'cancelled' },
    expect: { status: 422, code: 'PURCHASE_INVALID_TRANSITION' },
  });

  // Cancelled purchase
  const purB = await t.ok('purchases — create one to cancel', {
    method: 'POST', path: `${B}/purchases`, auth: true,
    body: { supplierId: t.ctx.supplierId, items: [{ productId: P, quantity: 2, unitCost: 20 }] },
    expect: { status: 201 },
  });
  const purchaseB = purB?.json?.purchase?.id;
  const purchaseBItem = purB?.json?.purchase?.items?.[0]?.id;
  await t.ok('purchases — cancel it', {
    method: 'PUT', path: `${B}/purchases/${purchaseB}`, auth: true, body: { status: 'cancelled' },
  });
  await t.check('purchases/receive — into a cancelled purchase (fr)', {
    method: 'POST', path: `${B}/purchases/${purchaseB}/receive`, auth: true, lang: 'fr',
    body: { items: [{ itemId: purchaseBItem, receivedQty: 1 }] },
    expect: { status: 422, code: 'PURCHASE_RECEIVE_CANCELLED' },
  });
  await t.check('purchases — payments locked on a cancelled purchase', {
    method: 'PUT', path: `${B}/purchases/${purchaseB}`, auth: true, body: { amountPaid: 10 },
    expect: { status: 422, code: 'PURCHASE_CANCELLED_PAYMENT_LOCKED' },
  });
  await t.check('purchases — delete a cancelled purchase', {
    method: 'DELETE', path: `${B}/purchases/${purchaseB}`, auth: true,
    expect: { status: 422, code: 'PURCHASE_DELETE_NOT_PENDING' },
  });
  const purC = await t.ok('purchases — create a deletable one', {
    method: 'POST', path: `${B}/purchases`, auth: true,
    body: { items: [{ productId: P, quantity: 1, unitCost: 1 }] }, expect: { status: 201 },
  });
  await t.ok('purchases — delete it', { method: 'DELETE', path: `${B}/purchases/${purC?.json?.purchase?.id}`, auth: true });
  await t.check('purchases — delete unknown', {
    method: 'DELETE', path: `${B}/purchases/${MISS}`, auth: true, expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  await t.check('purchases — delete another merchant purchase', {
    method: 'DELETE', path: `${B}/purchases/${foreignPurchaseId}`, auth: true, expect: { status: 404, code: 'PURCHASE_NOT_FOUND' },
  });
  const paidPur = await t.ok('purchases — create a paid one', {
    method: 'POST', path: `${B}/purchases`, auth: true,
    body: { items: [{ productId: P, quantity: 1, unitCost: 30 }], amountPaid: 30 }, expect: { status: 201 },
  });
  await t.check('purchases — delete a paid purchase (ar)', {
    method: 'DELETE', path: `${B}/purchases/${paidPur?.json?.purchase?.id}`, auth: true, lang: 'ar',
    expect: { status: 422, code: 'PURCHASE_DELETE_PAID' },
  });

  // ==========================================================================
  // CLIENTS
  // ==========================================================================
  await t.check('clients — list without auth', { method: 'GET', path: `${B}/clients`, expect: { status: 401 } });
  await t.ok('clients — list happy', { method: 'GET', path: `${B}/clients`, auth: true });
  await t.check('clients — source enum', {
    method: 'GET', path: `${B}/clients?source=telepathy`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'source', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('clients — inverted date range', {
    method: 'GET', path: `${B}/clients?startDate=2025-06-02&endDate=2025-06-01`, auth: true,
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.check('clients — name missing', {
    method: 'POST', path: `${B}/clients`, auth: true, body: { phone: '0551000001' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('clients — name too long (ar)', {
    method: 'POST', path: `${B}/clients`, auth: true, lang: 'ar', body: { name: 'n'.repeat(250) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('clients — phone invalid', {
    method: 'POST', path: `${B}/clients`, auth: true, body: { name: 'Bad Phone', phone: '12ab' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'phone', fieldCode: 'FIELD_INVALID_PHONE' },
  });
  await t.check('clients — email invalid (fr)', {
    method: 'POST', path: `${B}/clients`, auth: true, lang: 'fr', body: { name: 'Bad Mail', email: 'not-an-email' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'email', fieldCode: 'FIELD_INVALID_EMAIL' },
  });
  await t.check('clients — source enum on create', {
    method: 'POST', path: `${B}/clients`, auth: true, body: { name: 'Src', source: 'carrier-pigeon' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'source' },
  });
  const dupPhone = `055${String(stamp).slice(-7)}`;
  await t.ok('clients — create happy path', {
    method: 'POST', path: `${B}/clients`, auth: true,
    body: { name: 'Commerce Client', phone: dupPhone, email: 'ok@example.com' }, expect: { status: 201 },
  });
  await t.check('clients — duplicate phone', {
    method: 'POST', path: `${B}/clients`, auth: true, body: { name: 'Twin', phone: dupPhone },
    expect: { status: 409, code: 'CLIENT_PHONE_EXISTS', noFields: true },
  });
  await t.check('clients — duplicate phone (ar)', {
    method: 'POST', path: `${B}/clients`, auth: true, lang: 'ar', body: { name: 'Twin', phone: dupPhone },
    expect: { status: 409, code: 'CLIENT_PHONE_EXISTS' },
  });
  await t.check('clients — get unknown', {
    method: 'GET', path: `${B}/clients/${MISS}`, auth: true, expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('clients — get another merchant client', {
    method: 'GET', path: `${B}/clients/${t.ctx.foreignClientId}`, auth: true, expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.ok('clients — get own client', { method: 'GET', path: `${B}/clients/${t.ctx.clientId}`, auth: true });
  await t.ok('clients — metrics', { method: 'GET', path: `${B}/clients/${t.ctx.clientId}/metrics`, auth: true });
  await t.check('clients — metrics on unknown client', {
    method: 'GET', path: `${B}/clients/${MISS}/metrics`, auth: true, expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('clients — metrics on another merchant client', {
    method: 'GET', path: `${B}/clients/${t.ctx.foreignClientId}/metrics`, auth: true,
    expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('clients — update unknown', {
    method: 'PUT', path: `${B}/clients/${MISS}`, auth: true, body: { name: 'x' },
    expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('clients — update another merchant client', {
    method: 'PUT', path: `${B}/clients/${t.ctx.foreignClientId}`, auth: true, body: { name: 'hijack' },
    expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('clients — update with an empty name', {
    method: 'PUT', path: `${B}/clients/${t.ctx.clientId}`, auth: true, body: { name: '   ' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('clients — update with a bad phone', {
    method: 'PUT', path: `${B}/clients/${t.ctx.clientId}`, auth: true, body: { phone: 'abcd' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'phone', fieldCode: 'FIELD_INVALID_PHONE' },
  });
  await t.ok('clients — update happy path', {
    method: 'PUT', path: `${B}/clients/${t.ctx.clientId}`, auth: true, body: { notes: 'VIP', isActive: true },
  });
  const delClient = await t.ok('clients — create one to delete', {
    method: 'POST', path: `${B}/clients`, auth: true, body: { name: 'Delete Me' }, expect: { status: 201 },
  });
  await t.ok('clients — delete it', { method: 'DELETE', path: `${B}/clients/${delClient?.json?.client?.id}`, auth: true });
  await t.check('clients — delete unknown', {
    method: 'DELETE', path: `${B}/clients/${MISS}`, auth: true, expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });
  await t.check('clients — delete another merchant client', {
    method: 'DELETE', path: `${B}/clients/${t.ctx.foreignClientId}`, auth: true, expect: { status: 404, code: 'CLIENT_NOT_FOUND' },
  });

  // ==========================================================================
  // CAISSE
  // ==========================================================================
  await t.check('caisse — list without auth', { method: 'GET', path: `${B}/caisse`, expect: { status: 401 } });
  await t.check('caisse — type enum', {
    method: 'GET', path: `${B}/caisse?type=refund`, auth: true,
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('caisse — category enum (fr)', {
    method: 'GET', path: `${B}/caisse?category=tacos`, auth: true, lang: 'fr',
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category' },
  });
  await t.check('caisse — inverted date range', {
    method: 'GET', path: `${B}/caisse?dateFrom=2025-06-02&dateTo=2025-06-01`, auth: true,
    expect: { status: 400, code: 'INVALID_DATE_RANGE' },
  });
  await t.ok('caisse — list happy', { method: 'GET', path: `${B}/caisse?limit=5`, auth: true });
  await t.ok('caisse — stats', { method: 'GET', path: `${B}/caisse/stats?period=month`, auth: true });
  await t.check('caisse — stats without auth', { method: 'GET', path: `${B}/caisse/stats`, expect: { status: 401 } });

  await t.check('caisse — type missing', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { amount: 10, category: 'other' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('caisse — type invalid', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'refund', amount: 10, category: 'other' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('caisse — category missing', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', amount: 10 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('caisse — category invalid (ar)', {
    method: 'POST', path: `${B}/caisse`, auth: true, lang: 'ar', body: { type: 'income', amount: 10, category: 'pizza' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'category', fieldCode: 'FIELD_INVALID_ENUM' },
  });
  await t.check('caisse — amount missing', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', category: 'other' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_REQUIRED' },
  });
  await t.check('caisse — amount zero', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', amount: 0, category: 'other' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('caisse — amount negative', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', amount: -20, category: 'other' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('caisse — amount not a number', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', amount: 'lots', category: 'other' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_NUMBER' },
  });
  await t.check('caisse — invalid date', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', amount: 5, category: 'other', date: 'yesterdayish' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'date', fieldCode: 'FIELD_INVALID_DATE' },
  });
  await t.check('caisse — reference too long', {
    method: 'POST', path: `${B}/caisse`, auth: true, body: { type: 'income', amount: 5, category: 'other', reference: 'r'.repeat(300) },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'reference', fieldCode: 'FIELD_TOO_LONG' },
  });
  await t.check('caisse — create without auth', {
    method: 'POST', path: `${B}/caisse`, body: { type: 'income', amount: 5, category: 'other' }, expect: { status: 401 },
  });
  const entry = await t.ok('caisse — create happy path', {
    method: 'POST', path: `${B}/caisse`, auth: true,
    body: { type: 'expense', amount: 250, category: 'rent', description: 'shop rent' }, expect: { status: 201 },
  });
  const entryId = entry?.json?.transaction?.id;
  await t.ok('caisse — update happy path', {
    method: 'PUT', path: `${B}/caisse/${entryId}`, auth: true, body: { amount: 300, category: 'utilities' },
  });
  await t.check('caisse — update amount to zero', {
    method: 'PUT', path: `${B}/caisse/${entryId}`, auth: true, body: { amount: 0 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'amount', fieldCode: 'FIELD_MUST_BE_POSITIVE' },
  });
  await t.check('caisse — update type enum', {
    method: 'PUT', path: `${B}/caisse/${entryId}`, auth: true, body: { type: 'transfer' },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'type' },
  });
  await t.check('caisse — update unknown', {
    method: 'PUT', path: `${B}/caisse/${MISS}`, auth: true, body: { amount: 5 },
    expect: { status: 404, code: 'TRANSACTION_NOT_FOUND' },
  });
  await t.check('caisse — update another merchant entry', {
    method: 'PUT', path: `${B}/caisse/${foreignCaisseId}`, auth: true, body: { amount: 5 },
    expect: { status: 404, code: 'TRANSACTION_NOT_FOUND' },
  });
  await t.check('caisse — delete unknown', {
    method: 'DELETE', path: `${B}/caisse/${MISS}`, auth: true, expect: { status: 404, code: 'TRANSACTION_NOT_FOUND' },
  });
  await t.check('caisse — delete another merchant entry (ar)', {
    method: 'DELETE', path: `${B}/caisse/${foreignCaisseId}`, auth: true, lang: 'ar',
    expect: { status: 404, code: 'TRANSACTION_NOT_FOUND' },
  });
  await t.ok('caisse — delete happy path', { method: 'DELETE', path: `${B}/caisse/${entryId}`, auth: true });

  // Automatic rows (created by a paid sale) are read-only.
  const autoSale = await t.ok('caisse — create a paid sale to get an automatic row', {
    method: 'POST', path: `${B}/sales`, auth: true, body: { items: [line()] }, expect: { status: 201 },
  });
  const autoSaleId = autoSale?.json?.sale?.id;
  const list = await t.raw({ method: 'GET', path: `${B}/caisse?limit=200`, auth: true });
  const auto = (list.json?.transactions || []).find((x) => x.sourceId === autoSaleId && x.isAutomatic);
  if (auto) {
    await t.check('caisse — edit an automatic entry', {
      method: 'PUT', path: `${B}/caisse/${auto.id}`, auth: true, body: { amount: 1 },
      expect: { status: 422, code: 'CAISSE_EDIT_AUTOMATIC' },
    });
    await t.check('caisse — edit an automatic entry (fr)', {
      method: 'PUT', path: `${B}/caisse/${auto.id}`, auth: true, lang: 'fr', body: { amount: 1 },
      expect: { status: 422, code: 'CAISSE_EDIT_AUTOMATIC' },
    });
    await t.check('caisse — delete an automatic entry (ar)', {
      method: 'DELETE', path: `${B}/caisse/${auto.id}`, auth: true, lang: 'ar',
      expect: { status: 422, code: 'CAISSE_DELETE_AUTOMATIC' },
    });
  } else {
    t.results.push({ label: `${t.currentModule} › caisse — automatic row from a paid sale`, ok: false, issues: ['no automatic caisse row found for the new sale'] });
  }
};
