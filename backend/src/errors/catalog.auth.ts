import type { ErrorCatalog } from './catalog';

/** Auth, devices (push), billing / plans, CMS. */
export const auth = {
  AUTH_EMAIL_TAKEN: {
    status: 409,
    en: 'An account with this e-mail already exists.',
    fr: 'Un compte existe déjà avec cet e-mail.',
    ar: 'يوجد حساب مسجّل بهذا البريد الإلكتروني من قبل.',
  },
  AUTH_INVALID_CREDENTIALS: {
    status: 401,
    en: 'Incorrect e-mail or password.',
    fr: 'E-mail ou mot de passe incorrect.',
    ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  },
  AUTH_PASSWORD_TOO_SHORT: {
    status: 400,
    en: 'The password must be at least 8 characters long.',
    fr: 'Le mot de passe doit contenir au moins 8 caractères.',
    ar: 'يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل.',
  },
  AUTH_PASSWORD_REQUIRED: {
    status: 400,
    en: 'The password is required.',
    fr: 'Le mot de passe est obligatoire.',
    ar: 'كلمة المرور إلزامية.',
  },
  AUTH_FIRST_NAME_REQUIRED: {
    status: 400,
    en: 'The first name is required.',
    fr: 'Le prénom est obligatoire.',
    ar: 'الاسم الأول إلزامي.',
  },
  AUTH_LAST_NAME_REQUIRED: {
    status: 400,
    en: 'The last name is required.',
    fr: 'Le nom est obligatoire.',
    ar: 'اللقب إلزامي.',
  },
  AUTH_INVALID_PLAN: {
    status: 400,
    en: 'The plan must be "individual" or "teams".',
    fr: 'Le plan doit être « individual » ou « teams ».',
    ar: 'يجب أن تكون الخطة "individual" أو "teams".',
  },
  AUTH_REGISTER_FAILED: {
    status: 500,
    en: 'We could not create your account. Please try again.',
    fr: 'Impossible de créer votre compte. Veuillez réessayer.',
    ar: 'تعذّر إنشاء حسابك. يرجى المحاولة مرة أخرى.',
  },
  AUTH_LOGIN_FAILED: {
    status: 500,
    en: 'We could not sign you in. Please try again.',
    fr: 'Impossible de vous connecter. Veuillez réessayer.',
    ar: 'تعذّر تسجيل دخولك. يرجى المحاولة مرة أخرى.',
  },
  DEVICE_TOKEN_INVALID: {
    status: 400,
    en: 'A valid push token is required.',
    fr: 'Un jeton de notification valide est requis.',
    ar: 'مطلوب رمز إشعارات صالح.',
  },
  DEVICE_TOKEN_REQUIRED: {
    status: 400,
    en: 'The device token is required.',
    fr: 'Le jeton de l’appareil est obligatoire.',
    ar: 'رمز الجهاز إلزامي.',
  },
  AUTH_PROFILE_FAILED: {
    status: 500,
    en: 'We could not load your profile. Please try again.',
    fr: 'Impossible de charger votre profil. Veuillez réessayer.',
    ar: 'تعذّر تحميل ملفك الشخصي. يرجى المحاولة مرة أخرى.',
  },
  AUTH_NOT_CONFIGURED: {
    status: 503,
    en: 'Sign-in is not available right now. Please try again later.',
    fr: 'La connexion n’est pas disponible pour le moment. Veuillez réessayer plus tard.',
    ar: 'تسجيل الدخول غير متاح حاليًا. يرجى المحاولة لاحقًا.',
  },
  DEVICE_PLATFORM_INVALID: {
    status: 400,
    en: 'The platform must be "android" or "ios".',
    fr: 'La plateforme doit être « android » ou « ios ».',
    ar: 'يجب أن تكون المنصة "android" أو "ios".',
  },
  DEVICE_REGISTER_FAILED: {
    status: 500,
    en: 'We could not register this device. Please try again.',
    fr: 'Impossible d’enregistrer cet appareil. Veuillez réessayer.',
    ar: 'تعذّر تسجيل هذا الجهاز. يرجى المحاولة مرة أخرى.',
  },
  DEVICE_UNREGISTER_FAILED: {
    status: 500,
    en: 'We could not unregister this device. Please try again.',
    fr: 'Impossible de désinscrire cet appareil. Veuillez réessayer.',
    ar: 'تعذّر إلغاء تسجيل هذا الجهاز. يرجى المحاولة مرة أخرى.',
  },
  PAYMENT_GATEWAY_NOT_CONFIGURED: {
    status: 503,
    en: 'Online payment is not available yet.',
    fr: 'Le paiement en ligne n’est pas encore disponible.',
    ar: 'الدفع الإلكتروني غير متاح حاليًا.',
  },
  PLAN_IS_FREE: {
    status: 400,
    en: 'This plan is free — no payment is needed.',
    fr: 'Ce plan est gratuit — aucun paiement n’est nécessaire.',
    ar: 'هذه الخطة مجانية — لا حاجة لأي دفع.',
  },
  PAYMENT_CHECKOUT_FAILED: {
    status: 502,
    en: 'We could not start the payment. Please try again.',
    fr: 'Impossible de démarrer le paiement. Veuillez réessayer.',
    ar: 'تعذّر بدء عملية الدفع. يرجى المحاولة مرة أخرى.',
  },
  PAYMENT_VERIFY_FAILED: {
    status: 502,
    en: 'We could not verify the payment. Please try again.',
    fr: 'Impossible de vérifier le paiement. Veuillez réessayer.',
    ar: 'تعذّر التحقق من عملية الدفع. يرجى المحاولة مرة أخرى.',
  },
} as const satisfies ErrorCatalog;
