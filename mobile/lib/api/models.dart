/// API models — defensive parsing (backend fields may be null).
library;

String _s(dynamic v, [String fallback = '']) => v?.toString() ?? fallback;
int _i(dynamic v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
bool _b(dynamic v) => v == true;

class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String plan;
  User.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']),
        email = _s(j['email']),
        firstName = _s(j['firstName']),
        lastName = _s(j['lastName']),
        plan = _s(j['plan'], 'individual');
}

class PageInfo {
  final String id;
  final String platform; // facebook | instagram
  final String pageId;
  final String pageName;
  final String? pageAvatar;
  PageInfo.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']),
        platform = _s(j['platform']),
        pageId = _s(j['pageId']),
        pageName = _s(j['pageName']),
        pageAvatar = j['pageAvatar']?.toString();

  bool get isInstagram => platform == 'instagram';
}

class PageSummary {
  final String? pictureUrl;
  final int convTotal, convActive, convUnread;
  final int msgs7d, incoming7d;
  final int products;
  final bool agentEnabled;
  final String? agentName;
  final String? agentId;
  final String? lastActivity;

  PageSummary.fromJson(Map<String, dynamic> j)
      : pictureUrl = j['pictureUrl']?.toString(),
        convTotal = _i((j['conversations'] ?? const {})['total']),
        convActive = _i((j['conversations'] ?? const {})['active']),
        convUnread = _i((j['conversations'] ?? const {})['unread']),
        msgs7d = _i((j['messages'] ?? const {})['last7d']),
        incoming7d = _i((j['messages'] ?? const {})['incoming7d']),
        products = _i(j['products']),
        agentEnabled = _b((j['agent'] ?? const {})['enabled']),
        agentName = (j['agent'] ?? const {})['name']?.toString(),
        agentId = (j['agent'] ?? const {})['id']?.toString(),
        lastActivity = j['lastActivity']?.toString();
}

class LastMessage {
  final String? text;
  final String timestamp;
  final bool isFromPage;
  LastMessage.fromJson(Map<String, dynamic> j)
      : text = j['text']?.toString(),
        timestamp = _s(j['timestamp']),
        isFromPage = _b(j['isFromPage']);
}

class ConversationSummary {
  final String id;
  final String senderId;
  final String? senderName;
  final String status;
  final bool aiPaused;
  final String? platform;
  final LastMessage? lastMessage;
  final String updatedAt;

  /// attached client-side
  PageInfo? page;

  ConversationSummary.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']),
        senderId = _s(j['senderId']),
        senderName = j['senderName']?.toString(),
        status = _s(j['status'], 'active'),
        aiPaused = _b(j['aiPaused']),
        platform = j['platform']?.toString(),
        lastMessage = j['lastMessage'] is Map<String, dynamic>
            ? LastMessage.fromJson(j['lastMessage'])
            : null,
        updatedAt = _s(j['updatedAt']);

  bool get awaitingReply => lastMessage != null && !lastMessage!.isFromPage;
}

class MessageItem {
  final String id;
  final String? text;
  final String timestamp;
  final bool isFromPage;
  final String? attachmentType;
  final String? attachmentUrl;
  final bool optimistic;

  MessageItem({
    required this.id,
    required this.text,
    required this.timestamp,
    required this.isFromPage,
    this.attachmentType,
    this.attachmentUrl,
    this.optimistic = false,
  });

  MessageItem.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']),
        text = j['text']?.toString(),
        timestamp = _s(j['timestamp']),
        isFromPage = _b(j['isFromPage']),
        attachmentType = j['attachmentType']?.toString(),
        attachmentUrl = j['attachmentUrl']?.toString(),
        optimistic = false;
}

class ConversationDetail {
  final String id;
  final String? senderName;
  final String senderId;
  final String status;
  final String platform;
  final bool aiPaused;
  ConversationDetail.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']),
        senderName = j['senderName']?.toString(),
        senderId = _s(j['senderId']),
        status = _s(j['status'], 'active'),
        platform = _s(j['platform'], 'facebook'),
        aiPaused = _b(j['aiPaused']);
}

class AgentInfo {
  final String id;
  String name;
  String? description;
  String personality;
  String? customInstructions;
  String? humanHandoffRules;
  bool isActive;
  final int pagesCount;
  final int productsCount;
  final List<String> pageNames;

  AgentInfo.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']),
        name = _s(j['name']),
        description = j['description']?.toString(),
        personality = _s(j['personality'], 'professional'),
        customInstructions = j['customInstructions']?.toString(),
        humanHandoffRules = j['humanHandoffRules']?.toString(),
        isActive = _b(j['isActive']),
        pagesCount = _i((j['_count'] ?? const {})['pages']),
        productsCount = _i((j['_count'] ?? const {})['products']),
        pageNames = ((j['pages'] as List?) ?? const [])
            .map((p) => _s(((p as Map<String, dynamic>)['page'] ?? const {})['pageName']))
            .where((n) => n.isNotEmpty)
            .toList();
}
