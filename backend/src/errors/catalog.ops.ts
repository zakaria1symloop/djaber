import type { ErrorCatalog } from './catalog';

/** Module-specific codes (ops): AI agents & insights, notifications, cross-sell, delivery couriers, delivery fees. */
export const ops = {
  // ---- AI agents --------------------------------------------------------------
  AGENT_LIST_FAILED: {
    status: 500,
    en: 'We could not load your AI agents. Please try again.',
    fr: 'Impossible de charger vos agents IA. Veuillez réessayer.',
    ar: 'تعذّر تحميل وكلاء الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
  },
  AGENT_FETCH_FAILED: {
    status: 500,
    en: 'We could not load this AI agent. Please try again.',
    fr: 'Impossible de charger cet agent IA. Veuillez réessayer.',
    ar: 'تعذّر تحميل هذا الوكيل. يرجى المحاولة مرة أخرى.',
  },
  AGENT_CREATE_FAILED: {
    status: 500,
    en: 'The AI agent could not be created. Please try again.',
    fr: 'L’agent IA n’a pas pu être créé. Veuillez réessayer.',
    ar: 'تعذّر إنشاء وكيل الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
  },
  AGENT_UPDATE_FAILED: {
    status: 500,
    en: 'The AI agent could not be updated. Please try again.',
    fr: 'L’agent IA n’a pas pu être mis à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث وكيل الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
  },
  AGENT_DELETE_FAILED: {
    status: 500,
    en: 'The AI agent could not be deleted. Please try again.',
    fr: 'L’agent IA n’a pas pu être supprimé. Veuillez réessayer.',
    ar: 'تعذّر حذف وكيل الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
  },
  AGENT_TEST_FAILED: {
    status: 500,
    en: 'The test message could not be processed. Please try again.',
    fr: 'Le message de test n’a pas pu être traité. Veuillez réessayer.',
    ar: 'تعذّر معالجة رسالة الاختبار. يرجى المحاولة مرة أخرى.',
  },
  AGENT_AI_UNAVAILABLE: {
    status: 502,
    en: 'The AI could not generate a reply right now. Please try again in a moment.',
    fr: 'L’IA n’a pas pu générer de réponse pour le moment. Veuillez réessayer dans un instant.',
    ar: 'لم يتمكن الذكاء الاصطناعي من توليد رد حاليًا. يرجى المحاولة بعد قليل.',
  },
  AGENT_METRICS_FAILED: {
    status: 500,
    en: 'We could not load the agent metrics. Please try again.',
    fr: 'Impossible de charger les statistiques de l’agent. Veuillez réessayer.',
    ar: 'تعذّر تحميل إحصائيات الوكيل. يرجى المحاولة مرة أخرى.',
  },
  AGENT_PAGE_ALREADY_ASSIGNED: {
    status: 409,
    en: 'One or more pages are already assigned to another AI agent.',
    fr: 'Une ou plusieurs pages sont déjà assignées à un autre agent IA.',
    ar: 'صفحة واحدة أو أكثر مرتبطة مسبقًا بوكيل ذكاء اصطناعي آخر.',
  },

  // ---- Agent insights ---------------------------------------------------------
  INSIGHT_LIST_FAILED: {
    status: 500,
    en: 'We could not load the agent insights. Please try again.',
    fr: 'Impossible de charger les signalements de l’agent. Veuillez réessayer.',
    ar: 'تعذّر تحميل ملاحظات الوكيل. يرجى المحاولة مرة أخرى.',
  },
  INSIGHT_RESOLVE_FAILED: {
    status: 500,
    en: 'The insight could not be updated. Please try again.',
    fr: 'Le signalement n’a pas pu être mis à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث الملاحظة. يرجى المحاولة مرة أخرى.',
  },

  // ---- Notifications ----------------------------------------------------------
  NOTIF_LIST_FAILED: {
    status: 500,
    en: 'We could not load your notifications. Please try again.',
    fr: 'Impossible de charger vos notifications. Veuillez réessayer.',
    ar: 'تعذّر تحميل إشعاراتك. يرجى المحاولة مرة أخرى.',
  },
  NOTIF_COUNT_FAILED: {
    status: 500,
    en: 'We could not count your unread notifications. Please try again.',
    fr: 'Impossible de compter vos notifications non lues. Veuillez réessayer.',
    ar: 'تعذّر حساب الإشعارات غير المقروءة. يرجى المحاولة مرة أخرى.',
  },
  NOTIF_MARK_READ_FAILED: {
    status: 500,
    en: 'The notification could not be marked as read. Please try again.',
    fr: 'La notification n’a pas pu être marquée comme lue. Veuillez réessayer.',
    ar: 'تعذّر وضع علامة «مقروء» على الإشعار. يرجى المحاولة مرة أخرى.',
  },

  // ---- Cross-sell / up-sell recommendations -----------------------------------
  CROSS_SELL_LIST_FAILED: {
    status: 500,
    en: 'We could not load the recommendations. Please try again.',
    fr: 'Impossible de charger les recommandations. Veuillez réessayer.',
    ar: 'تعذّر تحميل التوصيات. يرجى المحاولة مرة أخرى.',
  },
  CROSS_SELL_STATS_FAILED: {
    status: 500,
    en: 'We could not load the recommendation statistics. Please try again.',
    fr: 'Impossible de charger les statistiques des recommandations. Veuillez réessayer.',
    ar: 'تعذّر تحميل إحصائيات التوصيات. يرجى المحاولة مرة أخرى.',
  },
  CROSS_SELL_GENERATE_FAILED: {
    status: 500,
    en: 'The recommendations could not be generated. Please try again.',
    fr: 'Les recommandations n’ont pas pu être générées. Veuillez réessayer.',
    ar: 'تعذّر توليد التوصيات. يرجى المحاولة مرة أخرى.',
  },
  CROSS_SELL_UPDATE_FAILED: {
    status: 500,
    en: 'The recommendation could not be updated. Please try again.',
    fr: 'La recommandation n’a pas pu être mise à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث التوصية. يرجى المحاولة مرة أخرى.',
  },
  CROSS_SELL_DELETE_FAILED: {
    status: 500,
    en: 'The recommendation could not be deleted. Please try again.',
    fr: 'La recommandation n’a pas pu être supprimée. Veuillez réessayer.',
    ar: 'تعذّر حذف التوصية. يرجى المحاولة مرة أخرى.',
  },

  // ---- Delivery couriers ------------------------------------------------------
  DELIVERY_PROVIDER_LIST_FAILED: {
    status: 500,
    en: 'We could not load your delivery providers. Please try again.',
    fr: 'Impossible de charger vos transporteurs. Veuillez réessayer.',
    ar: 'تعذّر تحميل شركات التوصيل الخاصة بك. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_PROVIDER_ADD_FAILED: {
    status: 500,
    en: 'The delivery provider could not be added. Please try again.',
    fr: 'Le transporteur n’a pas pu être ajouté. Veuillez réessayer.',
    ar: 'تعذّر إضافة شركة التوصيل. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_PROVIDER_UPDATE_FAILED: {
    status: 500,
    en: 'The delivery provider could not be updated. Please try again.',
    fr: 'Le transporteur n’a pas pu être mis à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث شركة التوصيل. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_PROVIDER_DELETE_FAILED: {
    status: 500,
    en: 'The delivery provider could not be removed. Please try again.',
    fr: 'Le transporteur n’a pas pu être supprimé. Veuillez réessayer.',
    ar: 'تعذّر حذف شركة التوصيل. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_PROVIDER_ALREADY_ADDED: {
    status: 409,
    en: 'The provider "{provider}" is already configured on your account.',
    fr: 'Le transporteur « {provider} » est déjà configuré sur votre compte.',
    ar: 'شركة التوصيل "{provider}" مضافة مسبقًا إلى حسابك.',
  },
  DELIVERY_NO_ACTIVE_PROVIDER: {
    status: 422,
    en: 'No active delivery provider is configured. Add one in Settings first.',
    fr: 'Aucun transporteur actif n’est configuré. Ajoutez-en un dans les paramètres.',
    ar: 'لا توجد شركة توصيل نشطة. أضف واحدة من الإعدادات أولًا.',
  },
  DELIVERY_PROVIDER_NOT_CONFIGURED: {
    status: 422,
    en: 'The delivery provider used for this order is no longer configured on your account.',
    fr: 'Le transporteur utilisé pour cette commande n’est plus configuré sur votre compte.',
    ar: 'شركة التوصيل المستخدمة لهذا الطلب لم تعد مضافة إلى حسابك.',
  },
  DELIVERY_CREDENTIALS_UNREADABLE: {
    status: 500,
    en: 'The stored courier credentials could not be read. Please re-enter them in Settings.',
    fr: 'Les identifiants du transporteur n’ont pas pu être lus. Veuillez les saisir à nouveau dans les paramètres.',
    ar: 'تعذّر قراءة بيانات اعتماد شركة التوصيل المحفوظة. يرجى إعادة إدخالها في الإعدادات.',
  },
  DELIVERY_CREDENTIALS_TEST_FAILED: {
    status: 502,
    en: 'The courier could not be reached to verify the credentials. Please try again.',
    fr: 'Impossible de joindre le transporteur pour vérifier les identifiants. Veuillez réessayer.',
    ar: 'تعذّر الاتصال بشركة التوصيل للتحقق من بيانات الاعتماد. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_ORDER_CANCELLED: {
    status: 422,
    en: 'A cancelled order cannot be sent to delivery.',
    fr: 'Une commande annulée ne peut pas être envoyée en livraison.',
    ar: 'لا يمكن إرسال طلب ملغى إلى التوصيل.',
  },
  DELIVERY_ORDER_ALREADY_SENT: {
    status: 422,
    en: 'This order has already been sent to delivery.',
    fr: 'Cette commande a déjà été envoyée en livraison.',
    ar: 'تم إرسال هذا الطلب إلى التوصيل مسبقًا.',
  },
  DELIVERY_ORDER_NOT_TRACKED: {
    status: 422,
    en: 'This order has no tracking information yet.',
    fr: 'Cette commande n’a pas encore d’informations de suivi.',
    ar: 'لا تتوفر معلومات تتبع لهذا الطلب بعد.',
  },
  DELIVERY_PROVIDER_ERROR: {
    status: 502,
    en: 'The courier rejected the request: {message}',
    fr: 'Le transporteur a rejeté la demande : {message}',
    ar: 'رفضت شركة التوصيل الطلب: {message}',
  },
  DELIVERY_RATES_UNAVAILABLE: {
    status: 502,
    en: 'The courier did not return delivery rates for this destination.',
    fr: 'Le transporteur n’a pas renvoyé de tarifs de livraison pour cette destination.',
    ar: 'لم تُرجع شركة التوصيل أسعار التوصيل لهذه الوجهة.',
  },
  DELIVERY_SEND_FAILED: {
    status: 500,
    en: 'The order could not be sent to delivery. Please try again.',
    fr: 'La commande n’a pas pu être envoyée en livraison. Veuillez réessayer.',
    ar: 'تعذّر إرسال الطلب إلى التوصيل. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_TRACKING_FAILED: {
    status: 500,
    en: 'The tracking information could not be retrieved. Please try again.',
    fr: 'Les informations de suivi n’ont pas pu être récupérées. Veuillez réessayer.',
    ar: 'تعذّر جلب معلومات التتبع. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_LABEL_FAILED: {
    status: 500,
    en: 'The shipping label could not be retrieved. Please try again.',
    fr: 'L’étiquette d’expédition n’a pas pu être récupérée. Veuillez réessayer.',
    ar: 'تعذّر جلب ملصق الشحن. يرجى المحاولة مرة أخرى.',
  },
  DELIVERY_RATES_FAILED: {
    status: 500,
    en: 'The delivery rates could not be retrieved. Please try again.',
    fr: 'Les tarifs de livraison n’ont pas pu être récupérés. Veuillez réessayer.',
    ar: 'تعذّر جلب أسعار التوصيل. يرجى المحاولة مرة أخرى.',
  },

  // ---- Delivery fee rules -----------------------------------------------------
  FEE_LIST_FAILED: {
    status: 500,
    en: 'We could not load the delivery fees. Please try again.',
    fr: 'Impossible de charger les frais de livraison. Veuillez réessayer.',
    ar: 'تعذّر تحميل رسوم التوصيل. يرجى المحاولة مرة أخرى.',
  },
  FEE_SAVE_FAILED: {
    status: 500,
    en: 'The delivery fee could not be saved. Please try again.',
    fr: 'Les frais de livraison n’ont pas pu être enregistrés. Veuillez réessayer.',
    ar: 'تعذّر حفظ رسوم التوصيل. يرجى المحاولة مرة أخرى.',
  },
  FEE_SEED_FAILED: {
    status: 500,
    en: 'The default delivery fees could not be applied. Please try again.',
    fr: 'Les frais de livraison par défaut n’ont pas pu être appliqués. Veuillez réessayer.',
    ar: 'تعذّر تطبيق رسوم التوصيل الافتراضية. يرجى المحاولة مرة أخرى.',
  },
  FEE_DELETE_FAILED: {
    status: 500,
    en: 'The delivery fee rule could not be removed. Please try again.',
    fr: 'La règle de frais de livraison n’a pas pu être supprimée. Veuillez réessayer.',
    ar: 'تعذّر حذف قاعدة رسوم التوصيل. يرجى المحاولة مرة أخرى.',
  },
  FEE_QUOTE_FAILED: {
    status: 500,
    en: 'The delivery fee could not be calculated. Please try again.',
    fr: 'Les frais de livraison n’ont pas pu être calculés. Veuillez réessayer.',
    ar: 'تعذّر حساب رسوم التوصيل. يرجى المحاولة مرة أخرى.',
  },
} as const satisfies ErrorCatalog;
