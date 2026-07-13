import 'client.dart';
import 'models.dart';

export 'client.dart' show ApiException, ApiClient, baseUrl;
export 'models.dart';

/// ---------- Auth ----------

Future<User> login(String email, String password) async {
  final res = await ApiClient.request('/api/auth/login',
      method: 'POST', body: {'email': email, 'password': password}, auth: false);
  await ApiClient.setToken(res['token'] as String);
  return User.fromJson(res['user'] as Map<String, dynamic>);
}

Future<User> register(
    String firstName, String lastName, String email, String password) async {
  final res = await ApiClient.request('/api/auth/register', method: 'POST', body: {
    'firstName': firstName,
    'lastName': lastName,
    'email': email,
    'password': password,
  }, auth: false);
  await ApiClient.setToken(res['token'] as String);
  return User.fromJson(res['user'] as Map<String, dynamic>);
}

Future<void> logout() async {
  // TODO(final step): unregister the FCM device token before clearing auth
  await ApiClient.setToken(null);
}

/// ---------- Pages ----------

Future<List<PageInfo>> getPages() async {
  final res = await ApiClient.request('/api/pages');
  return ((res['pages'] as List?) ?? const [])
      .map((p) => PageInfo.fromJson(p as Map<String, dynamic>))
      .toList();
}

Future<PageSummary> getPageSummary(String pageId) async {
  final res = await ApiClient.request('/api/pages/$pageId/summary');
  return PageSummary.fromJson(res as Map<String, dynamic>);
}

/// ---------- Conversations ----------

Future<List<ConversationSummary>> getPageConversations(String pageId,
    {String status = 'all'}) async {
  final res = await ApiClient.request(
      '/api/pages/$pageId/conversations?status=$status&limit=50');
  return ((res['conversations'] as List?) ?? const [])
      .map((c) => ConversationSummary.fromJson(c as Map<String, dynamic>))
      .toList();
}

class ConversationMessages {
  final ConversationDetail conversation;
  final List<MessageItem> messages;
  ConversationMessages(this.conversation, this.messages);
}

Future<ConversationMessages> getConversationMessages(String conversationId) async {
  final res =
      await ApiClient.request('/api/pages/conversations/$conversationId/messages');
  return ConversationMessages(
    ConversationDetail.fromJson(res['conversation'] as Map<String, dynamic>),
    ((res['messages'] as List?) ?? const [])
        .map((m) => MessageItem.fromJson(m as Map<String, dynamic>))
        .toList(),
  );
}

Future<void> sendReply(String conversationId, String message) async {
  await ApiClient.request('/api/pages/conversations/$conversationId/reply',
      method: 'POST', body: {'message': message});
}

/// Setting status to 'active' also resumes the AI (clears aiPaused).
Future<void> setConversationStatus(String conversationId, String status) async {
  await ApiClient.request('/api/pages/conversations/$conversationId',
      method: 'PATCH', body: {'status': status});
}

/// ---------- Agents ----------

Future<List<AgentInfo>> getAgents() async {
  final res = await ApiClient.request('/api/user-stock/agents');
  return ((res['agents'] as List?) ?? const [])
      .map((a) => AgentInfo.fromJson(a as Map<String, dynamic>))
      .toList();
}

Future<void> updateAgent(String agentId, Map<String, dynamic> patch) async {
  await ApiClient.request('/api/user-stock/agents/$agentId',
      method: 'PUT', body: patch);
}

/// ---------- Devices (push — wired in the notifications step) ----------

Future<void> registerDevice(String token, String platform) async {
  await ApiClient.request('/api/devices/register',
      method: 'POST', body: {'token': token, 'platform': platform});
}
