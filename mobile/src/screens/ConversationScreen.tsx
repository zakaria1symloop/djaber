import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  getConversationMessages,
  sendReply,
  setConversationStatus,
  Message,
  ConversationDetail,
} from '../api';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';

interface Props {
  conversationId: string;
  title: string;
  onBack: () => void;
}

export default function ConversationScreen({ conversationId, title, onBack }: Props) {
  const { t } = useI18n();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);
  const listRef = useRef<FlatList>(null);
  const sendingRef = useRef(false); // poll guard (state alone is stale inside the interval)
  const loadSeq = useRef(0); // drops out-of-order poll responses

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const res = await getConversationMessages(conversationId);
      if (seq !== loadSeq.current) return; // a newer request already resolved
      setConversation(res.conversation);
      // keep any in-flight optimistic bubble instead of wiping it
      setMessages((prev) => {
        const pending = prev.filter((m) => m.id.startsWith('tmp_'));
        return pending.length ? [...res.messages, ...pending] : res.messages;
      });
    } catch (e: any) {
      if (e?.status === 401) {
        onBack(); // Inbox's 401 handling clears the token and routes to login
        return;
      }
      // otherwise keep whatever we have; next poll retries
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    load();
    // near-realtime polling — skipped while a send is in flight so the
    // optimistic bubble never vanishes mid-send
    const iv = setInterval(() => {
      if (!sendingRef.current) load();
    }, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    sendingRef.current = true;

    // optimistic append
    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      text: message,
      timestamp: new Date().toISOString(),
      isFromPage: true,
      senderId: 'me',
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');

    try {
      await sendReply(conversationId, message);
      await load(); // server list now contains the real message…
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('tmp_'))); // …drop the optimistic copy
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(message);
      Alert.alert(
        t('common.error'),
        e?.body?.outsideWindow ? t('conv.outsideWindow') : t('conv.sendError')
      );
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  const resumeAi = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      await setConversationStatus(conversationId, 'active');
      setConversation((c) => (c ? { ...c, aiPaused: false, status: 'active' } : c));
      Alert.alert('✦', t('conv.resumed'));
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setResuming(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.isFromPage;
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {item.text ? (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
          ) : (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
              📎 {item.attachmentType || 'attachment'}
            </Text>
          )}
          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversation?.senderName || title}
          </Text>
          <Text style={styles.headerSub}>
            {conversation?.platform === 'instagram' ? 'Instagram' : 'Facebook'}
          </Text>
        </View>
      </View>

      {/* AI paused banner */}
      {conversation?.aiPaused && (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedText}>🤝 {t('conv.aiPausedBanner')}</Text>
          <TouchableOpacity style={styles.resumeBtn} onPress={resumeAi} disabled={resuming}>
            {resuming ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Text style={styles.resumeText}>✦ {t('conv.resumeAi')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t('conv.reply')}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <Text style={styles.sendText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  headerSub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.md,
  },
  pausedText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  resumeBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  resumeText: { color: colors.black, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: colors.bubbleMe, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.bubbleThem,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: colors.black },
  bubbleTime: { color: colors.textFaint, fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(0,0,0,0.45)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendText: { color: colors.black, fontSize: 16, fontWeight: '700' },
});
