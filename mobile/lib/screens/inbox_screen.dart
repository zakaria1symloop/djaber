import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../util.dart';
import 'conversation_screen.dart';

enum InboxFilter { all, needsHuman, unread }

class InboxScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const InboxScreen({super.key, required this.onLoggedOut});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  bool loading = true;
  String? error;
  List<ConversationSummary> conversations = [];
  InboxFilter filter = InboxFilter.all;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      error = null;
      final pages = await getPages();
      final all = <ConversationSummary>[];
      await Future.wait(pages.map((page) async {
        try {
          final list = await getPageConversations(page.id);
          for (final c in list) {
            c.page = page;
          }
          all.addAll(list);
        } catch (_) {}
      }));
      all.sort((a, b) {
        if (a.aiPaused != b.aiPaused) return a.aiPaused ? -1 : 1;
        return b.updatedAt.compareTo(a.updatedAt);
      });
      if (!mounted) return;
      setState(() {
        conversations = all;
        loading = false;
      });
    } on ApiException catch (e) {
      if (e.status == 401) {
        await logout();
        widget.onLoggedOut();
        return;
      }
      if (!mounted) return;
      setState(() {
        error = e.message;
        loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        error = t('common.error');
        loading = false;
      });
    }
  }

  List<ConversationSummary> get filtered {
    switch (filter) {
      case InboxFilter.needsHuman:
        return conversations.where((c) => c.aiPaused).toList();
      case InboxFilter.unread:
        return conversations.where((c) => c.awaitingReply).toList();
      case InboxFilter.all:
        return conversations;
    }
  }

  @override
  Widget build(BuildContext context) {
    final needsHumanCount = conversations.where((c) => c.aiPaused).length;
    return Scaffold(
      appBar: AppBar(title: Text(t('inbox.title'))),
      body: Column(
        children: [
          // filter chips
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(
              children: [
                _chip(t('inbox.filter.all'), InboxFilter.all,
                    conversations.length),
                const SizedBox(width: 8),
                _chip(t('inbox.filter.needsHuman'), InboxFilter.needsHuman,
                    needsHumanCount),
                const SizedBox(width: 8),
                _chip(t('inbox.filter.unread'), InboxFilter.unread,
                    conversations.where((c) => c.awaitingReply).length),
              ],
            ),
          ),
          Expanded(
            child: loading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.white))
                : error != null
                    ? Center(
                        child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                            Text(error!,
                                style:
                                    const TextStyle(color: Zinc.textMuted)),
                            const SizedBox(height: 12),
                            OutlinedButton(
                                onPressed: () {
                                  setState(() => loading = true);
                                  load();
                                },
                                child: Text(t('common.retry'))),
                          ]))
                    : RefreshIndicator(
                        color: Colors.white,
                        backgroundColor: const Color(0xFF18181B),
                        onRefresh: load,
                        child: filtered.isEmpty
                            ? ListView(children: [
                                const SizedBox(height: 120),
                                Center(
                                    child: Text(t('inbox.empty'),
                                        style: const TextStyle(
                                            color: Zinc.textMuted))),
                              ])
                            : ListView.builder(
                                padding:
                                    const EdgeInsets.fromLTRB(20, 0, 20, 24),
                                itemCount: filtered.length,
                                itemBuilder: (_, i) => _card(filtered[i]),
                              ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, InboxFilter value, int count) {
    final active = filter == value;
    return GestureDetector(
      onTap: () => setState(() => filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          border: Border.all(color: active ? Colors.white : Zinc.cardBorder),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          count > 0 ? '$label · $count' : label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: active ? Colors.black : Zinc.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _card(ConversationSummary c) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context)
            .push(MaterialPageRoute(
              builder: (_) => ConversationScreen(
                conversationId: c.id,
                title: c.senderName ?? t('common.customer'),
                onLoggedOut: widget.onLoggedOut,
              ),
            ))
            .then((_) => load());
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration:
            cardBox(border: c.aiPaused ? const Color(0x40FFFFFF) : null),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: Zinc.inputBg,
              backgroundImage: c.page?.pageAvatar != null
                  ? NetworkImage(c.page!.pageAvatar!)
                  : null,
              child: c.page?.pageAvatar == null
                  ? Text((c.senderName ?? '?').characters.first.toUpperCase(),
                      style: const TextStyle(
                          color: Zinc.textSecondary,
                          fontWeight: FontWeight.w700))
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(c.senderName ?? t('common.customer'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                    Text(timeAgo(c.updatedAt),
                        style: const TextStyle(
                            color: Zinc.textFaint, fontSize: 11)),
                  ]),
                  const SizedBox(height: 3),
                  Text(c.lastMessage?.text ?? '📎',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: c.awaitingReply
                              ? Zinc.textSecondary
                              : Zinc.textMuted,
                          fontWeight: c.awaitingReply
                              ? FontWeight.w600
                              : FontWeight.w400,
                          fontSize: 13)),
                  const SizedBox(height: 6),
                  Row(children: [
                    Expanded(
                      child: Text(
                          '${c.page?.isInstagram == true ? 'IG' : 'FB'} · ${c.page?.pageName ?? ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: Zinc.textFaint, fontSize: 11)),
                    ),
                    if (c.aiPaused)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          border:
                              Border.all(color: const Color(0x59FFFFFF)),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text('🤝 ${t('inbox.needsHuman')}',
                            style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700)),
                      )
                    else
                      Text('✦ ${t('inbox.ai')}',
                          style: const TextStyle(
                              color: Zinc.textFaint, fontSize: 11)),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
