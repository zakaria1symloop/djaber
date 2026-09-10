import type { ErrorCatalog } from './catalog';

/**
 * Module-specific codes (admin panel, plans, subscriptions, CMS, AI providers,
 * legacy per-page /api/stock). Add codes here; the merged catalog is in ./catalog.ts.
 */
export const admin = {
  // ---- admin: users / analytics / lookups ------------------------------------
  ADMIN_ANALYTICS_FAILED: {
    status: 500,
    en: 'The platform analytics could not be loaded.',
    fr: 'Les statistiques de la plateforme n’ont pas pu être chargées.',
    ar: 'تعذّر تحميل إحصائيات المنصة.',
  },
  ADMIN_USERS_LIST_FAILED: {
    status: 500,
    en: 'The user list could not be loaded.',
    fr: 'La liste des utilisateurs n’a pas pu être chargée.',
    ar: 'تعذّر تحميل قائمة المستخدمين.',
  },
  ADMIN_USER_FETCH_FAILED: {
    status: 500,
    en: 'The user details could not be loaded.',
    fr: 'Les détails de l’utilisateur n’ont pas pu être chargés.',
    ar: 'تعذّر تحميل تفاصيل المستخدم.',
  },
  ADMIN_USER_UPDATE_FAILED: {
    status: 500,
    en: 'The user could not be updated.',
    fr: 'L’utilisateur n’a pas pu être mis à jour.',
    ar: 'تعذّر تحديث المستخدم.',
  },
  ADMIN_USER_DELETE_FAILED: {
    status: 500,
    en: 'The user could not be deleted.',
    fr: 'L’utilisateur n’a pas pu être supprimé.',
    ar: 'تعذّر حذف المستخدم.',
  },
  ADMIN_CANNOT_DEMOTE_SELF: {
    status: 422,
    en: 'You cannot remove your own administrator role.',
    fr: 'Vous ne pouvez pas retirer votre propre rôle d’administrateur.',
    ar: 'لا يمكنك إزالة صلاحية المسؤول عن حسابك.',
  },
  ADMIN_CANNOT_DELETE_SELF: {
    status: 422,
    en: 'You cannot delete your own account from the admin panel.',
    fr: 'Vous ne pouvez pas supprimer votre propre compte depuis le panneau d’administration.',
    ar: 'لا يمكنك حذف حسابك من لوحة الإدارة.',
  },
  ADMIN_CONVERSATIONS_LIST_FAILED: {
    status: 500,
    en: 'The conversations could not be loaded.',
    fr: 'Les conversations n’ont pas pu être chargées.',
    ar: 'تعذّر تحميل المحادثات.',
  },
  ADMIN_CONVERSATION_FETCH_FAILED: {
    status: 500,
    en: 'The conversation could not be loaded.',
    fr: 'La conversation n’a pas pu être chargée.',
    ar: 'تعذّر تحميل المحادثة.',
  },
  ADMIN_PRODUCTS_LIST_FAILED: {
    status: 500,
    en: 'The products could not be loaded.',
    fr: 'Les produits n’ont pas pu être chargés.',
    ar: 'تعذّر تحميل المنتجات.',
  },
  ADMIN_LOOKUP_FAILED: {
    status: 500,
    en: 'The filter options could not be loaded.',
    fr: 'Les options de filtre n’ont pas pu être chargées.',
    ar: 'تعذّر تحميل خيارات التصفية.',
  },
  ADMIN_PROFILE_UPDATE_FAILED: {
    status: 500,
    en: 'Your profile could not be updated.',
    fr: 'Votre profil n’a pas pu être mis à jour.',
    ar: 'تعذّر تحديث ملفك الشخصي.',
  },
  ADMIN_CURRENT_PASSWORD_REQUIRED: {
    status: 400,
    en: 'Your current password is required to set a new one.',
    fr: 'Votre mot de passe actuel est requis pour en définir un nouveau.',
    ar: 'كلمة المرور الحالية مطلوبة لتعيين كلمة مرور جديدة.',
  },
  ADMIN_CURRENT_PASSWORD_INCORRECT: {
    status: 400,
    en: 'The current password is incorrect.',
    fr: 'Le mot de passe actuel est incorrect.',
    ar: 'كلمة المرور الحالية غير صحيحة.',
  },

  // ---- plans -------------------------------------------------------------------
  PLAN_LIST_FAILED: {
    status: 500,
    en: 'The plans could not be loaded.',
    fr: 'Les plans n’ont pas pu être chargés.',
    ar: 'تعذّر تحميل الخطط.',
  },
  PLAN_CREATE_FAILED: {
    status: 500,
    en: 'The plan could not be created.',
    fr: 'Le plan n’a pas pu être créé.',
    ar: 'تعذّر إنشاء الخطة.',
  },
  PLAN_UPDATE_FAILED: {
    status: 500,
    en: 'The plan could not be updated.',
    fr: 'Le plan n’a pas pu être mis à jour.',
    ar: 'تعذّر تحديث الخطة.',
  },
  PLAN_DELETE_FAILED: {
    status: 500,
    en: 'The plan could not be deleted.',
    fr: 'Le plan n’a pas pu être supprimé.',
    ar: 'تعذّر حذف الخطة.',
  },
  PLAN_SLUG_TAKEN: {
    status: 409,
    en: 'A plan with the slug "{slug}" already exists.',
    fr: 'Un plan avec l’identifiant « {slug} » existe déjà.',
    ar: 'توجد خطة بالمعرّف "{slug}" مسبقًا.',
  },
  PLAN_IN_USE: {
    status: 422,
    en: 'This plan cannot be deleted: {count} user(s) are still on it.',
    fr: 'Ce plan ne peut pas être supprimé : {count} utilisateur(s) y sont encore abonnés.',
    ar: 'لا يمكن حذف هذه الخطة: لا يزال {count} مستخدمًا مشتركًا فيها.',
  },
  PLAN_NO_CHANGES: {
    status: 400,
    en: 'No editable plan field was provided.',
    fr: 'Aucun champ modifiable du plan n’a été fourni.',
    ar: 'لم يتم إرسال أي حقل قابل للتعديل في الخطة.',
  },

  // ---- subscriptions -------------------------------------------------------------
  SUBSCRIPTION_LIST_FAILED: {
    status: 500,
    en: 'The subscriptions could not be loaded.',
    fr: 'Les abonnements n’ont pas pu être chargés.',
    ar: 'تعذّر تحميل الاشتراكات.',
  },
  SUBSCRIPTION_CREATE_FAILED: {
    status: 500,
    en: 'The subscription could not be created.',
    fr: 'L’abonnement n’a pas pu être créé.',
    ar: 'تعذّر إنشاء الاشتراك.',
  },
  SUBSCRIPTION_UPDATE_FAILED: {
    status: 500,
    en: 'The subscription could not be updated.',
    fr: 'L’abonnement n’a pas pu être mis à jour.',
    ar: 'تعذّر تحديث الاشتراك.',
  },
  SUBSCRIPTION_DELETE_FAILED: {
    status: 500,
    en: 'The subscription could not be deleted.',
    fr: 'L’abonnement n’a pas pu être supprimé.',
    ar: 'تعذّر حذف الاشتراك.',
  },
  SUBSCRIPTION_ALREADY_ACTIVE: {
    status: 422,
    en: 'This user already has an active subscription. Cancel or expire it first.',
    fr: 'Cet utilisateur a déjà un abonnement actif. Annulez-le ou faites-le expirer d’abord.',
    ar: 'لدى هذا المستخدم اشتراك نشط بالفعل. قم بإلغائه أو إنهائه أولًا.',
  },
  SUBSCRIPTION_NO_CHANGES: {
    status: 400,
    en: 'No editable subscription field was provided.',
    fr: 'Aucun champ modifiable de l’abonnement n’a été fourni.',
    ar: 'لم يتم إرسال أي حقل قابل للتعديل في الاشتراك.',
  },

  // ---- CMS ------------------------------------------------------------------------
  CMS_LIST_FAILED: {
    status: 500,
    en: 'The pages could not be loaded.',
    fr: 'Les pages n’ont pas pu être chargées.',
    ar: 'تعذّر تحميل الصفحات.',
  },
  CMS_FETCH_FAILED: {
    status: 500,
    en: 'The page could not be loaded.',
    fr: 'La page n’a pas pu être chargée.',
    ar: 'تعذّر تحميل الصفحة.',
  },
  CMS_SAVE_FAILED: {
    status: 500,
    en: 'The page could not be saved.',
    fr: 'La page n’a pas pu être enregistrée.',
    ar: 'تعذّر حفظ الصفحة.',
  },
  CMS_DELETE_FAILED: {
    status: 500,
    en: 'The page could not be deleted.',
    fr: 'La page n’a pas pu être supprimée.',
    ar: 'تعذّر حذف الصفحة.',
  },

  // ---- AI providers ---------------------------------------------------------------
  AI_PROVIDER_LIST_FAILED: {
    status: 500,
    en: 'The AI providers could not be loaded.',
    fr: 'Les fournisseurs IA n’ont pas pu être chargés.',
    ar: 'تعذّر تحميل مزوّدي الذكاء الاصطناعي.',
  },
  AI_PROVIDER_UPDATE_FAILED: {
    status: 500,
    en: 'The AI provider could not be updated.',
    fr: 'Le fournisseur IA n’a pas pu être mis à jour.',
    ar: 'تعذّر تحديث مزوّد الذكاء الاصطناعي.',
  },
  AI_PROVIDER_TEST_FAILED: {
    status: 500,
    en: 'The API key could not be tested. Please try again.',
    fr: 'La clé API n’a pas pu être testée. Veuillez réessayer.',
    ar: 'تعذّر اختبار مفتاح API. يرجى المحاولة مرة أخرى.',
  },
  AI_PROVIDER_NO_KEY: {
    status: 400,
    en: 'No API key is set for this provider yet.',
    fr: 'Aucune clé API n’est encore définie pour ce fournisseur.',
    ar: 'لم يتم تعيين مفتاح API لهذا المزوّد بعد.',
  },
  AI_PROVIDER_TEST_UNSUPPORTED: {
    status: 400,
    en: 'Connectivity test is not available for the provider "{provider}".',
    fr: 'Le test de connectivité n’est pas disponible pour le fournisseur « {provider} ».',
    ar: 'اختبار الاتصال غير متاح للمزوّد "{provider}".',
  },
  AI_PROVIDER_KEY_REJECTED: {
    status: 502,
    en: 'The provider rejected the API key (HTTP {status}). {detail}',
    fr: 'Le fournisseur a refusé la clé API (HTTP {status}). {detail}',
    ar: 'رفض المزوّد مفتاح API (HTTP {status}). {detail}',
  },
  AI_PROVIDER_RATE_LIMITED: {
    status: 502,
    en: 'The key looks valid but the provider is rate-limiting requests (HTTP 429). {detail}',
    fr: 'La clé semble valide mais le fournisseur limite les requêtes (HTTP 429). {detail}',
    ar: 'يبدو المفتاح صالحًا لكن المزوّد يقيّد عدد الطلبات (HTTP 429). {detail}',
  },
  AI_PROVIDER_UNREACHABLE: {
    status: 502,
    en: 'The provider did not answer correctly ({detail}).',
    fr: 'Le fournisseur n’a pas répondu correctement ({detail}).',
    ar: 'لم يستجب المزوّد بشكل صحيح ({detail}).',
  },

  // ---- legacy per-page stock API (/api/stock) -------------------------------------
  LEGACY_CATEGORY_LIST_FAILED: { status: 500, en: 'The categories could not be loaded.', fr: 'Les catégories n’ont pas pu être chargées.', ar: 'تعذّر تحميل الفئات.' },
  LEGACY_CATEGORY_CREATE_FAILED: { status: 500, en: 'The category could not be created.', fr: 'La catégorie n’a pas pu être créée.', ar: 'تعذّر إنشاء الفئة.' },
  LEGACY_CATEGORY_UPDATE_FAILED: { status: 500, en: 'The category could not be updated.', fr: 'La catégorie n’a pas pu être mise à jour.', ar: 'تعذّر تحديث الفئة.' },
  LEGACY_CATEGORY_DELETE_FAILED: { status: 500, en: 'The category could not be deleted.', fr: 'La catégorie n’a pas pu être supprimée.', ar: 'تعذّر حذف الفئة.' },
  LEGACY_CATEGORY_EXISTS: { status: 409, en: 'A category with this name already exists on this page.', fr: 'Une catégorie portant ce nom existe déjà sur cette page.', ar: 'توجد فئة بهذا الاسم مسبقًا في هذه الصفحة.' },
  LEGACY_PRODUCT_LIST_FAILED: { status: 500, en: 'The products could not be loaded.', fr: 'Les produits n’ont pas pu être chargés.', ar: 'تعذّر تحميل المنتجات.' },
  LEGACY_PRODUCT_FETCH_FAILED: { status: 500, en: 'The product could not be loaded.', fr: 'Le produit n’a pas pu être chargé.', ar: 'تعذّر تحميل المنتج.' },
  LEGACY_PRODUCT_CREATE_FAILED: { status: 500, en: 'The product could not be created.', fr: 'Le produit n’a pas pu être créé.', ar: 'تعذّر إنشاء المنتج.' },
  LEGACY_PRODUCT_UPDATE_FAILED: { status: 500, en: 'The product could not be updated.', fr: 'Le produit n’a pas pu être mis à jour.', ar: 'تعذّر تحديث المنتج.' },
  LEGACY_PRODUCT_DELETE_FAILED: { status: 500, en: 'The product could not be deleted.', fr: 'Le produit n’a pas pu être supprimé.', ar: 'تعذّر حذف المنتج.' },
  LEGACY_SKU_EXISTS: { status: 409, en: 'A product with this SKU already exists on this page.', fr: 'Un produit avec cette référence (SKU) existe déjà sur cette page.', ar: 'يوجد منتج بهذا الرمز (SKU) مسبقًا في هذه الصفحة.' },
  LEGACY_STOCK_ADJUST_FAILED: { status: 500, en: 'The stock could not be adjusted.', fr: 'Le stock n’a pas pu être ajusté.', ar: 'تعذّر تعديل المخزون.' },
  LEGACY_MOVEMENTS_FAILED: { status: 500, en: 'The stock movements could not be loaded.', fr: 'Les mouvements de stock n’ont pas pu être chargés.', ar: 'تعذّر تحميل حركات المخزون.' },
  LEGACY_SUPPLIER_LIST_FAILED: { status: 500, en: 'The suppliers could not be loaded.', fr: 'Les fournisseurs n’ont pas pu être chargés.', ar: 'تعذّر تحميل المورّدين.' },
  LEGACY_SUPPLIER_CREATE_FAILED: { status: 500, en: 'The supplier could not be created.', fr: 'Le fournisseur n’a pas pu être créé.', ar: 'تعذّر إنشاء المورّد.' },
  LEGACY_SUPPLIER_UPDATE_FAILED: { status: 500, en: 'The supplier could not be updated.', fr: 'Le fournisseur n’a pas pu être mis à jour.', ar: 'تعذّر تحديث المورّد.' },
  LEGACY_SUPPLIER_DELETE_FAILED: { status: 500, en: 'The supplier could not be deleted.', fr: 'Le fournisseur n’a pas pu être supprimé.', ar: 'تعذّر حذف المورّد.' },
  LEGACY_SUPPLIER_EXISTS: { status: 409, en: 'A supplier with this name already exists on this page.', fr: 'Un fournisseur portant ce nom existe déjà sur cette page.', ar: 'يوجد مورّد بهذا الاسم مسبقًا في هذه الصفحة.' },
  LEGACY_DASHBOARD_FAILED: { status: 500, en: 'The stock dashboard could not be loaded.', fr: 'Le tableau de bord du stock n’a pas pu être chargé.', ar: 'تعذّر تحميل لوحة المخزون.' },
  LEGACY_SALE_LIST_FAILED: { status: 500, en: 'The sales could not be loaded.', fr: 'Les ventes n’ont pas pu être chargées.', ar: 'تعذّر تحميل المبيعات.' },
  LEGACY_SALE_FETCH_FAILED: { status: 500, en: 'The sale could not be loaded.', fr: 'La vente n’a pas pu être chargée.', ar: 'تعذّر تحميل عملية البيع.' },
  LEGACY_SALE_CREATE_FAILED: { status: 500, en: 'The sale could not be recorded.', fr: 'La vente n’a pas pu être enregistrée.', ar: 'تعذّر تسجيل عملية البيع.' },
  LEGACY_SALE_UPDATE_FAILED: { status: 500, en: 'The sale could not be updated.', fr: 'La vente n’a pas pu être mise à jour.', ar: 'تعذّر تحديث عملية البيع.' },
  LEGACY_SALE_STATS_FAILED: { status: 500, en: 'The sales statistics could not be loaded.', fr: 'Les statistiques de ventes n’ont pas pu être chargées.', ar: 'تعذّر تحميل إحصائيات المبيعات.' },
  LEGACY_PURCHASE_LIST_FAILED: { status: 500, en: 'The purchases could not be loaded.', fr: 'Les achats n’ont pas pu être chargés.', ar: 'تعذّر تحميل المشتريات.' },
  LEGACY_PURCHASE_FETCH_FAILED: { status: 500, en: 'The purchase could not be loaded.', fr: 'L’achat n’a pas pu être chargé.', ar: 'تعذّر تحميل عملية الشراء.' },
  LEGACY_PURCHASE_CREATE_FAILED: { status: 500, en: 'The purchase could not be created.', fr: 'L’achat n’a pas pu être créé.', ar: 'تعذّر إنشاء عملية الشراء.' },
  LEGACY_PURCHASE_UPDATE_FAILED: { status: 500, en: 'The purchase could not be updated.', fr: 'L’achat n’a pas pu être mis à jour.', ar: 'تعذّر تحديث عملية الشراء.' },
  LEGACY_PURCHASE_RECEIVE_FAILED: { status: 500, en: 'The received items could not be saved.', fr: 'Les articles reçus n’ont pas pu être enregistrés.', ar: 'تعذّر حفظ العناصر المستلمة.' },
  LEGACY_PURCHASE_STATS_FAILED: { status: 500, en: 'The purchase statistics could not be loaded.', fr: 'Les statistiques d’achats n’ont pas pu être chargées.', ar: 'تعذّر تحميل إحصائيات المشتريات.' },
  LEGACY_PURCHASE_ITEM_NOT_FOUND: {
    status: 404,
    en: 'The purchase line "{itemId}" does not belong to this purchase.',
    fr: 'La ligne d’achat « {itemId} » n’appartient pas à cet achat.',
    ar: 'سطر الشراء "{itemId}" لا ينتمي إلى عملية الشراء هذه.',
  },
  LEGACY_DUPLICATE_PRODUCTS: {
    status: 400,
    en: 'The same product appears more than once in the items. Merge the lines first.',
    fr: 'Le même produit apparaît plusieurs fois dans les articles. Fusionnez les lignes d’abord.',
    ar: 'يظهر المنتج نفسه أكثر من مرة في العناصر. يرجى دمج الأسطر أولًا.',
  },
  LEGACY_INSUFFICIENT_STOCK: {
    status: 422,
    en: 'Insufficient stock for "{product}": only {available} left.',
    fr: 'Stock insuffisant pour « {product} » : il n’en reste que {available}.',
    ar: 'المخزون غير كافٍ للمنتج "{product}": المتبقي {available} فقط.',
  },
} as const satisfies ErrorCatalog;
