/**
 * i18n dictionaries + low-level getters.
 *
 * For React components, prefer `useTranslation()` from LanguageContext — it
 * re-renders on language change. This module is also callable outside React
 * (e.g., from utilities) via `t()` / `getLang()` / `setLang()`.
 */

export type Lang = 'en' | 'fr' | 'ar';

export const LANGS: { code: Lang; label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', nativeLabel: 'EN', dir: 'ltr' },
  { code: 'fr', label: 'Français', nativeLabel: 'FR', dir: 'ltr' },
  { code: 'ar', label: 'العربية', nativeLabel: 'AR', dir: 'rtl' },
];

const STORAGE_KEY = 'lang';
const DEFAULT_LANG: Lang = 'en';

type Dict = Record<string, string | string[]>;

const en: Dict = {
  // Auth — login
  'auth.login.title': 'Welcome back',
  'auth.login.subtitle': 'Sign in to your account to continue',
  'auth.login.email': 'Email',
  'auth.login.password': 'Password',
  'auth.login.forgot': 'Forgot?',
  'auth.login.remember': 'Remember me',
  'auth.login.submit': 'Sign In',
  'auth.login.submitting': 'Signing in…',
  'auth.login.noAccount': "Don't have an account?",
  'auth.login.signup': 'Get started',
  // Auth — signup
  'auth.signup.title': 'Create your account',
  'auth.signup.subtitle': 'Get started in less than a minute',
  'auth.signup.firstName': 'First name',
  'auth.signup.lastName': 'Last name',
  'auth.signup.email': 'Email',
  'auth.signup.password': 'Password',
  'auth.signup.passwordHint': 'At least 8 characters',
  'auth.signup.submit': 'Create Account',
  'auth.signup.submitting': 'Creating account…',
  'auth.signup.haveAccount': 'Already have an account?',
  'auth.signup.signin': 'Sign in',
  // Auth — errors
  'auth.errors.invalidEmail': 'Please enter a valid email address',
  'auth.errors.passwordTooShort': 'Password must be at least 8 characters',
  'auth.errors.firstNameRequired': 'First name is required',
  'auth.errors.lastNameRequired': 'Last name is required',
  'auth.errors.emailRequired': 'Email is required',
  'auth.errors.passwordRequired': 'Password is required',
  'auth.errors.userExists': 'An account with this email already exists',
  'auth.errors.invalidCredentials': 'Invalid email or password',
  'auth.errors.networkError': 'Cannot reach the server. Check your connection.',
  'auth.errors.unknown': 'Something went wrong. Please try again.',
  // Auth — success
  'auth.success.loggedIn': 'Welcome back!',
  'auth.success.signedUp': 'Account created successfully!',
  // Common
  'common.back': 'Back',
  'common.dismiss': 'Dismiss',

  // Header
  'header.features': 'Features',
  'header.pricing': 'Pricing',
  'header.docs': 'Docs',
  'header.login': 'Sign in',
  'header.signup': 'Get started',

  // Home — hero
  'home.hero.badge': 'Built for Algerian e-commerce',
  'home.hero.title.top': 'Turn Messenger into your',
  'home.hero.title.highlight': 'sales machine',
  'home.hero.subtitle':
    'Your AI agent answers customers, quotes shipping across 58 wilayas, and confirms orders — 24/7, in Arabic, French, and Darja.',
  'home.hero.cta.primary': 'Start free trial',
  'home.hero.cta.secondary': 'Watch demo',

  // Animated slogans (rotate in hero)
  'home.slogan.0': 'Sell while you sleep.',
  'home.slogan.1': 'Never lose a customer again.',
  'home.slogan.2': 'Confirm orders. Auto-ship. Win.',
  'home.slogan.3': 'Your 24/7 Algerian sales rep.',

  // Home — stats
  'home.stats.messages': 'Messages handled',
  'home.stats.pages': 'Active pages',
  'home.stats.uptime': 'Uptime',
  'home.stats.response': 'Response time',

  // Home — features
  'home.features.title': 'Built for how you sell',
  'home.features.subtitle': 'Every feature tuned for Algerian e-commerce — Messenger, COD, wilaya delivery',
  'home.features.f1.title': 'Instant Messenger replies',
  'home.features.f1.desc': 'AI answers in under a second. Never leaves a customer waiting.',
  'home.features.f2.title': 'Auto wilaya shipping',
  'home.features.f2.desc': 'Quotes delivery across all 58 wilayas — home or stopdesk — from your own prices or Yalidine / ZR / Maystro.',
  'home.features.f3.title': 'Cash on Delivery flow',
  'home.features.f3.desc': 'Confirm, prepare, ship, deliver. Auto-marks paid on delivery and books the caisse.',
  'home.features.f4.title': 'Product catalog + images',
  'home.features.f4.desc': 'Upload products with photos. The AI shows rich cards, compares customer photos to find matches.',
  'home.features.f5.title': 'Trained on your voice',
  'home.features.f5.desc': 'Set the personality, closing rules, and when to hand off to a human.',
  'home.features.f6.title': 'Human handoff',
  'home.features.f6.desc': 'AI pauses on complaints, refunds, or anything unclear — pings you, waits for you.',

  // Home — how it works
  'home.how.title': 'Go live in',
  'home.how.titleHighlight': '3 steps',
  'home.how.subtitle': 'Connect your Facebook page and let the AI take over',
  'home.how.s1.title': 'Connect your page',
  'home.how.s1.desc': 'Link your Facebook business page in one click with Meta OAuth.',
  'home.how.s2.title': 'Add your products',
  'home.how.s2.desc': 'Upload products with photos and prices. Set shipping fees per wilaya.',
  'home.how.s3.title': 'Go live',
  'home.how.s3.desc': 'Turn on the agent. It handles Messenger, creates orders, keeps your caisse in sync.',

  // Home — pricing
  'home.pricing.title': 'Simple',
  'home.pricing.titleHighlight': 'pricing',
  'home.pricing.subtitle': 'Pick a plan that fits your shop',

  // Home — CTA
  'home.cta.title.top': 'Ready to',
  'home.cta.title.highlight': 'auto-sell',
  'home.cta.title.bottom': 'on Messenger?',
  'home.cta.subtitle': 'Join Algerian merchants already using Djaber to respond faster and close more orders.',
  'home.cta.primary': 'Start free trial',
  'home.cta.secondary': 'Talk to sales',

  // Footer
  'footer.tagline': 'AI-powered Messenger sales automation for Algerian e-commerce',
  'footer.product': 'Product',
  'footer.company': 'Company',
  'footer.legal': 'Legal',
  'footer.rights': 'All rights reserved.',
};

