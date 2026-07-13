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
} from 'react-native';
import { login } from '../api';
import { registerForPushNotifications } from '../push';
import { useI18n, Lang } from '../i18n';
import { colors, radius, spacing } from '../theme';

const LANGS: Lang[] = ['en', 'fr', 'ar'];

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      registerForPushNotifications().catch(() => {});
      onLoggedIn();
    } catch (e: any) {
      setError(e?.status === 401 ? t('login.error') : e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
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

      <View style={styles.body}>
        <View style={styles.logoBox}>
          <Text style={styles.logoLetter}>D</Text>
        </View>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

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

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <Text style={styles.buttonText}>{t('login.submit')}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, marginTop: -60 },
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
  buttonText: { color: colors.black, fontSize: 15, fontWeight: '700' },
});
