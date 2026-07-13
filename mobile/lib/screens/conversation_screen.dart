import 'dart:async';
import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../util.dart';

class ConversationScreen extends StatefulWidget {
  final String conversationId;
  final String title;
  final VoidCallback onLoggedOut;
  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.title,
    required this.onLoggedOut,
  });

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  ConversationDetail? conversation;
  List<MessageItem> messages = [];
  bool loading = true;
  bool sending = false;
  bool resuming = false;
  final input = TextEditingController();
  final scroll = ScrollController();
  Timer? poll;
  int _loadSeq = 0; // drops out-of-order poll responses

  @override
  void initState() {
    super.initState();
    load();
    // near-realtime polling — skipped while a send is in flight so the
    // optimistic bubble never vanishes mid-send
    poll = Timer.periodic(const Duration(seconds: 8), (_) {
      if (!sending) load();
    });
  }

  @override
  void dispose() {
    poll?.cancel();
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final seq = ++_loadSeq;
    try {
      final res = await getConversationMessages(widget.conversationId);
      if (!mounted || seq != _loadSeq) return;
      // Only auto-scroll when the user is already pinned to the bottom
      // (or on first load) — never yank someone reading history.
      final stick = !scroll.hasClients ||
          scroll.position.pixels >= scroll.position.maxScrollExtent - 48;
      setState(() {
        conversation = res.conversation;
        // keep any in-flight optimistic bubble instead of wiping it
        final pending = messages.where((m) => m.optimistic).toList();
        messages = [...res.messages, ...pending];
        loading = false;
      });
      if (stick) _scrollToEnd();
    } on ApiException catch (e) {
      if (e.status == 401 && mounted) {
        await logout();
        if (mounted) widget.onLoggedOut();
        return;
      }
      if (mounted) setState(() => loading = false);
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) {
        scroll.jumpTo(scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty || sending) return;
    setState(() {
      sending = true;
      messages = [
        ...messages,
        MessageItem(
          id: 'tmp_${DateTime.now().millisecondsSinceEpoch}',
          text: text,
          timestamp: DateTime.now().toIso8601String(),
          isFromPage: true,
          optimistic: true,
        ),
      ];
    });
    input.clear();
    _scrollToEnd();

    try {
      await sendReply(widget.conversationId, text);
      await load(); // server list now contains the real message…
      if (mounted) {
        setState(() =>
            messages = messages.where((m) => !m.optimistic).toList());
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        messages = messages.where((m) => !m.optimistic).toList();
        input.text = text;
      });
      final outside = e.body?['outsideWindow'] == true;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              outside ? t('conv.outsideWindow') : t('conv.sendError'))));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        messages = messages.where((m) => !m.optimistic).toList();
        input.text = text;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(t('conv.sendError'))));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> resumeAi() async {
    if (resuming) return;
    setState(() => resuming = true);
    try {
      await setConversationStatus(widget.conversationId, 'active');
      if (!mounted) return;
      setState(() => conversation = conversation == null
          ? null
          : ConversationDetail.fromJson({
              'id': conversation!.id,
              'senderName': conversation!.senderName,
              'senderId': conversation!.senderId,
              'status': 'active',
              'platform': conversation!.platform,
              'aiPaused': false,
            }));
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('✦ ${t('conv.resumed')}')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(t('common.error'))));
    } finally {
      if (mounted) setState(() => resuming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = conversation?.senderName ?? widget.title;
    final platform = conversation?.platform == 'instagram'
        ? 'Instagram'
        : 'Facebook';
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w700)),
            Text(platform,
                style:
                    const TextStyle(color: Zinc.textFaint, fontSize: 11)),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (conversation?.aiPaused == true)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                padding: const EdgeInsets.all(12),
                decoration: cardBox(
                    radius: 12, border: const Color(0x40FFFFFF)),
                child: Row(children: [
                  Expanded(
                    child: Text('🤝 ${t('conv.aiPausedBanner')}',
                        style: const TextStyle(
                            color: Zinc.textSecondary, fontSize: 12)),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: resuming ? null : resumeAi,
                    child: resuming
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.black))
                        : Text('✦ ${t('conv.resumeAi')}',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            Expanded(
              child: loading
                  ? const Center(
                      child:
                          CircularProgressIndicator(color: Colors.white))
                  : ListView.builder(
                      controller: scroll,
                      padding: const EdgeInsets.all(16),
                      itemCount: messages.length,
                      itemBuilder: (_, i) => _bubble(messages[i]),
                    ),
            ),
            _composer(),
          ],
        ),
      ),
    );
  }

  Widget _bubble(MessageItem m) {
    final mine = m.isFromPage;
    final isImage = m.attachmentType == 'image' && m.attachmentUrl != null;
    return Align(
      alignment: mine
          ? AlignmentDirectional.centerEnd
          : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: mine ? Colors.white : Zinc.bubbleThem,
          border: mine ? null : Border.all(color: Zinc.cardBorder),
          borderRadius: BorderRadiusDirectional.only(
            topStart: const Radius.circular(16),
            topEnd: const Radius.circular(16),
            bottomStart: Radius.circular(mine ? 16 : 4),
            bottomEnd: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(m.attachmentUrl!,
                    width: 200,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Text('🖼️',
                        style: TextStyle(
                            fontSize: 24,
                            color:
                                mine ? Colors.black : Zinc.textSecondary))),
              )
            else if (m.text == null || m.text!.isEmpty)
              Text('📎 ${m.attachmentType ?? ''}',
                  style: TextStyle(
                      fontSize: 14,
                      color: mine ? Colors.black : Zinc.text)),
            if (m.text != null && m.text!.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: isImage ? 6 : 0),
                child: Text(m.text!,
                    style: TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: mine ? Colors.black : Zinc.text)),
              ),
            const SizedBox(height: 3),
            Text(hhmm(m.timestamp),
                style: TextStyle(
                    fontSize: 9,
                    color:
                        mine ? const Color(0x73000000) : Zinc.textFaint)),
          ],
        ),
      ),
    );
  }

  Widget _composer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Zinc.cardBorder)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: input,
              maxLines: 4,
              minLines: 1,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: t('conv.reply'),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: const BorderSide(color: Zinc.cardBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: const BorderSide(color: Zinc.cardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: const BorderSide(color: Color(0x66FFFFFF)),
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 44,
            height: 44,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black,
                disabledBackgroundColor: const Color(0x40FFFFFF),
                padding: EdgeInsets.zero,
                shape: const CircleBorder(),
              ),
              onPressed:
                  input.text.trim().isEmpty || sending ? null : send,
              child: sending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.black))
                  : const Icon(Icons.send, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}