const fr: Dict = {
  'auth.login.title': 'Bon retour',
  'auth.login.subtitle': 'Connectez-vous à votre compte pour continuer',
  'auth.login.email': 'E-mail',
  'auth.login.password': 'Mot de passe',
  'auth.login.forgot': 'Oublié ?',
  'auth.login.remember': 'Se souvenir de moi',
  'auth.login.submit': 'Se connecter',
  'auth.login.submitting': 'Connexion…',
  'auth.login.noAccount': "Vous n'avez pas de compte ?",
  'auth.login.signup': 'Commencer',

  'auth.signup.title': 'Créer votre compte',
  'auth.signup.subtitle': 'Commencez en moins d\'une minute',
  'auth.signup.firstName': 'Prénom',
  'auth.signup.lastName': 'Nom',
  'auth.signup.email': 'E-mail',
  'auth.signup.password': 'Mot de passe',
  'auth.signup.passwordHint': 'Au moins 8 caractères',
  'auth.signup.submit': 'Créer le compte',
  'auth.signup.submitting': 'Création du compte…',
  'auth.signup.haveAccount': 'Vous avez déjà un compte ?',
  'auth.signup.signin': 'Se connecter',

  'auth.errors.invalidEmail': 'Veuillez saisir une adresse e-mail valide',
  'auth.errors.passwordTooShort': 'Le mot de passe doit contenir au moins 8 caractères',
  'auth.errors.firstNameRequired': 'Le prénom est requis',
  'auth.errors.lastNameRequired': 'Le nom est requis',
  'auth.errors.emailRequired': 'L\'e-mail est requis',
  'auth.errors.passwordRequired': 'Le mot de passe est requis',
  'auth.errors.userExists': 'Un compte avec cet e-mail existe déjà',
  'auth.errors.invalidCredentials': 'E-mail ou mot de passe incorrect',
  'auth.errors.networkError': 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  'auth.errors.unknown': 'Une erreur s\'est produite. Veuillez réessayer.',

  'auth.success.loggedIn': 'Bon retour !',
  'auth.success.signedUp': 'Compte créé avec succès !',

  'common.back': 'Retour',
  'common.dismiss': 'Fermer',

  'header.features': 'Fonctionnalités',
  'header.pricing': 'Tarifs',
  'header.docs': 'Docs',
  'header.login': 'Connexion',
  'header.signup': 'Commencer',

  'home.hero.badge': 'Conçu pour l\'e-commerce algérien',
  'home.hero.title.top': 'Transformez Messenger en',
  'home.hero.title.highlight': 'machine à vendre',
  'home.hero.subtitle':
    'Votre agent IA répond aux clients, calcule la livraison dans les 58 wilayas et confirme les commandes — 24h/24, en arabe, français et darja.',
  'home.hero.cta.primary': 'Essai gratuit',
  'home.hero.cta.secondary': 'Voir la démo',

  'home.slogan.0': 'Vendez pendant que vous dormez.',
  'home.slogan.1': 'Ne perdez plus jamais un client.',
  'home.slogan.2': 'Confirmez. Expédiez. Gagnez.',
  'home.slogan.3': 'Votre commercial IA 24/7.',

  'home.stats.messages': 'Messages traités',
  'home.stats.pages': 'Pages actives',
  'home.stats.uptime': 'Disponibilité',
  'home.stats.response': 'Temps de réponse',

  'home.features.title': 'Pensé pour votre façon de vendre',
  'home.features.subtitle': 'Chaque fonctionnalité adaptée à l\'e-commerce algérien — Messenger, paiement à la livraison, wilayas',
  'home.features.f1.title': 'Réponses Messenger instantanées',
  'home.features.f1.desc': 'L\'IA répond en moins d\'une seconde. Aucun client ne patiente.',
  'home.features.f2.title': 'Livraison wilaya automatique',
  'home.features.f2.desc': 'Calcule la livraison dans les 58 wilayas — domicile ou stopdesk — avec vos tarifs ou Yalidine / ZR / Maystro.',
  'home.features.f3.title': 'Paiement à la livraison',
  'home.features.f3.desc': 'Confirmer, préparer, expédier, livrer. Marqué payé automatiquement à la livraison, caisse mise à jour.',
  'home.features.f4.title': 'Catalogue produits + images',
  'home.features.f4.desc': 'Ajoutez vos produits avec photos. L\'IA affiche des cartes et compare les photos clients pour retrouver vos articles.',
  'home.features.f5.title': 'Formé à votre ton',
  'home.features.f5.desc': 'Définissez la personnalité, les règles de clôture, et quand transférer à un humain.',
  'home.features.f6.title': 'Relai humain',
  'home.features.f6.desc': 'L\'IA se met en pause sur plaintes, remboursements, ou tout flou — vous alerte, vous attend.',

  'home.how.title': 'En ligne en',
  'home.how.titleHighlight': '3 étapes',
  'home.how.subtitle': 'Connectez votre page Facebook et laissez l\'IA prendre le relais',
  'home.how.s1.title': 'Connectez votre page',
  'home.how.s1.desc': 'Liez votre page Facebook en un clic via Meta OAuth.',
  'home.how.s2.title': 'Ajoutez vos produits',
  'home.how.s2.desc': 'Ajoutez produits avec photos et prix. Définissez les frais par wilaya.',
  'home.how.s3.title': 'Mettez en ligne',
  'home.how.s3.desc': 'Activez l\'agent. Il gère Messenger, crée les commandes, synchronise la caisse.',

  'home.pricing.title': 'Tarifs',
  'home.pricing.titleHighlight': 'simples',
  'home.pricing.subtitle': 'Choisissez le plan adapté à votre boutique',

  'home.cta.title.top': 'Prêt à',
  'home.cta.title.highlight': 'vendre en auto',
  'home.cta.title.bottom': 'sur Messenger ?',
  'home.cta.subtitle': 'Rejoignez les commerçants algériens qui utilisent Djaber pour répondre plus vite et conclure plus de commandes.',
  'home.cta.primary': 'Essai gratuit',
  'home.cta.secondary': 'Parler aux ventes',

  'footer.tagline': 'Automatisation IA des ventes Messenger pour l\'e-commerce algérien',
  'footer.product': 'Produit',
  'footer.company': 'Société',
  'footer.legal': 'Légal',
  'footer.rights': 'Tous droits réservés.',
};

