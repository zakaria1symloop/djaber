# Handling API errors in the Flutter app

Everything the app calls returns the **same error shape**, and the text is
**already translated** into the language the user picked. You never build error
copy from HTTP status codes, and you never parse English strings.

Backend reference: [`backend/ERRORS.md`](../backend/ERRORS.md) ·
Live Swagger: <https://djaber.72-60-190-211.sslip.io/api/docs>

---

## 1. The three rules

1. **Show `message`.** It is a finished sentence in the user's language. Do not
   translate it again, do not prefix it with "Error:".
2. **Branch on `code`**, never on `message` and rarely on the raw status.
   Codes are stable forever; text and status can be refined.
3. **Bind `fields` to your inputs.** On a validation failure the server tells you
   exactly which field is wrong and why.

---

## 2. What the server sends

Every non-2xx answer:

```json
{
  "error":   "Bad Request",
  "code":    "VALIDATION_FAILED",
  "message": "Certains champs sont invalides. Veuillez vérifier le formulaire.",
  "fields": [
    { "field": "email",    "code": "FIELD_INVALID_EMAIL",      "message": "Veuillez saisir une adresse e-mail valide." },
    { "field": "password", "code": "AUTH_PASSWORD_TOO_SHORT",  "message": "Le mot de passe doit contenir au moins 8 caractères." }
  ]
}
```

| Field | Use it for |
|---|---|
| `code` | your `switch` — stable machine key |
| `message` | what you display, already translated |
| `fields[]` | per-input errors on a form (only on 400) |
| `params` | values interpolated in the message (`field`, `max`, `allowed`…), if you want to build custom copy |
| `error` | legacy HTTP label, ignore it |

### Language

`ApiClient` already sends `Accept-Language: <en|fr|ar>` from `I18n.lang` on
every request, so switching the app language switches the error language too.
Nothing to do — just make sure you never cache an error message across a
language change.

---

## 3. What you get in Dart

Already in `lib/api/client.dart`:

```dart
class ApiException implements Exception {
  final int status;                  // 0 when the request never left the phone
  final String message;              // translated, ready to display
  final String code;                 // e.g. 'PRODUCT_NOT_FOUND'
  final List<ApiFieldError> fields;  // per-input errors (400 only)

  Map<String, dynamic> get params;   // values used in the message (limit, max…)

  bool get isNetwork;       // status == 0  → offline / timeout
  bool get isValidation;    // 400 with fields
  bool get isUnauthorized;  // 401 → back to login
  bool get isBusinessRule;  // 422 → show `message` as-is
  bool get isRetryable;     // 0 or 5xx → offer "Retry"

  String? fieldMessage(String field);  // message for one input, or null
}
```

`ApiClient.request` throws **only** `ApiException` — network failures included —
so one `catch` covers everything.

---

## 4. The one helper to write

Put this next to your widgets and use it everywhere. It is the whole strategy in
20 lines.

```dart
/// Handles any API failure: routes 401 to login, shows everything else.
/// Returns the per-field errors so a form can highlight its inputs.
Map<String, String> handleApiError(
  BuildContext context,
  Object error, {
  VoidCallback? onRetry,
}) {
  if (error is! ApiException) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(t('common.error'))),
    );
    return const {};
  }

  // Session gone: never show a message, just send them to the login screen.
  if (error.isUnauthorized) {
    logoutAndGoToLogin(context);
    return const {};
  }

  // Form errors belong on the inputs, not in a toast.
  if (error.isValidation) {
    return { for (final f in error.fields) f.field: f.message };
  }

  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(error.message),
      action: (error.isRetryable && onRetry != null)
          ? SnackBarAction(label: t('common.retry'), onPressed: onRetry)
          : null,
    ),
  );
  return const {};
}
```

---

## 5. Recipes

### A form (login, product, order…)

```dart
class _ProductFormState extends State<ProductForm> {
  Map<String, String> _fieldErrors = {};

  Future<void> _save() async {
    setState(() => _fieldErrors = {});
    try {
      await createProduct(name: _name.text, sku: _sku.text, /* … */);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      final errors = handleApiError(context, e);
      if (mounted) setState(() => _fieldErrors = errors);
    }
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        TextFormField(
          controller: _name,
          decoration: InputDecoration(
            labelText: t('product.name'),
            errorText: _fieldErrors['name'],   // ← translated, straight from the API
          ),
        ),
        TextFormField(
          controller: _sku,
          decoration: InputDecoration(
            labelText: t('product.sku'),
            errorText: _fieldErrors['sku'],
          ),
        ),
      ]);
}
```

Nested fields use a path, so keep the key as sent:
`items[0].quantity`, `items[1].productId`.

### Session expired

`isUnauthorized` covers both "no token" and "token expired". There is no refresh
endpoint: clear the token and show the login screen.

```dart
Future<void> logoutAndGoToLogin(BuildContext context) async {
  await ApiClient.setToken(null);
  if (context.mounted) {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }
}
```

### Business rules (422) — show them, do not rewrite them

These are the ones the merchant can act on, and the wording is already right:

