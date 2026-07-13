import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// The app talks directly to the production backend, same API as the web.
/// NOTE: IP-based sslip.io host — if the VPS IP changes, update it here.
const String baseUrl = 'https://djaber.72-60-190-211.sslip.io';

class ApiException implements Exception {
  final int status;
  final String message;
  final Map<String, dynamic>? body;
  ApiException(this.status, this.message, [this.body]);
  @override
  String toString() => 'ApiException($status): $message';
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
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    late http.Response res;
    final encoded = body == null ? null : jsonEncode(body);
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