const ar: Dict = {
  'auth.login.title': 'مرحبا بعودتك',
  'auth.login.subtitle': 'سجّل الدخول إلى حسابك للمتابعة',
  'auth.login.email': 'البريد الإلكتروني',
  'auth.login.password': 'كلمة المرور',
  'auth.login.forgot': 'نسيت؟',
  'auth.login.remember': 'تذكرني',
  'auth.login.submit': 'تسجيل الدخول',
  'auth.login.submitting': 'جاري تسجيل الدخول…',
  'auth.login.noAccount': 'ليس لديك حساب؟',
  'auth.login.signup': 'ابدأ الآن',

  'auth.signup.title': 'إنشاء حساب',
  'auth.signup.subtitle': 'ابدأ في أقل من دقيقة',
  'auth.signup.firstName': 'الاسم',
  'auth.signup.lastName': 'اللقب',
  'auth.signup.email': 'البريد الإلكتروني',
  'auth.signup.password': 'كلمة المرور',
  'auth.signup.passwordHint': '8 أحرف على الأقل',
  'auth.signup.submit': 'إنشاء الحساب',
  'auth.signup.submitting': 'جاري إنشاء الحساب…',
  'auth.signup.haveAccount': 'لديك حساب بالفعل؟',
  'auth.signup.signin': 'تسجيل الدخول',

  'auth.errors.invalidEmail': 'يرجى إدخال بريد إلكتروني صالح',
  'auth.errors.passwordTooShort': 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل',
  'auth.errors.firstNameRequired': 'الاسم مطلوب',
  'auth.errors.lastNameRequired': 'اللقب مطلوب',
  'auth.errors.emailRequired': 'البريد الإلكتروني مطلوب',
  'auth.errors.passwordRequired': 'كلمة المرور مطلوبة',
  'auth.errors.userExists': 'يوجد حساب بهذا البريد الإلكتروني بالفعل',
  'auth.errors.invalidCredentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'auth.errors.networkError': 'لا يمكن الوصول إلى الخادم. تحقق من اتصالك.',
  'auth.errors.unknown': 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',

  'auth.success.loggedIn': 'مرحبا بعودتك!',
  'auth.success.signedUp': 'تم إنشاء الحساب بنجاح!',

  'common.back': 'رجوع',
  'common.dismiss': 'إغلاق',

  'header.features': 'المميزات',
  'header.pricing': 'الأسعار',
  'header.docs': 'الوثائق',
  'header.login': 'تسجيل الدخول',
  'header.signup': 'ابدأ الآن',

  'home.hero.badge': 'مصمم للتجارة الإلكترونية في الجزائر',
  'home.hero.title.top': 'حوّل ماسنجر إلى',
  'home.hero.title.highlight': 'ماكينة بيع',
  'home.hero.subtitle':
    'وكيلك الذكي يرد على العملاء، يحسب الشحن عبر 58 ولاية، ويؤكد الطلبات — 24/7 بالعربية والفرنسية والدارجة.',
  'home.hero.cta.primary': 'جرّب مجانا',
  'home.hero.cta.secondary': 'شاهد العرض',

  'home.slogan.0': 'بيع وأنت نائم.',
  'home.slogan.1': 'ما تضيّع حتى زبون.',
  'home.slogan.2': 'أكّد. اشحن. اربح.',
  'home.slogan.3': 'وكيل بيع ذكي لا ينام.',

  'home.stats.messages': 'رسالة تمّت معالجتها',
  'home.stats.pages': 'صفحة نشطة',
  'home.stats.uptime': 'وقت التشغيل',
  'home.stats.response': 'زمن الرد',

  'home.features.title': 'مصمّم لطريقة بيعك',
  'home.features.subtitle': 'كل ميزة مضبوطة للتجارة الإلكترونية في الجزائر — ماسنجر، الدفع عند الاستلام، توصيل الولايات',
  'home.features.f1.title': 'ردود ماسنجر فورية',
  'home.features.f1.desc': 'الذكاء الاصطناعي يرد في أقل من ثانية. لا تترك زبونا ينتظر.',
  'home.features.f2.title': 'شحن ولاياتي تلقائي',
  'home.features.f2.desc': 'يحسب الشحن في 58 ولاية — توصيل للباب أو Stopdesk — بأسعارك أو عبر Yalidine / ZR / Maystro.',
  'home.features.f3.title': 'الدفع عند الاستلام',
  'home.features.f3.desc': 'تأكيد، تحضير، شحن، تسليم. يُسَجّل مدفوعا تلقائيا عند التسليم ويُحدّث الصندوق.',
  'home.features.f4.title': 'كتالوج منتجات + صور',
  'home.features.f4.desc': 'أضف منتجاتك بالصور والأسعار. الذكاء الاصطناعي يعرض بطاقات ويقارن صور العملاء ليجد منتجك.',
  'home.features.f5.title': 'مُدرَّب بلغتك',
  'home.features.f5.desc': 'اختر الشخصية، قواعد الإغلاق، ومتى يُحوَّل إلى إنسان.',
  'home.features.f6.title': 'تحويل إلى إنسان',
  'home.features.f6.desc': 'يتوقف الذكاء تلقائيا عند الشكاوى أو أي غموض — يُشعرك وينتظر ردّك.',

  'home.how.title': 'ابدأ في',
  'home.how.titleHighlight': '3 خطوات',
  'home.how.subtitle': 'اربط صفحة فيسبوك ودع الوكيل يتولى الأمر',
  'home.how.s1.title': 'اربط صفحتك',
  'home.how.s1.desc': 'اربط صفحة الأعمال عبر Meta OAuth بنقرة واحدة.',
  'home.how.s2.title': 'أضف منتجاتك',
  'home.how.s2.desc': 'ارفع منتجاتك بالصور والأسعار. حدّد تكلفة الشحن لكل ولاية.',
  'home.how.s3.title': 'انطلق',
  'home.how.s3.desc': 'فعّل الوكيل. سيتولى ماسنجر، يُنشئ الطلبات، ويُزامن صندوقك.',

  'home.pricing.title': 'أسعار',
  'home.pricing.titleHighlight': 'بسيطة',
  'home.pricing.subtitle': 'اختر الخطة المناسبة لمتجرك',

  'home.cta.title.top': 'جاهز للبيع',
  'home.cta.title.highlight': 'تلقائيا',
  'home.cta.title.bottom': 'على ماسنجر؟',
  'home.cta.subtitle': 'انضم إلى التجار الجزائريين الذين يستعملون دجابر للرد أسرع وإغلاق طلبات أكثر.',
  'home.cta.primary': 'جرّب مجانا',
  'home.cta.secondary': 'تحدث إلى المبيعات',

  'footer.tagline': 'أتمتة مبيعات ماسنجر بالذكاء الاصطناعي للتجارة الإلكترونية الجزائرية',
  'footer.product': 'المنتج',
  'footer.company': 'الشركة',
  'footer.legal': 'قانوني',
  'footer.rights': 'جميع الحقوق محفوظة.',
};

