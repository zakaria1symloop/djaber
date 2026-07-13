import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';
import '../util.dart';
import 'conversation_screen.dart';

/// Rich dashboard: KPI grid, needs-human queue, pages strip, recent activity.
class HomeScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  final VoidCallback onOpenInbox;
  const HomeScreen(
      {super.key, required this.onLoggedOut, required this.onOpenInbox});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool loading = true;
  String? error;
  List<PageInfo> pages = [];
  Map<String, PageSummary> summaries = {};
  List<ConversationSummary> conversations = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      error = null;
      final p = await getPages();
      final sums = <String, PageSummary>{};
      final convs = <ConversationSummary>[];
      await Future.wait(p.map((page) async {
        try {
          sums[page.id] = await getPageSummary(page.id);
        } catch (_) {}
        try {
          final list = await getPageConversations(page.id);
          for (final c in list) {
            c.page = page;
          }
          convs.addAll(list);
        } catch (_) {}
      }));
      convs.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      if (!mounted) return;
      setState(() {
        pages = p;
        summaries = sums;
        conversations = convs;
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

  int get unread =>
      summaries.values.fold(0, (sum, s) => sum + s.convUnread);
  int get msgs7d => summaries.values.fold(0, (sum, s) => sum + s.msgs7d);
  int get convTotal =>
      summaries.values.fold(0, (sum, s) => sum + s.convTotal);
  List<ConversationSummary> get needsHuman =>
      conversations.where((c) => c.aiPaused).toList();

  void openConversation(ConversationSummary c) {
    Navigator.of(context)
        .push(MaterialPageRoute(
          builder: (_) => ConversationScreen(
            conversationId: c.id,
            title: c.senderName ?? t('common.customer'),
            onLoggedOut: widget.onLoggedOut,
          ),
        ))
        .then((_) => load());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: Colors.white,
          backgroundColor: const Color(0xFF18181B),
          onRefresh: load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              _header(),
              const SizedBox(height: 20),
              if (loading)
                const Padding(
                  padding: EdgeInsets.only(top: 120),
                  child: Center(
                      child: CircularProgressIndicator(color: Colors.white)),
                )
              else if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 120),
                  child: Column(children: [
                    Text(error!,
                        style: const TextStyle(color: Zinc.textMuted)),
                    const SizedBox(height: 12),
                    OutlinedButton(
                        onPressed: () {
                          setState(() => loading = true);
                          load();
                        },
                        child: Text(t('common.retry'))),
                  ]),
                )
              else ...[
                _kpiGrid(),
                const SizedBox(height: 24),
                _needsHumanSection(),
                const SizedBox(height: 24),
                _pagesSection(),
                const SizedBox(height: 24),
                _recentSection(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(12)),
          alignment: Alignment.center,
          child: const Text('D',
              style: TextStyle(
                  color: Colors.black,
                  fontSize: 20,
                  fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('home.greeting'),
                  style:
                      const TextStyle(color: Zinc.textMuted, fontSize: 12)),
              Text(t('app.name'),
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
        // language cycle
        GestureDetector(
          onTap: () {
            const order = ['en', 'fr', 'ar'];
            final next = order[
                (order.indexOf(I18n.lang.value) + 1) % order.length];
            I18n.set(next);
          },
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              border: Border.all(color: Zinc.cardBorder),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(I18n.lang.value.toUpperCase(),
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Zinc.textSecondary)),
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          tooltip: t('home.logout'),
          icon: const Icon(Icons.logout, size: 18, color: Zinc.textMuted),
          onPressed: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: const Color(0xFF18181B),
                title: Text(t('home.logout'),
                    style: const TextStyle(fontSize: 16)),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('✕',
                          style: TextStyle(color: Zinc.textMuted))),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: Text(t('home.logout'),
                          style: const TextStyle(color: Colors.white))),
                ],
              ),
            );
            if (ok == true) {
              await logout();
              widget.onLoggedOut();
            }
          },
        ),
      ],
    );
  }

  Widget _kpiGrid() {
    final items = [
      (t('home.kpi.needsHuman'), needsHuman.length, true),
      (t('home.kpi.unread'), unread, false),
      (t('home.kpi.msgs7d'), msgs7d, false),
      (t('home.kpi.convos'), convTotal, false),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t('home.overview').toUpperCase(),
            style: const TextStyle(
                color: Zinc.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5)),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.9,
          children: [
            for (final (label, value, highlight) in items)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: cardBox(
                    border: highlight && value > 0
                        ? const Color(0x59FFFFFF)
                        : null),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('$value',
                        style: const TextStyle(
                            fontSize: 26, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Zinc.textMuted, fontSize: 11)),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _needsHumanSection() {
    final list = needsHuman.take(5).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text('🤝 ${t('home.needsHuman')}'.toUpperCase(),
                  style: const TextStyle(
                      color: Zinc.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5)),
            ),
            if (needsHuman.length > list.length)
              GestureDetector(
                onTap: widget.onOpenInbox,
                child: Text(t('home.seeAll'),
                    style: const TextStyle(
                        color: Zinc.textSecondary, fontSize: 12)),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (list.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: cardBox(),
            child: Text(t('home.needsHumanEmpty'),
                style:
                    const TextStyle(color: Zinc.textMuted, fontSize: 13)),
          )
        else
          for (final c in list)
            GestureDetector(
              onTap: () => openConversation(c),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: cardBox(border: const Color(0x40FFFFFF)),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: Zinc.inputBg,
                      child: Text(
                          (c.senderName ?? '?')
                              .characters
                              .first
                              .toUpperCase(),
                          style: const TextStyle(
                              color: Zinc.textSecondary,
                              fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.senderName ?? t('common.customer'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14)),
                          const SizedBox(height: 2),
                          Text(c.lastMessage?.text ?? '📎',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: Zinc.textMuted, fontSize: 12)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(timeAgo(c.updatedAt),
                        style: const TextStyle(
                            color: Zinc.textFaint, fontSize: 11)),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  Widget _pagesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t('home.pages').toUpperCase(),
            style: const TextStyle(
                color: Zinc.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5)),
        const SizedBox(height: 12),
        SizedBox(
          height: 108,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: pages.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final page = pages[i];
              final s = summaries[page.id];
              final avatar = s?.pictureUrl ?? page.pageAvatar;
              return Container(
                width: 190,
                padding: const EdgeInsets.all(14),
                decoration: cardBox(),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: avatar != null
                          ? Image.network(avatar,
                              width: 42,
                              height: 42,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  _pageLetter(page))
                          : _pageLetter(page),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(page.pageName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13)),
                          const SizedBox(height: 2),
                          Text(page.isInstagram ? 'Instagram' : 'Facebook',
                              style: const TextStyle(
                                  color: Zinc.textFaint, fontSize: 11)),
                          const SizedBox(height: 4),
                          Row(children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: (s?.agentEnabled ?? false)
                                    ? Colors.white
                                    : Colors.transparent,
                                border: Border.all(
                                    color: (s?.agentEnabled ?? false)
                                        ? Colors.white
                                        : Zinc.textFaint),
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                                (s?.agentEnabled ?? false)
                                    ? t('social.aiOn')
                                    : t('social.aiOff'),
                                style: const TextStyle(
                                    color: Zinc.textSecondary,
                                    fontSize: 10)),
                          ]),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _pageLetter(PageInfo page) => Container(
        width: 42,
        height: 42,
        color: Zinc.inputBg,
        alignment: Alignment.center,
        child: Text(page.pageName.isNotEmpty ? page.pageName[0] : '?',
            style: const TextStyle(
                color: Zinc.textSecondary,
                fontSize: 18,
                fontWeight: FontWeight.w700)),
      );

  Widget _recentSection() {
    final list = conversations.take(5).toList();
    if (list.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(t('home.recent').toUpperCase(),
                  style: const TextStyle(
                      color: Zinc.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5)),
            ),
            GestureDetector(
              onTap: widget.onOpenInbox,
              child: Text(t('home.seeAll'),
                  style: const TextStyle(
                      color: Zinc.textSecondary, fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (final c in list)
          GestureDetector(
            onTap: () => openConversation(c),
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: cardBox(),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: Zinc.inputBg,
                    child: Text(
                        (c.senderName ?? '?').characters.first.toUpperCase(),
                        style: const TextStyle(
                            color: Zinc.textSecondary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Expanded(
                            child: Text(
                                c.senderName ?? t('common.customer'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13)),
                          ),
                          Text(timeAgo(c.updatedAt),
                              style: const TextStyle(
                                  color: Zinc.textFaint, fontSize: 11)),
                        ]),
                        const SizedBox(height: 2),
                        Text(c.lastMessage?.text ?? '📎',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: c.awaitingReply
                                    ? Zinc.textSecondary
                                    : Zinc.textMuted,
                                fontSize: 12,
                                fontWeight: c.awaitingReply
                                    ? FontWeight.w600
                                    : FontWeight.w400)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