```dart
// ORDER_INSUFFICIENT_STOCK → "Stock insuffisant pour « Robe satin » (3 disponibles)."
// ORDER_DELETE_DELIVERED   → "Une commande livrée ne peut pas être supprimée."
// REPLY_OUTSIDE_WINDOW     → the 24 h Messenger window has closed
if (e.isBusinessRule) showDialog(/* … */ content: Text(e.message));
```

### Upsell moments — the two codes worth intercepting

```dart
switch (e.code) {
  case 'INSUFFICIENT_CREDITS':   // 402 — AI credits used up this period
  case 'PLAN_LIMIT_REACHED':     // 403 — e.g. e.params['limit'] agents on this plan
    showUpgradeSheet(context, reason: e.message);
    return;
}
```

### A record that vanished (404)

Another device deleted it, or it was never theirs. Do not leave a dead screen up:

```dart
if (e.status == 404) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
  Navigator.of(context).pop();   // back to the list, then refresh it
}
```

### Offline and flaky networks

```dart
if (e.isNetwork) {
  // Nothing reached the server: keep the user's input, show your offline banner,
  // and let them retry the exact same call.
  setState(() => _offline = true);
}
```

### Uploads

`FILE_TOO_LARGE` (413), `UPLOAD_INVALID_TYPE` (400) and `TOO_MANY_FILES` (400)
all carry a usable message (`e.params['maxMb']`, `e.params['allowed']`, `e.params['max']`).
Check size and extension before uploading so the user learns sooner.

---

## 6. Status cheat sheet

| Status | Meaning | What the app should do |
|---|---|---|
| 400 | validation | put `fields[]` on the inputs |
| 401 | not signed in / expired | clear token, go to login |
| 402 | AI credits exhausted | upgrade sheet |
| 403 | no right / plan limit | upgrade sheet or explain |
| 404 | missing or not theirs | toast + leave the screen |
| 409 | duplicate | point at the field (SKU, phone, e-mail) |
| 413 | too large | show the limit |
| 422 | business rule | show `message`, let them fix it |
| 429 | too many requests | back off, retry later |
| 5xx | our fault | generic message + Retry |
| 502 / 503 | Meta, courier or AI is down | say "try again shortly" + Retry |
| 0 | never left the phone | offline banner + Retry |

## 7. Codes you will actually meet

**Auth** `AUTH_INVALID_CREDENTIALS` · `AUTH_EMAIL_TAKEN` (409) ·
`AUTH_PASSWORD_TOO_SHORT` · `INVALID_TOKEN`

**Not found** `PRODUCT_NOT_FOUND` · `ORDER_NOT_FOUND` · `CLIENT_NOT_FOUND` ·
`PAGE_NOT_FOUND` · `CONVERSATION_NOT_FOUND` · `AGENT_NOT_FOUND`

**Duplicates** `PRODUCT_SKU_ALREADY_EXISTS` · `CLIENT_PHONE_EXISTS` ·
`CATEGORY_ALREADY_EXISTS` · `VARIANT_ALREADY_EXISTS`

**Stock and orders** `STOCK_INSUFFICIENT` · `ORDER_INSUFFICIENT_STOCK` ·
`ORDER_INVALID_TRANSITION` · `ORDER_DELETE_DELIVERED` · `PRODUCT_HAS_VARIANTS` ·
`CATEGORY_IN_USE`

**Inbox** `REPLY_OUTSIDE_WINDOW` (422) · `REPLY_SEND_FAILED` (502) ·
`PAGE_SYNC_TOKEN_EXPIRED` (422, tell them to reconnect the page)

**Field codes inside `fields[]`** `FIELD_REQUIRED` · `FIELD_INVALID` ·
`FIELD_MUST_BE_STRING` · `FIELD_MUST_BE_NUMBER` · `FIELD_MUST_BE_INTEGER` ·
`FIELD_MUST_BE_POSITIVE` · `FIELD_OUT_OF_RANGE` · `FIELD_INVALID_ENUM` ·
`FIELD_INVALID_EMAIL` · `FIELD_INVALID_PHONE` · `FIELD_TOO_LONG` ·
`FIELD_INVALID_DATE`

The full list of 350 codes lives in `backend/src/errors/catalog.*.ts`.

---

## 8. Don'ts

- Don't `if (e.message.contains('not found'))` — the text changes with the language.
- Don't show `code` to the user. It is for your `switch` and your logs.
- Don't translate `message` again in the app.
- Don't treat every failure as "something went wrong": 400 and 422 tell the user
  exactly what to fix, and hiding that is the difference between a merchant
  fixing their own order and calling support.
- Don't retry a 4xx automatically. Only 0, 5xx and 429 are worth retrying.

---

## 9. Trying it by hand

Force a language with `?lang=` (handy in curl, no need to change the app):

```bash
BASE=https://djaber.72-60-190-211.sslip.io

# Arabic 404
curl -H "Accept-Language: ar" $BASE/api/nope

# French validation with per-field errors
curl -H "Accept-Language: fr" -H "Content-Type: application/json" \
     -d '{"email":"bad"}' $BASE/api/auth/login

# Same call in English
curl "$BASE/api/auth/login?lang=en" -H "Content-Type: application/json" -d '{"email":"bad"}'
```

Every endpoint's documented error codes are in the Swagger at `/api/docs`.
