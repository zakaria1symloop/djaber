/**
 * Simple, dependency-free i18n.
 *
 * Stores the active language in localStorage under "lang".
 * Falls back to English if a key is missing.
 *
 * Usage:
 *   import { t, getLang, setLang } from '@/lib/i18n';
 *   t('auth.login.title')           // → "Sign in to your account"
 *   t('auth.errors.invalidEmail')   // → "Please enter a valid email"
 */

export type Lang = 'en' | 'fr' | 'ar';

const STORAGE_KEY = 'lang';
const DEFAULT_LANG: Lang = 'en';

const dictionaries: Record<Lang, Record<string, string>> = {
  en: {
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
  },

  fr: {
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
  },

  ar: {
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
  },
};

export function getLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && (stored === 'en' || stored === 'fr' || stored === 'ar')) return stored;
  return DEFAULT_LANG;
}

export function setLang(lang: Lang): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new Event('lang-change'));
}

export function t(key: string, fallback?: string): string {
  const lang = getLang();
  return dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? fallback ?? key;
}

/**
 * Map a backend error message (English) to a translation key.
 * Backend errors come back as plain English; we recognize common ones
 * and route them through the translator.
 */
export function translateBackendError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already exists')) return t('auth.errors.userExists');
  if (m.includes('invalid email or password')) return t('auth.errors.invalidCredentials');
  if (m.includes('failed to fetch') || m.includes('networkerror')) return t('auth.errors.networkError');
  if (m.includes('valid email')) return t('auth.errors.invalidEmail');
  if (m.includes('8 characters')) return t('auth.errors.passwordTooShort');
  return message || t('auth.errors.unknown');
}
