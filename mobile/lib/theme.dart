import 'package:flutter/material.dart';

/// Monochrome design system — mirrors the Djaber web (black / white / zinc).
/// Emphasis via weight, size and opacity. No colored tags.
class Zinc {
  static const bg = Color(0xFF09090B); // zinc-950
  static const card = Color(0x0AFFFFFF); // white 4%
  static const cardBorder = Color(0x1AFFFFFF); // white 10%
  static const inputBg = Color(0x0FFFFFFF); // white 6%
  static const text = Colors.white;
  static const textSecondary = Color(0xFFA1A1AA); // zinc-400
  static const textMuted = Color(0xFF71717A); // zinc-500
  static const textFaint = Color(0xFF52525B); // zinc-600
  static const bubbleThem = Color(0x14FFFFFF); // white 8%
}

ThemeData buildTheme() {
  final base = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: Zinc.bg,
    colorScheme: const ColorScheme.dark(
      surface: Zinc.bg,
      primary: Colors.white,
      onPrimary: Colors.black,
      secondary: Zinc.textSecondary,
      error: Colors.white,
    ),
    useMaterial3: true,
  );

  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: Zinc.text,
      displayColor: Zinc.text,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Zinc.bg,
      foregroundColor: Zinc.text,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: Zinc.text,
        fontSize: 22,
        fontWeight: FontWeight.w800,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Zinc.bg,
      indicatorColor: const Color(0x14FFFFFF),
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: selected ? Zinc.text : Zinc.textFaint,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          size: 22,
          color: selected ? Zinc.text : Zinc.textFaint,
        );
      }),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Zinc.inputBg,
      hintStyle: const TextStyle(color: Zinc.textMuted, fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Zinc.cardBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Zinc.cardBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0x66FFFFFF)),
      ),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? const Color(0x99FFFFFF)
              : const Color(0x26FFFFFF)),
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? Colors.white : Zinc.textMuted),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Color(0xFF18181B),
      contentTextStyle: TextStyle(color: Zinc.text),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

/// Shared card decoration
BoxDecoration cardBox({double radius = 16, Color? border}) => BoxDecoration(
      color: Zinc.card,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: border ?? Zinc.cardBorder),
    );
