import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';
import 'agent_edit_screen.dart';

class AgentsScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const AgentsScreen({super.key, required this.onLoggedOut});

  @override
  State<AgentsScreen> createState() => _AgentsScreenState();
}

class _AgentsScreenState extends State<AgentsScreen> {
  bool loading = true;
  String? error;
  List<AgentInfo> agents = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      error = null;
      final list = await getAgents();
      if (!mounted) return;
      setState(() {
        agents = list;
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

  Future<void> toggle(AgentInfo a, bool value) async {
    setState(() => a.isActive = value); // optimistic
    try {
      await updateAgent(a.id, {'isActive': value});
    } catch (_) {
      if (!mounted) return;
      setState(() => a.isActive = !value); // revert
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(t('agent.saveError'))));
    }
  }

  String personalityLabel(String p) {
    final key = 'agent.p.$p';
    final label = t(key);
    return label == key ? p : label;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('agents.title'))),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : error != null
              ? Center(
                  child: Text(error!,
                      style: const TextStyle(color: Zinc.textMuted)))
              : RefreshIndicator(
                  color: Colors.white,
                  backgroundColor: const Color(0xFF18181B),
                  onRefresh: load,
                  child: agents.isEmpty
                      ? ListView(children: [
                          const SizedBox(height: 120),
                          Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 40),
                              child: Text(t('agents.empty'),
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      color: Zinc.textMuted)),
                            ),
                          ),
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                          itemCount: agents.length,
                          itemBuilder: (_, i) => _card(agents[i]),
                        ),
                ),
    );
  }

  Widget _card(AgentInfo a) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context)
            .push(MaterialPageRoute(
                builder: (_) => AgentEditScreen(agent: a)))
            .then((_) => load());
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: cardBox(),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Zinc.inputBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Zinc.cardBorder),
              ),
              alignment: Alignment.center,
              child: const Text('✦',
                  style: TextStyle(fontSize: 18, color: Colors.white)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(a.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                  if ((a.description ?? '').isNotEmpty) ...[
                    const SizedBox(height: 1),
                    Text(a.description!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Zinc.textMuted, fontSize: 12)),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    '${personalityLabel(a.personality)}  ·  ${a.pagesCount} ${t('agents.pages')}  ·  ${a.productsCount} ${t('agents.products')}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Zinc.textFaint, fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(children: [
              Switch(value: a.isActive, onChanged: (v) => toggle(a, v)),
              Text(
                  (a.isActive ? t('agents.active') : t('agents.inactive'))
                      .toUpperCase(),
                  style: const TextStyle(
                      color: Zinc.textFaint, fontSize: 8)),
            ]),
          ],
        ),
      ),
    );
  }
}
