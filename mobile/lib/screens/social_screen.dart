import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';

class SocialScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const SocialScreen({super.key, required this.onLoggedOut});

  @override
  SocialScreenState createState() => SocialScreenState();
}

class SocialScreenState extends State<SocialScreen> {
  bool loading = true;
  String? error;
  List<PageInfo> pages = [];
  Map<String, PageSummary> summaries = {};

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
      await Future.wait(p.map((page) async {
        try {
          sums[page.id] = await getPageSummary(page.id);
        } catch (_) {}
      }));
      if (!mounted) return;
      setState(() {
        pages = p;
        summaries = sums;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('social.title'))),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(error!,
                        style: const TextStyle(color: Zinc.textMuted)),
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
                  child: pages.isEmpty
                      ? ListView(children: [
                          const SizedBox(height: 120),
                          Center(
                              child: Text(t('social.empty'),
                                  style: const TextStyle(
                                      color: Zinc.textMuted))),
                        ])
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                          children: [
                            for (final page in pages) _pageCard(page),
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(t('social.connectHint'),
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      color: Zinc.textFaint, fontSize: 12)),
                            ),
                          ],
                        ),
                ),
    );
  }

  Widget _pageCard(PageInfo page) {
    final s = summaries[page.id];
    final avatar = s?.pictureUrl ?? page.pageAvatar;
    final aiOn = s?.agentEnabled ?? false;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: cardBox(),
      child: Column(
        children: [
          Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: avatar != null
                  ? Image.network(avatar,
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _letter(page))
                  : _letter(page),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(page.pageName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(page.isInstagram ? 'Instagram' : 'Facebook',
                      style: const TextStyle(
                          color: Zinc.textFaint, fontSize: 12)),
                ],
              ),
            ),
            Row(children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: aiOn ? Colors.white : Colors.transparent,
                  border: Border.all(
                      color: aiOn ? Colors.white : Zinc.textFaint),
                ),
              ),
              const SizedBox(width: 6),
              Text(aiOn ? t('social.aiOn') : t('social.aiOff'),
                  style: const TextStyle(
                      color: Zinc.textSecondary, fontSize: 11)),
            ]),
          ]),
          const SizedBox(height: 14),
          Container(height: 1, color: const Color(0x12FFFFFF)),
          const SizedBox(height: 12),
          Row(children: [
            _stat(t('social.stat.convos'), s?.convTotal),
            _stat(t('social.stat.msgs7d'), s?.msgs7d),
            _stat(t('social.stat.unread'), s?.convUnread),
            _stat(t('social.stat.products'), s?.products),
          ]),
        ],
      ),
    );
  }

  Widget _letter(PageInfo page) => Container(
        width: 48,
        height: 48,
        color: Zinc.inputBg,
        alignment: Alignment.center,
        child: Text(page.pageName.isNotEmpty ? page.pageName[0] : '?',
            style: const TextStyle(
                color: Zinc.textSecondary,
                fontSize: 20,
                fontWeight: FontWeight.w700)),
      );

  Widget _stat(String label, int? value) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${value ?? '–'}',
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(label.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(color: Zinc.textFaint, fontSize: 9)),
          ],
        ),
      );
}
