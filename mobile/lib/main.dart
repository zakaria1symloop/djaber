import 'package:flutter/material.dart';
import 'api/client.dart';
import 'i18n.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DjaberApp());
}

class DjaberApp extends StatefulWidget {
  const DjaberApp({super.key});

  @override
  State<DjaberApp> createState() => _DjaberAppState();
}

class _DjaberAppState extends State<DjaberApp> {
  bool? loggedIn; // null = loading

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await I18n.load();
    final token = await ApiClient.getToken();
    if (!mounted) return;
    setState(() => loggedIn = token != null);
  }

  @override
  Widget build(BuildContext context) {
    // Rebuild the whole app when the language changes (also flips RTL).
    return ValueListenableBuilder<String>(
      valueListenable: I18n.lang,
      builder: (context, lang, _) {
        return MaterialApp(
          title: 'Djaber',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          builder: (context, child) => Directionality(
            textDirection:
                I18n.isRTL ? TextDirection.rtl : TextDirection.ltr,
            child: child ?? const SizedBox.shrink(),
          ),
          home: loggedIn == null
              ? const Scaffold(
                  body: Center(
                      child:
                          CircularProgressIndicator(color: Colors.white)),
                )
              : loggedIn == true
                  ? Shell(onLoggedOut: () => setState(() => loggedIn = false))
                  : LoginScreen(
                      onLoggedIn: () => setState(() => loggedIn = true)),
        );
      },
    );
  }
}
