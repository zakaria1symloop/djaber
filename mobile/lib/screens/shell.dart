import 'package:flutter/material.dart';
import '../i18n.dart';
import 'home_screen.dart';
import 'inbox_screen.dart';
import 'social_screen.dart';
import 'agents_screen.dart';

/// Bottom-nav shell: Home / Inbox / Social / Agents.
/// IndexedStack keeps tabs alive; switching to a tab re-runs its load()
/// (throttled) so counts and badges never go stale.
class Shell extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const Shell({super.key, required this.onLoggedOut});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int index = 0;
  final homeKey = GlobalKey<HomeScreenState>();
  final inboxKey = GlobalKey<InboxScreenState>();
  final socialKey = GlobalKey<SocialScreenState>();
  final agentsKey = GlobalKey<AgentsScreenState>();
  final Map<int, DateTime> _lastLoad = {};

  void _onTab(int i) {
    setState(() => index = i);
    // refresh the selected tab, at most once per 15s
    final now = DateTime.now();
    final last = _lastLoad[i];
    if (last != null && now.difference(last).inSeconds < 15) return;
    _lastLoad[i] = now;
    switch (i) {
      case 0:
        homeKey.currentState?.load();
      case 1:
        inboxKey.currentState?.load();
      case 2:
        socialKey.currentState?.load();
      case 3:
        agentsKey.currentState?.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [
          HomeScreen(
            key: homeKey,
            onLoggedOut: widget.onLoggedOut,
            onOpenInbox: () => _onTab(1),
          ),
          InboxScreen(key: inboxKey, onLoggedOut: widget.onLoggedOut),
          SocialScreen(key: socialKey, onLoggedOut: widget.onLoggedOut),
          AgentsScreen(key: agentsKey, onLoggedOut: widget.onLoggedOut),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: _onTab,
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.home_outlined),
              selectedIcon: const Icon(Icons.home),
              label: t('tab.home')),
          NavigationDestination(
              icon: const Icon(Icons.chat_bubble_outline),
              selectedIcon: const Icon(Icons.chat_bubble),
              label: t('tab.inbox')),
          NavigationDestination(
              icon: const Icon(Icons.grid_view_outlined),
              selectedIcon: const Icon(Icons.grid_view),
              label: t('tab.social')),
          NavigationDestination(
              icon: const Icon(Icons.auto_awesome_outlined),
              selectedIcon: const Icon(Icons.auto_awesome),
              label: t('tab.agents')),
        ],
      ),
    );
  }
}
