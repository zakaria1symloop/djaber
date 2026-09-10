import type { ErrorCatalog } from './catalog';

/** Module-specific codes (commerce). Add codes here; the merged catalog is in ./catalog.ts. */
export const commerce = {
  // ==========================================================================
  // Orders
  // ==========================================================================
  ORDER_FETCH_FAILED: {
    status: 500,
    en: 'We could not load the orders. Please try again.',
    fr: 'Impossible de charger les commandes. Veuillez réessayer.',
    ar: 'تعذّر تحميل الطلبات. يرجى المحاولة مرة أخرى.',
  },
  ORDER_CREATE_FAILED: {
    status: 500,
    en: 'The order could not be created. Please try again.',
    fr: 'La commande n’a pas pu être créée. Veuillez réessayer.',
    ar: 'تعذّر إنشاء الطلب. يرجى المحاولة مرة أخرى.',
  },
  ORDER_UPDATE_FAILED: {
    status: 500,
    en: 'The order could not be updated. Please try again.',
    fr: 'La commande n’a pas pu être mise à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث الطلب. يرجى المحاولة مرة أخرى.',
  },
  ORDER_DELETE_FAILED: {
    status: 500,
    en: 'The order could not be deleted. Please try again.',
    fr: 'La commande n’a pas pu être supprimée. Veuillez réessayer.',
    ar: 'تعذّر حذف الطلب. يرجى المحاولة مرة أخرى.',
  },
  ORDER_CALL_FAILED: {
    status: 500,
    en: 'The call could not be recorded. Please try again.',
    fr: 'L’appel n’a pas pu être enregistré. Veuillez réessayer.',
    ar: 'تعذّر تسجيل المكالمة. يرجى المحاولة مرة أخرى.',
  },
  ORDER_CALLS_FETCH_FAILED: {
    status: 500,
    en: 'We could not load the call history. Please try again.',
    fr: 'Impossible de charger l’historique des appels. Veuillez réessayer.',
    ar: 'تعذّر تحميل سجل المكالمات. يرجى المحاولة مرة أخرى.',
  },
  ORDER_STATS_FAILED: {
    status: 500,
    en: 'We could not compute the order statistics. Please try again.',
    fr: 'Impossible de calculer les statistiques des commandes. Veuillez réessayer.',
    ar: 'تعذّر حساب إحصائيات الطلبات. يرجى المحاولة مرة أخرى.',
  },
  ORDER_VARIANT_REQUIRED: {
    status: 400,
    en: 'Please choose a variant for the product "{product}".',
    fr: 'Veuillez choisir une variante pour le produit « {product} ».',
    ar: 'يرجى اختيار نسخة للمنتج "{product}".',
  },
  ORDER_VARIANT_NOT_FOUND: {
    status: 404,
    en: 'The selected variant of "{product}" was not found or is no longer active.',
    fr: 'La variante sélectionnée de « {product} » est introuvable ou n’est plus active.',
    ar: 'النسخة المختارة من "{product}" غير موجودة أو لم تعد نشطة.',
  },
  ORDER_INSUFFICIENT_STOCK: {
    status: 422,
    en: 'Not enough stock for "{product}".',
    fr: 'Stock insuffisant pour « {product} ».',
    ar: 'المخزون غير كافٍ للمنتج "{product}".',
  },
  ORDER_INVALID_TRANSITION: {
    status: 422,
    en: 'An order cannot go from "{from}" to "{to}".',
    fr: 'Une commande ne peut pas passer de « {from} » à « {to} ».',
    ar: 'لا يمكن نقل الطلب من الحالة "{from}" إلى "{to}".',
  },
  ORDER_TERMINAL: {
    status: 422,
    en: 'This order is {status} and can no longer be changed. Create a new order instead.',
    fr: 'Cette commande est {status} et ne peut plus être modifiée. Créez une nouvelle commande.',
    ar: 'هذا الطلب في الحالة "{status}" ولا يمكن تعديله. أنشئ طلبًا جديدًا بدلًا من ذلك.',
  },
  ORDER_TERMINAL_PAYMENT_LOCKED: {
    status: 422,
    en: 'This order is {status}: its payment and delivery details can no longer be modified.',
    fr: 'Cette commande est {status} : ses informations de paiement et de livraison ne peuvent plus être modifiées.',
    ar: 'هذا الطلب في الحالة "{status}": لا يمكن تعديل بيانات الدفع والتوصيل الخاصة به.',
  },
  ORDER_DELETE_DELIVERED: {
    status: 422,
    en: 'A delivered order cannot be deleted. Mark it as returned instead.',
    fr: 'Une commande livrée ne peut pas être supprimée. Marquez-la comme retournée.',
    ar: 'لا يمكن حذف طلب تم توصيله. ضع علامة "مُرجَع" عليه بدلًا من ذلك.',
  },

  // ==========================================================================
  // Sales (walk-in)
  // ==========================================================================
  SALE_FETCH_FAILED: {
    status: 500,
    en: 'We could not load the sales. Please try again.',
    fr: 'Impossible de charger les ventes. Veuillez réessayer.',
    ar: 'تعذّر تحميل المبيعات. يرجى المحاولة مرة أخرى.',
  },
  SALE_CREATE_FAILED: {
    status: 500,
    en: 'The sale could not be recorded. Please try again.',
    fr: 'La vente n’a pas pu être enregistrée. Veuillez réessayer.',
    ar: 'تعذّر تسجيل عملية البيع. يرجى المحاولة مرة أخرى.',
  },
  SALE_UPDATE_FAILED: {
    status: 500,
    en: 'The sale could not be updated. Please try again.',
    fr: 'La vente n’a pas pu être mise à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث عملية البيع. يرجى المحاولة مرة أخرى.',
  },
  SALE_DELETE_FAILED: {
    status: 500,
    en: 'The sale could not be deleted. Please try again.',
    fr: 'La vente n’a pas pu être supprimée. Veuillez réessayer.',
    ar: 'تعذّر حذف عملية البيع. يرجى المحاولة مرة أخرى.',
  },
  SALE_STATS_FAILED: {
    status: 500,
    en: 'We could not compute the sales statistics. Please try again.',
    fr: 'Impossible de calculer les statistiques des ventes. Veuillez réessayer.',
    ar: 'تعذّر حساب إحصائيات المبيعات. يرجى المحاولة مرة أخرى.',
  },
  SALE_VARIANT_REQUIRED: {
    status: 400,
    en: 'The product "{product}" has variants. Please select one.',
    fr: 'Le produit « {product} » possède des variantes. Veuillez en sélectionner une.',
    ar: 'المنتج "{product}" يحتوي على نسخ متعددة. يرجى اختيار إحداها.',
  },
  SALE_VARIANT_NOT_FOUND: {
    status: 404,
    en: 'The selected variant of "{product}" was not found or is no longer active.',
    fr: 'La variante sélectionnée de « {product} » est introuvable ou n’est plus active.',
    ar: 'النسخة المختارة من "{product}" غير موجودة أو لم تعد نشطة.',
  },
  SALE_INSUFFICIENT_STOCK: {
    status: 422,
    en: 'Not enough stock for "{product}".',
    fr: 'Stock insuffisant pour « {product} ».',
    ar: 'المخزون غير كافٍ للمنتج "{product}".',
  },
  SALE_DELETE_PAID: {
    status: 422,
    en: 'A paid sale cannot be deleted. Set its payment back to pending first.',
    fr: 'Une vente payée ne peut pas être supprimée. Remettez d’abord son paiement en attente.',
    ar: 'لا يمكن حذف عملية بيع مدفوعة. أعد حالة الدفع إلى "قيد الانتظار" أولًا.',
  },
  SALE_DELETE_WITH_PAYMENTS: {
    status: 422,
    en: 'This sale has recorded payments and cannot be deleted. Set the amount paid to 0 first.',
    fr: 'Cette vente comporte des paiements enregistrés et ne peut pas être supprimée. Remettez d’abord le montant payé à 0.',
    ar: 'تحتوي عملية البيع هذه على مدفوعات مسجّلة ولا يمكن حذفها. اضبط المبلغ المدفوع على 0 أولًا.',
  },

  // ==========================================================================
  // Purchases
  // ==========================================================================
  PURCHASE_FETCH_FAILED: {
    status: 500,
    en: 'We could not load the purchases. Please try again.',
    fr: 'Impossible de charger les achats. Veuillez réessayer.',
    ar: 'تعذّر تحميل المشتريات. يرجى المحاولة مرة أخرى.',
  },
  PURCHASE_CREATE_FAILED: {
    status: 500,
    en: 'The purchase could not be created. Please try again.',
    fr: 'L’achat n’a pas pu être créé. Veuillez réessayer.',
    ar: 'تعذّر إنشاء عملية الشراء. يرجى المحاولة مرة أخرى.',
  },
  PURCHASE_UPDATE_FAILED: {
    status: 500,
    en: 'The purchase could not be updated. Please try again.',
    fr: 'L’achat n’a pas pu être mis à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث عملية الشراء. يرجى المحاولة مرة أخرى.',
  },
  PURCHASE_DELETE_FAILED: {
    status: 500,
    en: 'The purchase could not be deleted. Please try again.',
    fr: 'L’achat n’a pas pu être supprimé. Veuillez réessayer.',
    ar: 'تعذّر حذف عملية الشراء. يرجى المحاولة مرة أخرى.',
  },
  PURCHASE_RECEIVE_FAILED: {
    status: 500,
    en: 'The items could not be received. Please try again.',
    fr: 'Les articles n’ont pas pu être réceptionnés. Veuillez réessayer.',
    ar: 'تعذّر استلام الأصناف. يرجى المحاولة مرة أخرى.',
  },
  PURCHASE_STATS_FAILED: {
    status: 500,
    en: 'We could not compute the purchase statistics. Please try again.',
    fr: 'Impossible de calculer les statistiques des achats. Veuillez réessayer.',
    ar: 'تعذّر حساب إحصائيات المشتريات. يرجى المحاولة مرة أخرى.',
  },
  PURCHASE_VARIANT_REQUIRED: {
    status: 400,
    en: 'Please choose which variant of "{product}" is being restocked.',
    fr: 'Veuillez indiquer quelle variante de « {product} » est réapprovisionnée.',
    ar: 'يرجى تحديد نسخة المنتج "{product}" التي يتم تزويد مخزونها.',
  },
  PURCHASE_VARIANT_NOT_FOUND: {
    status: 404,
    en: 'The selected variant of "{product}" was not found or is no longer active.',
    fr: 'La variante sélectionnée de « {product} » est introuvable ou n’est plus active.',
    ar: 'النسخة المختارة من "{product}" غير موجودة أو لم تعد نشطة.',
  },
  PURCHASE_INVALID_TRANSITION: {
    status: 422,
    en: 'A purchase cannot go from "{from}" to "{to}".',
    fr: 'Un achat ne peut pas passer de « {from} » à « {to} ».',
    ar: 'لا يمكن نقل عملية الشراء من الحالة "{from}" إلى "{to}".',
  },
  PURCHASE_STATUS_VIA_RECEIVE: {
    status: 422,
    en: 'The status "{status}" is set automatically when items are received. Use the receive action instead.',
    fr: 'Le statut « {status} » est attribué automatiquement à la réception des articles. Utilisez l’action de réception.',
    ar: 'تُضبط الحالة "{status}" تلقائيًا عند استلام الأصناف. استخدم إجراء الاستلام بدلًا من ذلك.',
  },
  PURCHASE_CANCELLED_PAYMENT_LOCKED: {
    status: 422,
    en: 'This purchase is cancelled: its payments can no longer be modified.',
    fr: 'Cet achat est annulé : ses paiements ne peuvent plus être modifiés.',
    ar: 'عملية الشراء هذه ملغاة: لا يمكن تعديل مدفوعاتها.',
  },
  PURCHASE_DELETE_NOT_PENDING: {
    status: 422,
    en: 'Only pending purchases can be deleted (this one is {status}). Cancel it instead.',
    fr: 'Seuls les achats en attente peuvent être supprimés (celui-ci est {status}). Annulez-le plutôt.',
    ar: 'يمكن حذف عمليات الشراء قيد الانتظار فقط (هذه العملية في الحالة "{status}"). قم بإلغائها بدلًا من ذلك.',
  },
  PURCHASE_DELETE_PAID: {
    status: 422,
    en: 'A paid purchase cannot be deleted. Cancel it instead.',
    fr: 'Un achat payé ne peut pas être supprimé. Annulez-le plutôt.',
    ar: 'لا يمكن حذف عملية شراء مدفوعة. قم بإلغائها بدلًا من ذلك.',
  },
  PURCHASE_DELETE_WITH_PAYMENTS: {
    status: 422,
    en: 'This purchase has recorded payments and cannot be deleted. Cancel it instead.',
    fr: 'Cet achat comporte des paiements enregistrés et ne peut pas être supprimé. Annulez-le plutôt.',
    ar: 'تحتوي عملية الشراء هذه على مدفوعات مسجّلة ولا يمكن حذفها. قم بإلغائها بدلًا من ذلك.',
  },
  PURCHASE_DELETE_WITH_RECEIVED: {
    status: 422,
    en: 'This purchase already has received items and cannot be deleted. Cancel it instead.',
    fr: 'Cet achat comporte déjà des articles réceptionnés et ne peut pas être supprimé. Annulez-le plutôt.',
    ar: 'تحتوي عملية الشراء هذه على أصناف مستلمة ولا يمكن حذفها. قم بإلغائها بدلًا من ذلك.',
  },
  PURCHASE_ITEM_NOT_FOUND: {
    status: 404,
    en: 'One of the lines you are receiving does not belong to this purchase.',
    fr: 'Une des lignes que vous réceptionnez n’appartient pas à cet achat.',
    ar: 'أحد الأصناف التي تحاول استلامها لا ينتمي إلى عملية الشراء هذه.',
  },
  PURCHASE_RECEIVE_CANCELLED: {
    status: 422,
    en: 'Items cannot be received into a cancelled purchase.',
    fr: 'Impossible de réceptionner des articles dans un achat annulé.',
    ar: 'لا يمكن استلام أصناف ضمن عملية شراء ملغاة.',
  },
  PURCHASE_ALREADY_RECEIVED: {
    status: 422,
    en: 'This purchase has already been fully received.',
    fr: 'Cet achat a déjà été entièrement réceptionné.',
    ar: 'تم استلام عملية الشراء هذه بالكامل مسبقًا.',
  },
  PURCHASE_OVER_RECEIVE: {
    status: 422,
    en: 'Cannot receive {delta} more of "{product}": only {remaining} remaining.',
    fr: 'Impossible de réceptionner {delta} de plus pour « {product} » : il n’en reste que {remaining}.',
    ar: 'لا يمكن استلام {delta} إضافية من "{product}": لم يتبقَّ سوى {remaining}.',
  },
  PURCHASE_CONCURRENT_RECEIVE: {
    status: 409,
    en: 'Another receipt is in progress for "{product}". Please try again.',
    fr: 'Une autre réception est en cours pour « {product} ». Veuillez réessayer.',
    ar: 'هناك عملية استلام أخرى جارية للمنتج "{product}". يرجى المحاولة مرة أخرى.',
  },

  // ==========================================================================
  // Clients
  // ==========================================================================
  CLIENT_FETCH_FAILED: {
    status: 500,
    en: 'We could not load the clients. Please try again.',
    fr: 'Impossible de charger les clients. Veuillez réessayer.',
    ar: 'تعذّر تحميل العملاء. يرجى المحاولة مرة أخرى.',
  },
  CLIENT_CREATE_FAILED: {
    status: 500,
    en: 'The client could not be created. Please try again.',
    fr: 'Le client n’a pas pu être créé. Veuillez réessayer.',
    ar: 'تعذّر إنشاء العميل. يرجى المحاولة مرة أخرى.',
  },
  CLIENT_UPDATE_FAILED: {
    status: 500,
    en: 'The client could not be updated. Please try again.',
    fr: 'Le client n’a pas pu être mis à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث بيانات العميل. يرجى المحاولة مرة أخرى.',
  },
  CLIENT_DELETE_FAILED: {
    status: 500,
    en: 'The client could not be deleted. Please try again.',
    fr: 'Le client n’a pas pu être supprimé. Veuillez réessayer.',
    ar: 'تعذّر حذف العميل. يرجى المحاولة مرة أخرى.',
  },
  CLIENT_METRICS_FAILED: {
    status: 500,
    en: 'We could not load the client’s activity. Please try again.',
    fr: 'Impossible de charger l’activité du client. Veuillez réessayer.',
    ar: 'تعذّر تحميل نشاط العميل. يرجى المحاولة مرة أخرى.',
  },
  CLIENT_PHONE_EXISTS: {
    status: 409,
    en: 'A client with this phone number already exists.',
    fr: 'Un client avec ce numéro de téléphone existe déjà.',
    ar: 'يوجد عميل بهذا الرقم الهاتفي مسبقًا.',
  },

  // ==========================================================================
  // Caisse (cash register)
  // ==========================================================================
  CAISSE_FETCH_FAILED: {
    status: 500,
    en: 'We could not load the cash register entries. Please try again.',
    fr: 'Impossible de charger les opérations de caisse. Veuillez réessayer.',
    ar: 'تعذّر تحميل عمليات الصندوق. يرجى المحاولة مرة أخرى.',
  },
  CAISSE_STATS_FAILED: {
    status: 500,
    en: 'We could not compute the cash register balance. Please try again.',
    fr: 'Impossible de calculer le solde de caisse. Veuillez réessayer.',
    ar: 'تعذّر حساب رصيد الصندوق. يرجى المحاولة مرة أخرى.',
  },
  CAISSE_CREATE_FAILED: {
    status: 500,
    en: 'The cash register entry could not be created. Please try again.',
    fr: 'L’opération de caisse n’a pas pu être créée. Veuillez réessayer.',
    ar: 'تعذّر إنشاء عملية الصندوق. يرجى المحاولة مرة أخرى.',
  },
  CAISSE_UPDATE_FAILED: {
    status: 500,
    en: 'The cash register entry could not be updated. Please try again.',
    fr: 'L’opération de caisse n’a pas pu être mise à jour. Veuillez réessayer.',
    ar: 'تعذّر تحديث عملية الصندوق. يرجى المحاولة مرة أخرى.',
  },
  CAISSE_DELETE_FAILED: {
    status: 500,
    en: 'The cash register entry could not be deleted. Please try again.',
    fr: 'L’opération de caisse n’a pas pu être supprimée. Veuillez réessayer.',
    ar: 'تعذّر حذف عملية الصندوق. يرجى المحاولة مرة أخرى.',
  },
  CAISSE_EDIT_AUTOMATIC: {
    status: 422,
    en: 'Automatic entries (created from a sale, order or purchase) cannot be edited. Update the source document instead.',
    fr: 'Les opérations automatiques (issues d’une vente, d’une commande ou d’un achat) ne peuvent pas être modifiées. Modifiez le document d’origine.',
    ar: 'لا يمكن تعديل العمليات التلقائية (الناتجة عن بيع أو طلب أو شراء). عدّل المستند الأصلي بدلًا من ذلك.',
  },
  CAISSE_DELETE_AUTOMATIC: {
    status: 422,
    en: 'Automatic entries (created from a sale, order or purchase) cannot be deleted. Update the source document instead.',
    fr: 'Les opérations automatiques (issues d’une vente, d’une commande ou d’un achat) ne peuvent pas être supprimées. Modifiez le document d’origine.',
    ar: 'لا يمكن حذف العمليات التلقائية (الناتجة عن بيع أو طلب أو شراء). عدّل المستند الأصلي بدلًا من ذلك.',
  },
} as const satisfies ErrorCatalog;
