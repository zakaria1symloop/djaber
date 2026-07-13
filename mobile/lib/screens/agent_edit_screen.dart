import 'package:flutter/material.dart';
import '../api/api.dart';
import '../i18n.dart';
import '../theme.dart';

const _personalities = ['professional', 'friendly', 'casual', 'technical'];

class AgentEditScreen extends StatefulWidget {
  final AgentInfo agent;
  const AgentEditScreen({super.key, required this.agent});

  @override
  State<AgentEditScreen> createState() => _AgentEditScreenState();
}

class _AgentEditScreenState extends State<AgentEditScreen> {
  late final TextEditingController name;
  late final TextEditingController description;
  late final TextEditingController instructions;
  late final TextEditingController handoff;
  late String personality;
  late bool isActive;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    name = TextEditingController(text: widget.agent.name);
    description = TextEditingController(text: widget.agent.description ?? '');
    instructions =
        TextEditingController(text: widget.agent.customInstructions ?? '');
    handoff =
        TextEditingController(text: widget.agent.humanHandoffRules ?? '');
    personality = widget.agent.personality;
    isActive = widget.agent.isActive;
  }

  @override
  void dispose() {
    name.dispose();
    description.dispose();
    instructions.dispose();
    handoff.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (name.text.trim().isEmpty || saving) return;
    setState(() => saving = true);
    try {
      await updateAgent(widget.agent.id, {
        'name': name.text.trim(),
        'description': description.text.trim(),
        'personality': personality,
        'customInstructions': instructions.text,
        'humanHandoffRules': handoff.text,
        'isActive': isActive,
      });
      // reflect into the shared object so the list is fresh even before reload
      widget.agent
        ..name = name.text.trim()
        ..description = description.text.trim()
        ..personality = personality
        ..customInstructions = instructions.text
        ..humanHandoffRules = handoff.text
        ..isActive = isActive;
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(t('agent.saveError'))));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t('agent.edit'), style: const TextStyle(fontSize: 17)),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 18),
              ),
              onPressed:
                  name.text.trim().isEmpty || saving ? null : save,
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.black))
                  : Text(t('common.save'),
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          // Active toggle
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: cardBox(radius: 12),
            child: Row(children: [
              Expanded(
                child: Text(t('agent.activeToggle'),
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600)),
              ),
              Switch(
                  value: isActive,
                  onChanged: (v) => setState(() => isActive = v)),
            ]),
          ),
          const SizedBox(height: 18),
          _label(t('agent.name')),
          TextField(
              controller: name, onChanged: (_) => setState(() {})),
          const SizedBox(height: 14),
          _label(t('agent.description')),
          TextField(controller: description),
          const SizedBox(height: 14),
          _label(t('agent.personality')),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in _personalities)
                GestureDetector(
                  onTap: () => setState(() => personality = p),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 9),
                    decoration: BoxDecoration(
                      color: personality == p
                          ? Colors.white
                          : Colors.transparent,
                      border: Border.all(
                          color: personality == p
                              ? Colors.white
                              : Zinc.cardBorder),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(t('agent.p.$p'),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: personality == p
                              ? FontWeight.w700
                              : FontWeight.w400,
                          color: personality == p
                              ? Colors.black
                              : Zinc.textSecondary,
                        )),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          _label(t('agent.instructions')),
          TextField(
            controller: instructions,
            maxLines: 6,
            minLines: 4,
          ),
          const SizedBox(height: 14),
          _label(t('agent.handoff')),
          TextField(
            controller: handoff,
            maxLines: 6,
            minLines: 4,
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                color: Zinc.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1)),
      );
}
