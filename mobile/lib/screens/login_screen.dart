import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool signup = false;
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool loading = false;
  String? error;

  bool get canSubmit =>
      email.text.trim().isNotEmpty &&
      password.text.isNotEmpty &&
      (!signup ||
          (firstName.text.trim().isNotEmpty && lastName.text.trim().isNotEmpty));

  Future<void> submit() async {
    if (!canSubmit || loading) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (signup) {
        await register(firstName.text.trim(), lastName.text.trim(),
            email.text.trim(), password.text);
      } else {
        await login(email.text.trim(), password.text);
      }
      widget.onLoggedIn();
    } on ApiException catch (e) {
      setState(() {
        error = signup
            ? (e.body?['message']?.toString() ?? t('signup.error'))
            : (e.status == 401 ? t('login.error') : e.message);
      });
    } catch (_) {
      setState(() => error = t('common.error'));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // language switch
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final l in const ['en', 'fr', 'ar'])
                        GestureDetector(
                          onTap: () => I18n.set(l),
                          child: Container(
                            margin: const EdgeInsetsDirectional.only(start: 4),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: I18n.lang.value == l
                                  ? Colors.white
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              l.toUpperCase(),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: I18n.lang.value == l
                                    ? Colors.black
                                    : Zinc.textMuted,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 60),
              // logo
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: const Text('D',
                    style: TextStyle(
                        color: Colors.black,
                        fontSize: 28,
                        fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: 24),
              Text(signup ? t('signup.title') : t('login.title'),
                  style: const TextStyle(
                      fontSize: 30, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(signup ? t('signup.subtitle') : t('login.subtitle'),
                  style:
                      const TextStyle(fontSize: 14, color: Zinc.textSecondary)),
              const SizedBox(height: 28),
              if (signup) ...[
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: firstName,
                        onChanged: (_) => setState(() {}),
                        decoration:
                            InputDecoration(hintText: t('signup.firstName')),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: lastName,
                        onChanged: (_) => setState(() {}),
                        decoration:
                            InputDecoration(hintText: t('signup.lastName')),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: email,
                onChanged: (_) => setState(() {}),
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                decoration: InputDecoration(hintText: t('login.email')),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: password,
                onChanged: (_) => setState(() {}),
                obscureText: true,
                onSubmitted: (_) => submit(),
                decoration: InputDecoration(hintText: t('login.password')),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!,
                    style:
                        const TextStyle(color: Zinc.textSecondary, fontSize: 13)),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    disabledBackgroundColor: const Color(0x66FFFFFF),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: canSubmit && !loading ? submit : null,
                  child: loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.black))
                      : Text(signup ? t('signup.submit') : t('login.submit'),
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: TextButton(
                  onPressed: () => setState(() {
                    signup = !signup;
                    error = null;
                  }),
                  child: Text(
                    signup ? t('signup.haveAccount') : t('login.noAccount'),
                    style:
                        const TextStyle(color: Zinc.textMuted, fontSize: 13),
                  ),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