const dictionaries: Record<Lang, Dict> = { en, fr, ar };

export function getLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored === 'en' || stored === 'fr' || stored === 'ar') return stored;
  // Auto-detect from browser
  const browser = (navigator.language || '').toLowerCase();
  if (browser.startsWith('ar')) return 'ar';
  if (browser.startsWith('fr')) return 'fr';
  return DEFAULT_LANG;
}

export function setLang(lang: Lang): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent('lang-change', { detail: lang }));
}

export function getDir(lang: Lang = getLang()): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function t(key: string, fallback?: string): string {
  const lang = getLang();
  const v = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? fallback ?? key;
  return typeof v === 'string' ? v : String(v);
}

export function translateFor(lang: Lang, key: string, fallback?: string): string {
  const v = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? fallback ?? key;
  return typeof v === 'string' ? v : String(v);
}

/**
 * Map a backend error message (English) to a translation key.
 */
export function translateBackendError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('already exists')) return t('auth.errors.userExists');
  if (m.includes('invalid email or password')) return t('auth.errors.invalidCredentials');
  if (m.includes('failed to fetch') || m.includes('networkerror')) return t('auth.errors.networkError');
  if (m.includes('valid email')) return t('auth.errors.invalidEmail');
  if (m.includes('8 characters')) return t('auth.errors.passwordTooShort');
  return message || t('auth.errors.unknown');
}
