import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../i18n.dart';

/// The app talks directly to the production backend, same API as the web.
/// NOTE: IP-based sslip.io host — if the VPS IP changes, update it here.
const String baseUrl = 'https://djaber.72-60-190-211.sslip.io';

/// One field-level validation error returned by the API (message already translated).
class ApiFieldError {
  final String field;
  final String code;
  final String message;
  ApiFieldError(this.field, this.code, this.message);
}

/// Error contract of the backend: `message` is translated by the server for
/// the app language (sent as Accept-Language), `code` is a stable key to
/// branch on (e.g. AUTH_INVALID_CREDENTIALS, PRODUCT_NOT_FOUND,
/// VALIDATION_FAILED), `fields` lists per-field validation errors (HTTP 400).
class ApiException implements Exception {
  final int status;
  final String message;
  final String code;
  final List<ApiFieldError> fields;
  final Map<String, dynamic>? body;

  ApiException(this.status, this.message, [this.body])
      : code = (body?['code'] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN'))
            .toString(),
        fields = ((body?['fields'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map((f) => ApiFieldError(
                  f['field']?.toString() ?? '',
                  f['code']?.toString() ?? '',
                  f['message']?.toString() ?? '',
                ))
            .toList();

  /// Values the server interpolated into `message` (`field`, `max`, `allowed`,
  /// `limit`, `maxMb`…). Use them only to build custom UI — the ready-made
  /// sentence is already in `message`.
  Map<String, dynamic> get params =>
      (body?['params'] as Map?)?.cast<String, dynamic>() ?? const {};

  /// The request never reached the server (offline, DNS, timeout).
  bool get isNetwork => status == 0;

  /// A 400 carrying per-field errors — bind them to your form inputs.
  bool get isValidation => status == 400 && fields.isNotEmpty;

  /// Token missing, invalid or expired: send the user back to the login screen.
  bool get isUnauthorized => status == 401;

  /// A rule the merchant can act on (out of stock, forbidden transition…).
  /// `message` is already written for them — show it as-is.
  bool get isBusinessRule => status == 422;

  /// Our fault or an external service's: worth offering a Retry button.
  bool get isRetryable => status == 0 || status >= 500;

  /// Translated message for one field, or null.
  String? fieldMessage(String field) {
    for (final f in fields) {
      if (f.field == field) return f.message;
    }
    return null;
  }

  @override
  String toString() => 'ApiException($status $code): $message';
}

class ApiClient {
  static String? _token;

  static Future<String?> getToken() async {
    if (_token != null) return _token;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    return _token;
  }

  static Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null) {
      await prefs.remove('token');
    } else {
      await prefs.setString('token', token);
    }
  }

  /// JSON request helper. Throws [ApiException] on non-2xx.
  static Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      // The backend translates its error messages from this header (en / fr / ar).
      'Accept-Language': I18n.lang.value,
    };
    if (auth) {
      final token = await getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    late http.Response res;
    final encoded = body == null ? null : jsonEncode(body);
    try {
      switch (method) {
        case 'POST':
          res = await http.post(uri, headers: headers, body: encoded);
          break;
        case 'PUT':
          res = await http.put(uri, headers: headers, body: encoded);
          break;
        case 'PATCH':
          res = await http.patch(uri, headers: headers, body: encoded);
          break;
        case 'DELETE':
          res = await http.delete(uri, headers: headers, body: encoded);
          break;
        default:
          res = await http.get(uri, headers: headers);
      }
    } catch (_) {
      // No response at all (airplane mode, DNS, timeout). Surfaced as the same
      // ApiException as every other failure so callers catch ONE type; the UI
      // recognises it with `e.isNetwork` and shows its own offline copy.
      throw ApiException(0, 'Network error', const {'code': 'NETWORK_ERROR'});
    }

    dynamic json;
    try {
      json = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      json = null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (json is Map<String, dynamic>)
          ? (json['message'] ?? json['error'] ?? 'HTTP ${res.statusCode}')
              .toString()
          : 'HTTP ${res.statusCode}';
      throw ApiException(
          res.statusCode, msg, json is Map<String, dynamic> ? json : null);
    }
    return json;
  }
}
