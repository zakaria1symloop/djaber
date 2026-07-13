import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'fr' | 'ar';

const dict: Record<Lang, Record<string, string>> = {
  en: {
    'app.name': 'Djaber',
    'login.title': 'Sign in',
    'login.subtitle': 'AI customer service in your pocket',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.loading': 'Signing in…',
    'login.error': 'Invalid email or password',
    'login.noAccount': "No account? Sign up",
    'signup.title': 'Create account',
    'signup.subtitle': 'Start answering customers with AI',
    'signup.firstName': 'First name',
    'signup.lastName': 'Last name',
    'signup.submit': 'Create account',
    'signup.loading': 'Creating account…',
    'signup.error': 'Could not create the account',
    'signup.haveAccount': 'Already have an account? Sign in',
    'inbox.title': 'Inbox',
    'inbox.empty': 'No conversations yet',
    'inbox.needsHuman': 'Needs human',
    'inbox.aiOn': 'AI',
    'inbox.refresh': 'Pull to refresh',
    'inbox.logout': 'Logout',
    'inbox.loading': 'Loading conversations…',
    'conv.reply': 'Write a reply…',
    'conv.send': 'Send',
    'conv.aiPausedBanner': 'AI is paused — you are handling this conversation',
    'conv.resumeAi': 'Resume AI',
    'conv.resumed': 'AI resumed for this conversation',
    'conv.sendError': 'Failed to send. Try again.',
    'conv.outsideWindow': 'Outside the 24h reply window',
    'common.customer': 'Customer',
    'common.now': 'now',
    'common.error': 'Something went wrong',
    'common.retry': 'Retry',
  },
  fr: {
    'app.name': 'Djaber',
    'login.title': 'Connexion',
    'login.subtitle': 'Service client IA dans votre poche',
    'login.email': 'Email',
    'login.password': 'Mot de passe',
    'login.submit': 'Se connecter',
    'login.loading': 'Connexion…',
    'login.error': 'Email ou mot de passe invalide',
    'login.noAccount': "Pas de compte ? S'inscrire",
    'signup.title': 'Créer un compte',
    'signup.subtitle': "Commencez à répondre à vos clients avec l'IA",
    'signup.firstName': 'Prénom',
    'signup.lastName': 'Nom',
    'signup.submit': 'Créer le compte',
    'signup.loading': 'Création du compte…',
    'signup.error': 'Impossible de créer le compte',
    'signup.haveAccount': 'Déjà un compte ? Se connecter',
    'inbox.title': 'Boîte de réception',
    'inbox.empty': 'Aucune conversation',
    'inbox.needsHuman': 'Humain requis',
    'inbox.aiOn': 'IA',
    'inbox.refresh': 'Tirer pour actualiser',
    'inbox.logout': 'Déconnexion',
    'inbox.loading': 'Chargement des conversations…',
    'conv.reply': 'Écrire une réponse…',
    'conv.send': 'Envoyer',
    'conv.aiPausedBanner': "L'IA est en pause — vous gérez cette conversation",
    'conv.resumeAi': "Réactiver l'IA",
    'conv.resumed': 'IA réactivée pour cette conversation',
    'conv.sendError': "Échec de l'envoi. Réessayez.",
    'conv.outsideWindow': 'Hors de la fenêtre de réponse de 24h',
    'common.customer': 'Client',
    'common.now': 'maintenant',
    'common.error': 'Une erreur est survenue',
    'common.retry': 'Réessayer',
  },
  ar: {
    'app.name': 'جابر',
    'login.title': 'تسجيل الدخول',
    'login.subtitle': 'خدمة عملاء بالذكاء الاصطناعي في جيبك',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.submit': 'تسجيل الدخول',
    'login.loading': 'جارٍ تسجيل الدخول…',
    'login.error': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'login.noAccount': 'ليس لديك حساب؟ سجّل الآن',
    'signup.title': 'إنشاء حساب',
    'signup.subtitle': 'ابدأ بالرد على عملائك بالذكاء الاصطناعي',
    'signup.firstName': 'الاسم',
    'signup.lastName': 'اللقب',
    'signup.submit': 'إنشاء الحساب',
    'signup.loading': 'جارٍ إنشاء الحساب…',
    'signup.error': 'تعذر إنشاء الحساب',
    'signup.haveAccount': 'لديك حساب بالفعل؟ تسجيل الدخول',
    'inbox.title': 'الرسائل',
    'inbox.empty': 'لا توجد محادثات بعد',
    'inbox.needsHuman': 'يحتاج تدخل بشري',
    'inbox.aiOn': 'ذكاء اصطناعي',
    'inbox.refresh': 'اسحب للتحديث',
    'inbox.logout': 'تسجيل الخروج',
    'inbox.loading': 'جارٍ تحميل المحادثات…',
    'conv.reply': 'اكتب ردًا…',
    'conv.send': 'إرسال',
    'conv.aiPausedBanner': 'الذكاء الاصطناعي متوقف — أنت تتولى هذه المحادثة',
    'conv.resumeAi': 'إعادة تشغيل الذكاء الاصطناعي',
    'conv.resumed': 'تم استئناف الذكاء الاصطناعي لهذه المحادثة',
    'conv.sendError': 'فشل الإرسال. حاول مرة أخرى.',
    'conv.outsideWindow': 'خارج نافذة الرد البالغة 24 ساعة',
    'common.customer': 'عميل',
    'common.now': 'الآن',
    'common.error': 'حدث خطأ ما',
    'common.retry': 'إعادة المحاولة',
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  isRTL: false,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem('lang').then((saved) => {
      if (saved === 'en' || saved === 'fr' || saved === 'ar') setLangState(saved);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('lang', l).catch(() => {});
  };

  const t = (key: string) => dict[lang][key] ?? dict.en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRTL: lang === 'ar' }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
