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
  PAGE_NONE_AVAILABLE: {
    status: 404,
    en: 'No Facebook Page is linked to this account. Create a Page, or ask its owner to give you a role on it, then try again.',
    fr: 'Aucune page Facebook n’est liée à ce compte. Créez une page, ou demandez à son propriétaire de vous attribuer un rôle, puis réessayez.',
    ar: 'لا توجد أي صفحة فيسبوك مرتبطة بهذا الحساب. أنشئ صفحة، أو اطلب من مالكها منحك دورًا عليها، ثم أعد المحاولة.',
  },
  PAGE_NONE_CONNECTED: {
    status: 422,
    en: 'None of your {total} Facebook Page(s) could be connected. Check the details for each page and try again.',
    fr: 'Aucune de vos {total} page(s) Facebook n’a pu être connectée. Consultez le détail de chaque page, puis réessayez.',
    ar: 'لم يتم ربط أي صفحة من صفحات فيسبوك الخاصة بك ({total}). راجع تفاصيل كل صفحة ثم أعد المحاولة.',
  },
  PAGE_ALREADY_CONNECTED_ELSEWHERE: {
    status: 409,
    en: 'The page « {pageName} » is already connected to another Djaber account. Disconnect it there first, then connect it here.',
    fr: 'La page « {pageName} » est déjà connectée à un autre compte Djaber. Déconnectez-la d’abord depuis ce compte, puis reliez-la ici.',
    ar: 'الصفحة «{pageName}» مرتبطة بحساب Djaber آخر. افصلها من ذلك الحساب أولًا، ثم اربطها هنا.',
  },
  PAGE_MESSAGING_PERMISSION_MISSING: {
    status: 403,
    en: 'Your role on the page « {pageName} » does not allow messaging, so it cannot receive messages. Ask the page owner for the Moderate or Manage role, then connect it again.',
    fr: 'Votre rôle sur la page « {pageName} » n’autorise pas la messagerie : elle ne peut donc pas recevoir de messages. Demandez au propriétaire de la page le rôle « Modérer » ou « Gérer », puis reliez-la de nouveau.',
    ar: 'دورك على الصفحة «{pageName}» لا يسمح بالرسائل، لذلك لا يمكنها استلام الرسائل. اطلب من مالك الصفحة دور «الإشراف» أو «الإدارة»، ثم أعد ربطها.',
  },
  PAGE_ACCESS_TOKEN_MISSING: {
    status: 403,
    en: 'Meta did not return an access token for the page « {pageName} ». Connect again and make sure you tick this page and accept every requested permission.',
    fr: 'Meta n’a pas renvoyé de jeton d’accès pour la page « {pageName} ». Relancez la connexion en veillant à cocher cette page et à accepter toutes les autorisations demandées.',
    ar: 'لم تُرجع Meta رمز وصول للصفحة «{pageName}». أعد عملية الربط مع التأكد من تحديد هذه الصفحة وقبول جميع الصلاحيات المطلوبة.',
  },
  PAGE_WEBHOOK_SUBSCRIBE_FAILED: {
    status: 502,
    en: 'The page « {pageName} » was saved, but Meta refused the message subscription: it will not receive messages yet. Connect it again in a moment.',
    fr: 'La page « {pageName} » a bien été enregistrée, mais Meta a refusé l’abonnement aux messages : elle ne recevra pas encore de messages. Reliez-la de nouveau dans un instant.',
    ar: 'تم حفظ الصفحة «{pageName}»، لكن Meta رفضت الاشتراك في الرسائل: لن تستلم الرسائل بعد. أعد ربطها بعد قليل.',
  },
  PAGE_SAVE_FAILED: {
    status: 500,
    en: 'We could not save the page « {pageName} ». Please try again.',
    fr: 'Impossible d’enregistrer la page « {pageName} ». Veuillez réessayer.',
    ar: 'تعذّر حفظ الصفحة «{pageName}». يرجى المحاولة مرة أخرى.',
  },
  PAGE_LIST_FETCH_FAILED: {
    status: 502,
    en: 'Meta did not return your list of pages. Please try again.',
    fr: 'Meta n’a pas renvoyé la liste de vos pages. Veuillez réessayer.',
    ar: 'لم تُرجع Meta قائمة صفحاتك. يرجى المحاولة مرة أخرى.',
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
