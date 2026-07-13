import 'package:flutter/widgets.dart' show StringCharacters;
import 'i18n.dart';

/// First grapheme of a name, defensive against null AND empty strings
/// (''.characters.first throws).
String initial(String? s) {
  final v = s?.trim() ?? '';
  return v.isEmpty ? '?' : v.characters.first.toUpperCase();
}

String timeAgo(String iso) {
  final date = DateTime.tryParse(iso);
  if (date == null) return '';
  final diff = DateTime.now().difference(date);
  if (diff.inMinutes < 1) return t('common.now');
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 30) return '${diff.inDays}d';
  return '${date.day}/${date.month}/${date.year}';
}

String hhmm(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}
