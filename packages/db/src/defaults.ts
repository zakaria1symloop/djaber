// Defaults copied into a workspace at creation (07-non-functional §7): system messages, quick replies, fee table.

export type Localized = { fr: string; ar: string; en: string };

/** 06-i18n-copy-deck §2.11 — the 4 workspace-editable customer messages (D43, R-G). */
export const DEFAULT_SYSTEM_MESSAGES: Record<'handoff' | 'out_of_hours' | 'out_of_stock' | 'welcome', Localized> = {
  handoff: {
    fr: "Je transmets à un membre de l'équipe qui vous répondra très vite.",
    ar: 'سأحوّلك إلى أحد أفراد الفريق ليرد عليك قريبًا.',
    en: "I'm passing this to a team member who will reply shortly.",
  },
  out_of_hours: {
    fr: "Notre équipe est absente pour le moment, je prends votre commande en attendant et nous vous rappelons dès l'ouverture.",
    ar: 'فريقنا غير متاح حاليًا، سأسجّل طلبك في الأثناء وسنتصل بك عند الفتح.',
    en: "Our team is away right now; I'll take your order meanwhile and we'll call you back at opening.",
  },
  out_of_stock: {
    fr: 'Désolé, {product} est en rupture de stock pour le moment.',
    ar: 'عذرًا، {product} غير متوفر حاليًا.',
    en: 'Sorry, {product} is out of stock right now.',
  },
  welcome: {
    fr: 'Bonjour 👋 Bienvenue chez {shop} ! Comment puis-je vous aider ?',
    ar: 'مرحبًا 👋 أهلًا بك في {shop}! كيف يمكنني مساعدتك؟',
    en: 'Hello 👋 Welcome to {shop}! How can I help you?',
  },
};

/** Fixed platform texts (not workspace-editable). */
export const PLATFORM_CUSTOMER_MESSAGES: Record<'unavailable' | 'unsupportedMedia' | 'voiceFailed', Localized> = {
  unavailable: {
    fr: "Désolé, notre assistant est momentanément indisponible. Un membre de l'équipe vous répondra bientôt. 🙏",
    ar: 'عذرًا، المساعد غير متاح حاليًا. سيرد عليك أحد أفراد الفريق قريبًا. 🙏',
    en: 'Sorry, our assistant is temporarily unavailable. A team member will reply soon. 🙏',
  },
  unsupportedMedia: {
    fr: 'Je ne peux pas lire ce type de message. Envoyez-moi un texte ou une photo 😊',
    ar: 'لا أستطيع قراءة هذا النوع من الرسائل. أرسل نصًا أو صورة 😊',
    en: "I can't read this type of message. Please send text or a photo 😊",
  },
  voiceFailed: {
    fr: "Je n'ai pas réussi à écouter votre vocal, pouvez-vous l'écrire ?",
    ar: 'لم أتمكن من سماع رسالتك الصوتية، هل يمكنك كتابتها؟',
    en: "I couldn't hear your voice note, could you type it?",
  },
};

/** 4 default quick replies × 3 locales (greeting, delivery info, thanks for order, hours). */
export const DEFAULT_QUICK_REPLIES: { shortcut: string; title: Localized; body: Localized }[] = [
  {
    shortcut: 'bonjour',
    title: { fr: 'Salutation', ar: 'تحية', en: 'Greeting' },
    body: {
      fr: 'Bonjour 👋 Merci pour votre message ! Comment puis-je vous aider ?',
      ar: 'مرحبًا 👋 شكرًا على رسالتك! كيف يمكنني مساعدتك؟',
      en: 'Hello 👋 Thanks for your message! How can I help you?',
    },
  },
  {
    shortcut: 'livraison',
    title: { fr: 'Infos livraison', ar: 'معلومات التوصيل', en: 'Delivery info' },
    body: {
      fr: 'Nous livrons dans les 58 wilayas, paiement à la livraison. Délai : 24 à 72 h selon la wilaya.',
      ar: 'نوصل إلى 58 ولاية والدفع عند الاستلام. المدة: من 24 إلى 72 ساعة حسب الولاية.',
      en: 'We deliver to all 58 wilayas, cash on delivery. Lead time: 24 to 72 h depending on the wilaya.',
    },
  },
  {
    shortcut: 'merci',
    title: { fr: 'Merci pour la commande', ar: 'شكرًا على الطلب', en: 'Thanks for your order' },
    body: {
      fr: 'Merci pour votre commande 🙏 Nous vous appelons très vite pour la confirmer.',
      ar: 'شكرًا على طلبك 🙏 سنتصل بك قريبًا لتأكيده.',
      en: 'Thank you for your order 🙏 We will call you shortly to confirm it.',
    },
  },
  {
    shortcut: 'horaires',
    title: { fr: 'Horaires', ar: 'أوقات العمل', en: 'Opening hours' },
    body: {
      fr: 'Nous répondons du samedi au jeudi, de 9 h à 18 h.',
      ar: 'نرد من السبت إلى الخميس، من 9 صباحًا إلى 6 مساءً.',
      en: 'We reply Saturday to Thursday, 9 am to 6 pm.',
    },
  },
];

type Fee = { home: number; stopdesk: number; return: number };
const f = (home: number, stopdesk: number, ret: number): Fee => ({ home, stopdesk, return: ret });
const group = (ids: number[], fee: Fee) => Object.fromEntries(ids.map((id) => [id, fee]));

/** V1 default fee table (DA) per wilaya id; unknown wilaya ⇒ FALLBACK_FEE. */
export const DEFAULT_FEES: Record<number, Fee> = {
  ...group([16], f(400, 250, 200)),
  ...group([9, 35, 42], f(450, 300, 200)),
  ...group([6, 10, 15, 19, 26, 34, 43, 44, 31], f(600, 400, 300)),
  ...group([25, 4, 5, 18, 21, 23, 24, 13, 22, 46, 17], f(700, 450, 300)),
  ...group([36, 40, 41], f(750, 500, 350)),
  ...group([27, 29, 48, 14, 20, 28, 38], f(650, 400, 300)),
  ...group([2], f(550, 400, 300)),
  ...group([3, 7, 12], f(800, 500, 400)),
  ...group([32, 39, 45, 47], f(900, 600, 400)),
  ...group([51, 55, 57, 58], f(950, 650, 450)),
  ...group([1], f(1200, 800, 500)),
  ...group([8, 30], f(1100, 700, 500)),
  ...group([11, 37], f(1400, 900, 600)),
  ...group([49, 52], f(1300, 850, 600)),
  ...group([33, 50, 53, 56], f(1500, 1000, 700)),
  ...group([54], f(1600, 1100, 700)),
};
export const FALLBACK_FEE: Fee = f(800, 500, 400);
export const defaultFeeFor = (wilayaId: number): Fee => DEFAULT_FEES[wilayaId] ?? FALLBACK_FEE;
