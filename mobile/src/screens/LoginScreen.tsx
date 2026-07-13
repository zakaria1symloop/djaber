import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { login, register } from '../api';
import { registerForPushNotifications } from '../push';
import { useI18n, Lang } from '../i18n';
import { colors, radius, spacing } from '../theme';

const LANGS: Lang[] = ['en', 'fr', 'ar'];

type Mode = 'login' | 'signup';

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<Mode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const canSubmit =
    email.trim() && password && (!isSignup || (firstName.trim() && lastName.trim()));

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (isSignup) {
        await register(firstName.trim(), lastName.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      registerForPushNotifications().catch(() => {});
      onLoggedIn();
    } catch (e: any) {
      if (isSignup) {
        // surface the backend's message (e.g. email already in use) when present
        setError(e?.body?.message || e?.body?.errors?.[0]?.msg || t('signup.error'));
      } else {
        setError(e?.status === 401 ? t('login.error') : e?.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Language switch */}
      <View style={styles.langRow}>
        {LANGS.map((l) => (
          <TouchableOpacity
            key={l}
            onPress={() => setLang(l)}
            style={[styles.langBtn, lang === l && styles.langBtnActive]}
          >
            <Text style={[styles.langText, lang === l && styles.langTextActive]}>
              {l.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoLetter}>D</Text>
        </View>
        <Text style={styles.title}>{isSignup ? t('signup.title') : t('login.title')}</Text>
        <Text style={styles.subtitle}>
          {isSignup ? t('signup.subtitle') : t('login.subtitle')}
        </Text>

        {isSignup && (
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder={t('signup.firstName')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder={t('signup.lastName')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={t('login.email')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t('login.password')}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={submit}
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <Text style={styles.buttonText}>
              {isSignup ? t('signup.submit') : t('login.submit')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Mode switch */}
        <TouchableOpacity style={styles.switchBtn} onPress={switchMode}>
          <Text style={styles.switchText}>
            {isSignup ? t('signup.haveAccount') : t('login.noAccount')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  langBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langBtnActive: { backgroundColor: colors.white },
  langText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  langTextActive: { color: colors.black },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoLetter: { color: colors.black, fontSize: 28, fontWeight: '800' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: spacing.xs },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.xl },
  nameRow: { flexDirection: 'row', gap: spacing.md },
  nameInput: { flex: 1 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  error: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md },
  button: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.black, fontSize: 15, fontWeight: '700' },
  switchBtn: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm },
  switchText: { color: colors.textMuted, fontSize: 13 },
});
