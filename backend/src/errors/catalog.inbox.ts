import type { ErrorCatalog } from './catalog';

/** Module-specific codes (inbox / conversations / page AI settings / page analysis). */
export const inbox = {
  // ---- inbox (conversations, messages, insights, AI settings, summary) ----
  INBOX_LOAD_FAILED: {
    status: 500,
    en: 'We could not load the inbox. Please try again.',
    fr: 'Impossible de charger la boîte de réception. Veuillez réessayer.',
    ar: 'تعذّر تحميل صندوق الوارد. يرجى المحاولة مرة أخرى.',
  },
  INBOX_INSIGHTS_UNAVAILABLE: {
    status: 503,
    en: 'Insights could not be fetched from Facebook. The page may need to be reconnected, or insights may not be available yet.',
    fr: 'Impossible de récupérer les statistiques depuis Facebook. La page doit peut-être être reconnectée, ou les statistiques ne sont pas encore disponibles.',
    ar: 'تعذّر جلب الإحصاءات من فيسبوك. قد تحتاج الصفحة إلى إعادة الربط، أو أن الإحصاءات غير متاحة بعد.',
  },
  INBOX_INSIGHTS_FAILED: {
    status: 500,
    en: 'We could not load the page insights. Please try again.',
    fr: 'Impossible de charger les statistiques de la page. Veuillez réessayer.',
    ar: 'تعذّر تحميل إحصاءات الصفحة. يرجى المحاولة مرة أخرى.',
  },
  INBOX_AI_SETTINGS_LOAD_FAILED: {
    status: 500,
    en: 'We could not load the AI settings of this page. Please try again.',
    fr: 'Impossible de charger les paramètres IA de cette page. Veuillez réessayer.',
    ar: 'تعذّر تحميل إعدادات الذكاء الاصطناعي لهذه الصفحة. يرجى المحاولة مرة أخرى.',
  },
  INBOX_AI_SETTINGS_UPDATE_FAILED: {
    status: 500,
    en: 'We could not save the AI settings of this page. Please try again.',
    fr: 'Impossible d’enregistrer les paramètres IA de cette page. Veuillez réessayer.',
    ar: 'تعذّر حفظ إعدادات الذكاء الاصطناعي لهذه الصفحة. يرجى المحاولة مرة أخرى.',
  },
  INBOX_SUMMARY_FAILED: {
    status: 500,
    en: 'We could not load the page summary. Please try again.',
    fr: 'Impossible de charger le résumé de la page. Veuillez réessayer.',
    ar: 'تعذّر تحميل ملخّص الصفحة. يرجى المحاولة مرة أخرى.',
  },

  // ---- conversations ----
  CONVERSATION_LOAD_FAILED: {
    status: 500,
    en: 'We could not load this conversation. Please try again.',
    fr: 'Impossible de charger cette conversation. Veuillez réessayer.',
    ar: 'تعذّر تحميل هذه المحادثة. يرجى المحاولة مرة أخرى.',
  },
  CONVERSATION_UPDATE_FAILED: {
    status: 500,
    en: 'We could not update this conversation. Please try again.',
    fr: 'Impossible de mettre à jour cette conversation. Veuillez réessayer.',
    ar: 'تعذّر تحديث هذه المحادثة. يرجى المحاولة مرة أخرى.',
  },

  // ---- manual replies ----
  REPLY_OUTSIDE_WINDOW: {
    status: 422,
    en: 'This conversation is older than 24 hours. Facebook only allows replies within that window. Ask the customer to send a new message first.',
    fr: 'Cette conversation date de plus de 24 heures. Facebook n’autorise les réponses que pendant cette fenêtre. Demandez au client d’envoyer d’abord un nouveau message.',
    ar: 'مضى على هذه المحادثة أكثر من 24 ساعة. لا يسمح فيسبوك بالرد إلا خلال هذه المدة. اطلب من العميل إرسال رسالة جديدة أولًا.',
  },
  REPLY_SEND_FAILED: {
    status: 502,
    en: 'The message could not be delivered through {platform}. Please try again, or reconnect the page if the problem persists.',
    fr: 'Le message n’a pas pu être envoyé via {platform}. Veuillez réessayer, ou reconnectez la page si le problème persiste.',
    ar: 'تعذّر إرسال الرسالة عبر {platform}. يرجى المحاولة مرة أخرى، أو إعادة ربط الصفحة إذا استمرت المشكلة.',
  },
  REPLY_FAILED: {
    status: 500,
    en: 'We could not send your reply. Please try again.',
    fr: 'Impossible d’envoyer votre réponse. Veuillez réessayer.',
    ar: 'تعذّر إرسال ردّك. يرجى المحاولة مرة أخرى.',
  },

  // ---- page sync (pull conversations from Meta) ----
  PAGE_SYNC_TOKEN_EXPIRED: {
    status: 422,
    en: 'The connection to this page has expired. Please reconnect the page and try again.',
    fr: 'La connexion à cette page a expiré. Veuillez reconnecter la page puis réessayer.',
    ar: 'انتهت صلاحية الاتصال بهذه الصفحة. يرجى إعادة ربط الصفحة ثم المحاولة مرة أخرى.',
  },
  PAGE_SYNC_FAILED: {
    status: 502,
    en: 'We could not fetch the latest messages from {platform}. The page token may have expired — try reconnecting the page.',
    fr: 'Impossible de récupérer les derniers messages depuis {platform}. Le jeton de la page a peut-être expiré — essayez de reconnecter la page.',
    ar: 'تعذّر جلب أحدث الرسائل من {platform}. ربما انتهت صلاحية رمز الصفحة — حاول إعادة ربط الصفحة.',
  },

  // ---- page analysis (vision extraction of products from posts) ----
  PAGE_ANALYSIS_PERMISSION_REQUIRED: {
    status: 403,
    en: 'Facebook refused access to this page’s posts. Please reconnect the page so we can request the “read posts” permission.',
    fr: 'Facebook a refusé l’accès aux publications de cette page. Veuillez reconnecter la page afin que nous puissions demander l’autorisation « lecture des publications ».',
    ar: 'رفض فيسبوك الوصول إلى منشورات هذه الصفحة. يرجى إعادة ربط الصفحة حتى نتمكن من طلب إذن «قراءة المنشورات».',
  },
  PAGE_ANALYSIS_UPSTREAM_FAILED: {
    status: 502,
    en: 'We could not read the posts of this page from {platform}. Please try again later.',
    fr: 'Impossible de lire les publications de cette page depuis {platform}. Veuillez réessayer plus tard.',
    ar: 'تعذّر قراءة منشورات هذه الصفحة من {platform}. يرجى المحاولة لاحقًا.',
  },
  PAGE_ANALYSIS_FAILED: {
    status: 500,
    en: 'We could not analyze the posts of this page. Please try again.',
    fr: 'Impossible d’analyser les publications de cette page. Veuillez réessayer.',
    ar: 'تعذّر تحليل منشورات هذه الصفحة. يرجى المحاولة مرة أخرى.',
  },
  PAGE_ANALYSIS_IMPORT_FAILED: {
    status: 500,
    en: 'We could not import the extracted products. Please try again.',
    fr: 'Impossible d’importer les produits extraits. Veuillez réessayer.',
    ar: 'تعذّر استيراد المنتجات المستخرجة. يرجى المحاولة مرة أخرى.',
  },

  // ---- page agent (generate / apply an AI agent from the inbox) ----
  PAGE_AGENT_GENERATION_FAILED: {
    status: 500,
    en: 'We could not generate an AI agent for this page. Please try again.',
    fr: 'Impossible de générer un agent IA pour cette page. Veuillez réessayer.',
    ar: 'تعذّر إنشاء وكيل ذكاء اصطناعي لهذه الصفحة. يرجى المحاولة مرة أخرى.',
  },
  PAGE_AGENT_AI_UNAVAILABLE: {
    status: 503,
    en: 'The AI service did not respond. Please try again in a few minutes.',
    fr: 'Le service IA n’a pas répondu. Veuillez réessayer dans quelques minutes.',
    ar: 'لم تستجب خدمة الذكاء الاصطناعي. يرجى المحاولة بعد بضع دقائق.',
  },
  PAGE_AGENT_APPLY_FAILED: {
    status: 500,
    en: 'We could not apply the AI agent to this page. Please try again.',
    fr: 'Impossible d’appliquer l’agent IA à cette page. Veuillez réessayer.',
    ar: 'تعذّر تطبيق وكيل الذكاء الاصطناعي على هذه الصفحة. يرجى المحاولة مرة أخرى.',
  },
} as const satisfies ErrorCatalog;
