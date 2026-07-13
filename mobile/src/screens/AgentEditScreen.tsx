import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { updateAgent, Agent } from '../api';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';

const PERSONALITIES = ['professional', 'friendly', 'casual', 'technical'];

interface Props {
  agent: Agent;
  onBack: () => void;
  onSaved: () => void;
}

export default function AgentEditScreen({ agent, onBack, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [personality, setPersonality] = useState(agent.personality || 'professional');
  const [instructions, setInstructions] = useState(agent.customInstructions || '');
  const [handoff, setHandoff] = useState(agent.humanHandoffRules || '');
  const [isActive, setIsActive] = useState(agent.isActive);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateAgent(agent.id, {
        name: name.trim(),
        description: description.trim(),
        personality,
        customInstructions: instructions,
        humanHandoffRules: handoff,
        isActive,
      });
      onSaved();
    } catch {
      Alert.alert(t('common.error'), t('agent.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('agent.edit')}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!name.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <Text style={styles.saveText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Active toggle */}
        <View style={styles.activeRow}>
          <Text style={styles.label}>{t('agent.activeToggle')}</Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(255,255,255,0.6)' }}
            thumbColor={isActive ? colors.white : colors.textMuted}
          />
        </View>

        {/* Name */}
        <Text style={styles.label}>{t('agent.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.textMuted}
        />

        {/* Description */}
        <Text style={styles.label}>{t('agent.description')}</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholderTextColor={colors.textMuted}
        />

        {/* Personality */}
        <Text style={styles.label}>{t('agent.personality')}</Text>
        <View style={styles.chipRow}>
          {PERSONALITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, personality === p && styles.chipActive]}
              onPress={() => setPersonality(p)}
            >
              <Text style={[styles.chipText, personality === p && styles.chipTextActive]}>
                {t(`agent.p.${p}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom instructions */}
        <Text style={styles.label}>{t('agent.instructions')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={instructions}
          onChangeText={setInstructions}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.textMuted}
        />

        {/* Human handoff rules */}
        <Text style={styles.label}>{t('agent.handoff')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={handoff}
          onChangeText={setHandoff}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.textMuted}
        />

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    gap: spacing.sm,
  },
  backBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  backText: { color: colors.text, fontSize: 30, fontWeight: '300', marginTop: -4 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  saveBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: colors.black, fontSize: 13, fontWeight: '700' },
  body: { padding: spacing.lg },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  multiline: { minHeight: 110 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.black, fontWeight: '700' },
});
