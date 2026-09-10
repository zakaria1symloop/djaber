import type { ErrorCatalog } from './catalog';

/** Pages (Facebook / Instagram OAuth connect + disconnect) and Meta webhooks. */
export const pages = {
  // ---- OAuth connect -------------------------------------------------------
  PAGE_META_NOT_CONFIGURED: {
    status: 503,
    en: 'Facebook connection is not configured on this server yet.',
    fr: 'La connexion Facebook n’est pas encore configurée sur ce serveur.',
    ar: 'لم يتم إعداد الربط مع فيسبوك على هذا الخادم بعد.',
  },
  PAGE_INSTAGRAM_NOT_CONFIGURED: {
    status: 503,
    en: 'Instagram connection is not configured on this server yet.',
    fr: 'La connexion Instagram n’est pas encore configurée sur ce serveur.',
    ar: 'لم يتم إعداد الربط مع إنستغرام على هذا الخادم بعد.',
  },
  PAGE_OAUTH_CANCELLED: {
    status: 400,
    en: 'The authorization was cancelled.',
    fr: 'L’autorisation a été annulée.',
    ar: 'تم إلغاء عملية التفويض.',
  },
  PAGE_OAUTH_CODE_MISSING: {
    status: 400,
    en: 'No authorization code was received from Meta.',
    fr: 'Aucun code d’autorisation n’a été reçu de Meta.',
    ar: 'لم يتم استلام رمز التفويض من Meta.',
  },
  PAGE_OAUTH_STATE_INVALID: {
    status: 400,
    en: 'The authorization request is invalid or has expired. Please start again.',
    fr: 'La demande d’autorisation est invalide ou a expiré. Veuillez recommencer.',
    ar: 'طلب التفويض غير صالح أو انتهت صلاحيته. يرجى المحاولة من جديد.',
  },
  PAGE_OAUTH_FAILED: {
    status: 502,
    en: 'We could not connect your account with Meta. Please try again.',
    fr: 'Impossible de connecter votre compte avec Meta. Veuillez réessayer.',
    ar: 'تعذّر ربط حسابك مع Meta. يرجى المحاولة مرة أخرى.',
  },
  PAGE_INSTAGRAM_PENDING_APPROVAL: {
    status: 403,
    en: 'This Instagram account cannot be connected yet: the app is pending Meta approval. To test now, add this account as an Instagram Tester (App Roles) and accept the invite in the Instagram app.',
    fr: 'Ce compte Instagram ne peut pas encore être connecté : l’application est en attente d’approbation par Meta. Pour tester dès maintenant, ajoutez ce compte comme testeur Instagram (rôles de l’application) et acceptez l’invitation dans l’application Instagram.',
    ar: 'لا يمكن ربط حساب إنستغرام هذا بعد: التطبيق في انتظار موافقة Meta. للتجربة الآن، أضف هذا الحساب كمختبِر إنستغرام (أدوار التطبيق) واقبل الدعوة في تطبيق إنستغرام.',
  },
  PAGE_CONNECT_FAILED: {
    status: 500,
    en: 'We could not start the connection. Please try again.',
    fr: 'Impossible de démarrer la connexion. Veuillez réessayer.',
    ar: 'تعذّر بدء عملية الربط. يرجى المحاولة مرة أخرى.',
  },
  PAGE_LIST_FAILED: {
    status: 500,
    en: 'We could not load your pages. Please try again.',
    fr: 'Impossible de charger vos pages. Veuillez réessayer.',
    ar: 'تعذّر تحميل صفحاتك. يرجى المحاولة مرة أخرى.',
  },
  PAGE_DISCONNECT_FAILED: {
    status: 500,
    en: 'We could not disconnect this page. Please try again.',
    fr: 'Impossible de déconnecter cette page. Veuillez réessayer.',
    ar: 'تعذّر فصل هذه الصفحة. يرجى المحاولة مرة أخرى.',
  },

  // ---- Meta webhooks --------------------------------------------------------
  WEBHOOK_VERIFICATION_FAILED: {
    status: 403,
    en: 'Webhook verification failed: the verify token does not match.',
    fr: 'Échec de la vérification du webhook : le jeton de vérification ne correspond pas.',
    ar: 'فشل التحقق من الويب هوك: رمز التحقق غير مطابق.',
  },
  WEBHOOK_SIGNED_REQUEST_REQUIRED: {
    status: 400,
    en: 'The "signed_request" field is required.',
    fr: 'Le champ « signed_request » est obligatoire.',
    ar: 'الحقل "signed_request" إلزامي.',
  },
  WEBHOOK_SIGNED_REQUEST_INVALID: {
    status: 400,
    en: 'The "signed_request" is invalid or its signature does not match.',
    fr: 'Le champ « signed_request » est invalide ou sa signature ne correspond pas.',
    ar: 'الحقل "signed_request" غير صالح أو توقيعه غير مطابق.',
  },
  WEBHOOK_NOT_CONFIGURED: {
    status: 503,
    en: 'Meta webhooks are not configured on this server yet.',
    fr: 'Les webhooks Meta ne sont pas encore configurés sur ce serveur.',
    ar: 'لم يتم إعداد ويب هوك Meta على هذا الخادم بعد.',
  },
  WEBHOOK_FAILED: {
    status: 500,
    en: 'The webhook could not be processed.',
    fr: 'Le webhook n’a pas pu être traité.',
    ar: 'تعذّر معالجة الويب هوك.',
  },
} as const satisfies ErrorCatalog;
