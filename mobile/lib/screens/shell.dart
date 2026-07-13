import 'package:flutter/material.dart';
import '../i18n.dart';
import 'home_screen.dart';
import 'inbox_screen.dart';
import 'social_screen.dart';
import 'agents_screen.dart';

/// Bottom-nav shell: Home / Inbox / Social / Agents.
class Shell extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const Shell({super.key, required this.onLoggedOut});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [
          HomeScreen(
            onLoggedOut: widget.onLoggedOut,
            onOpenInbox: () => setState(() => index = 1),
          ),
          InboxScreen(onLoggedOut: widget.onLoggedOut),
          SocialScreen(onLoggedOut: widget.onLoggedOut),
          AgentsScreen(onLoggedOut: widget.onLoggedOut),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
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
