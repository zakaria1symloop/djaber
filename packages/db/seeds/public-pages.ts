// M11 (PUB-02 / PUB-04, route map §3.1) — CMS entries of the public site: landing hero, the 6 feature blocks, the pricing FAQ
// (5 questions, Figma "PUB — Pricing page"), cookies and the Meta data-deletion explanation. Markdown bodies; `features` and
// `pricing-faq` use one `## ` section per block / question. Idempotent: an existing entry is never overwritten (edited in the CMS).
import { rawPrisma as db } from '../src/client';

type L = { fr: string; ar: string; en: string };
const l = (fr: string, ar: string, en: string): L => ({ fr, ar, en });
type Doc = { key: string; type: 'page' | 'legal'; category: string; title: L; body: L; sortOrder: number };

const DOCS: Doc[] = [
  {
    key: 'landing',
    type: 'page',
    category: 'landing',
    sortOrder: 0,
    title: l('Votre vendeur IA sur Messenger & Instagram', 'بائعك الذكي على ماسنجر وإنستغرام', 'Your AI salesperson on Messenger & Instagram'),
    body: l(
      'Répond en darija, prend les commandes, organise la livraison. Essai gratuit 14 jours.',
      'يرد بالدارجة، يأخذ الطلبات وينظّم التوصيل. تجربة مجانية لمدة 14 يومًا.',
      'Answers in Darija, takes the orders, organises the delivery. 14-day free trial.',
    ),
  },
  {
    key: 'features',
    type: 'page',
    category: 'features',
    sortOrder: 1,
    title: l('Fonctionnalités', 'الميزات', 'Features'),
    body: l(
      [
        '## Un vendeur IA qui répond 24 h/24',
        'L’agent répond en darija, en arabe, en français ou en anglais, comprend les photos et les messages vocaux, et passe la main à votre équipe quand il le faut.',
        '## Les commandes prises dans la conversation',
        'Produit, variante, quantité, adresse et téléphone : la commande est créée, le stock réservé et vous êtes notifié.',
        '## La livraison organisée',
        'Envoi en un clic chez ZR Express, EcoTrack ou Yalidine, bordereaux, suivi des colis et page de suivi pour vos clients.',
        '## Le stock à jour',
        'Produits, variantes, alertes de stock bas, achats, ventes au comptoir, caisse et inventaire.',
        '## Des statistiques claires',
        'Conversations, réponses de l’IA, commandes, revenus et livraisons, avec des rapports exportables.',
        '## L’application mobile',
        'Votre boîte de réception, vos commandes et votre stock dans la poche, avec les notifications en temps réel.',
      ].join('\n\n'),
      [
        '## بائع ذكي يرد على مدار الساعة',
        'يرد الوكيل بالدارجة والعربية والفرنسية والإنجليزية، ويفهم الصور والرسائل الصوتية، ويحيل المحادثة إلى فريقك عند الحاجة.',
        '## الطلبات تُؤخذ داخل المحادثة',
        'المنتج والنوع والكمية والعنوان والهاتف: يُنشأ الطلب ويُحجز المخزون وتصلك إشعارات.',
        '## التوصيل منظّم',
        'إرسال بنقرة واحدة إلى ZR Express أو EcoTrack أو Yalidine، مع الوصولات وتتبع الطرود وصفحة تتبع لزبائنك.',
        '## مخزون محدّث',
        'المنتجات والأنواع وتنبيهات نفاد المخزون والمشتريات والبيع المباشر والصندوق والجرد.',
        '## إحصائيات واضحة',
        'المحادثات وردود الذكاء الاصطناعي والطلبات والمداخيل والتوصيل، مع تقارير قابلة للتصدير.',
        '## تطبيق الهاتف',
        'صندوق الرسائل والطلبات والمخزون في جيبك، مع إشعارات فورية.',
      ].join('\n\n'),
      [
        '## An AI salesperson that answers 24/7',
        'The agent answers in Darija, Arabic, French or English, understands photos and voice messages, and hands over to your team when needed.',
        '## Orders taken in the conversation',
        'Product, variant, quantity, address and phone: the order is created, the stock reserved and you are notified.',
        '## Delivery organised',
        'One-click sending to ZR Express, EcoTrack or Yalidine, labels, parcel tracking and a tracking page for your customers.',
        '## Stock always up to date',
        'Products, variants, low-stock alerts, purchases, counter sales, cash register and inventory.',
        '## Clear statistics',
        'Conversations, AI replies, orders, revenue and deliveries, with exportable reports.',
        '## The mobile app',
        'Your inbox, orders and stock in your pocket, with real-time notifications.',
      ].join('\n\n'),
    ),
  },
  {
    key: 'pricing-faq',
    type: 'page',
    category: 'pricing',
    sortOrder: 2,
    title: l('Questions fréquentes', 'أسئلة شائعة', 'Frequently asked questions'),
    body: l(
      [
        '## C’est quoi un crédit ?',
        '1 crédit = 1 réponse texte de l’IA. Une photo analysée ou un message vocal transcrit coûte quelques crédits de plus. Chaque plan inclut des crédits chaque mois, et des packs sont disponibles à partir de 450 DA.',
        '## Que se passe-t-il quand mes crédits sont épuisés ?',
        'L’IA cesse de répondre et les nouvelles conversations arrivent dans votre boîte de réception pour une réponse manuelle. Achetez un pack ou attendez le renouvellement mensuel : les crédits des packs n’expirent jamais.',
        '## Puis-je changer de plan à tout moment ?',
        'Oui. Le passage à un plan supérieur est immédiat (au prorata) ; le passage à un plan inférieur s’applique au renouvellement.',
        '## Comment payer ? (CIB, Edahabia, virement)',
        'Par carte CIB ou Edahabia via Chargily, ou par virement / CCP sur facture. Les prix sont en dinars, TTC, sans engagement.',
        '## Mes données sont-elles en sécurité ?',
        'Vos données restent à vous : jetons chiffrés, accès par rôle, journal d’audit, et suppression du compte possible à tout moment.',
      ].join('\n\n'),
      [
        '## ما هو الرصيد؟',
        'رصيد واحد = رد نصي واحد من الذكاء الاصطناعي. تحليل صورة أو تفريغ رسالة صوتية يكلف بضعة أرصدة إضافية. كل خطة تتضمن أرصدة شهرية، وتتوفر حزم ابتداءً من 450 دج.',
        '## ماذا يحدث عند نفاد رصيدي؟',
        'يتوقف الذكاء الاصطناعي عن الرد وتصل المحادثات الجديدة إلى صندوق رسائلك للرد اليدوي. اشترِ حزمة أو انتظر التجديد الشهري: أرصدة الحزم لا تنتهي صلاحيتها.',
        '## هل يمكنني تغيير الخطة في أي وقت؟',
        'نعم. الترقية فورية (بالتناسب)، والانتقال إلى خطة أدنى يُطبّق عند التجديد.',
        '## كيف أدفع؟ (CIB، الذهبية، تحويل)',
        'ببطاقة CIB أو الذهبية عبر Chargily، أو بتحويل / CCP على الفاتورة. الأسعار بالدينار، شاملة الرسوم، دون التزام.',
        '## هل بياناتي آمنة؟',
        'بياناتك ملك لك: رموز مشفّرة، صلاحيات حسب الدور، سجل تدقيق، وإمكانية حذف الحساب في أي وقت.',
      ].join('\n\n'),
      [
        '## What is a credit?',
        '1 credit = 1 AI text reply. An analysed photo or a transcribed voice message costs a few more credits. Every plan includes monthly credits, and packs start at 450 DA.',
        '## What happens when my credits run out?',
        'The AI stops answering and new conversations land in your inbox for a manual reply. Buy a pack or wait for the monthly renewal: pack credits never expire.',
        '## Can I change plans at any time?',
        'Yes. Upgrading is immediate (prorated); downgrading applies at renewal.',
        '## How do I pay? (CIB, Edahabia, transfer)',
        'By CIB or Edahabia card through Chargily, or by bank transfer / CCP on invoice. Prices are in dinars, taxes included, no commitment.',
        '## Is my data safe?',
        'Your data stays yours: encrypted tokens, role-based access, audit log, and account deletion at any time.',
      ].join('\n\n'),
    ),
  },
  {
    key: 'cookies',
    type: 'legal',
    category: 'legal',
    sortOrder: 10,
    title: l('Politique de cookies', 'سياسة ملفات تعريف الارتباط', 'Cookie policy'),
    body: l(
      'Djaber n’utilise que les cookies nécessaires au fonctionnement du service (session et sécurité). Aucun cookie publicitaire n’est déposé.',
      'لا يستخدم جابر إلا ملفات تعريف الارتباط الضرورية لعمل الخدمة (الجلسة والأمان). لا تُستخدم أي ملفات إعلانية.',
      'Djaber only uses the cookies required to run the service (session and security). No advertising cookie is set.',
    ),
  },
  {
    key: 'data-deletion',
    type: 'legal',
    category: 'legal',
    sortOrder: 11,
    title: l('Suppression des données (Facebook / Instagram)', 'حذف البيانات (فيسبوك / إنستغرام)', 'Data deletion (Facebook / Instagram)'),
    body: l(
      'Si vous avez écrit à une boutique qui utilise Djaber, vous pouvez demander la suppression de vos données depuis les paramètres de Facebook (Applications et sites web › Djaber › Supprimer). Vous recevez un code de suivi ; le traitement est fait sous 30 jours. Les commandes déjà livrées restent dans les factures des marchands, sans votre nom (obligation légale).',
      'إذا راسلت متجرًا يستخدم جابر، يمكنك طلب حذف بياناتك من إعدادات فيسبوك (التطبيقات والمواقع › جابر › حذف). ستتلقى رمز متابعة، وتتم المعالجة خلال 30 يومًا. تبقى الطلبات المسلّمة في فواتير التجار دون اسمك (التزام قانوني).',
      'If you wrote to a shop that uses Djaber, you can ask for your data to be deleted from the Facebook settings (Apps and websites › Djaber › Remove). You receive a tracking code; processing takes up to 30 days. Orders already delivered stay in the merchants’ invoices, without your name (legal obligation).',
    ),
  },
];

export async function seedPublicPages(adminId: string) {
  const locales = ['fr', 'ar', 'en'] as const;
  let created = 0;
  for (const d of DOCS) {
    if (await db.cmsEntry.findUnique({ where: { key: d.key } })) continue;
    await db.cmsEntry.create({
      data: {
        key: d.key,
        type: d.type,
        category: d.category,
        sortOrder: d.sortOrder,
        status: 'published',
        currentVersion: 1,
        createdById: adminId,
        locales: { create: locales.map((locale) => ({ locale, title: d.title[locale], body: d.body[locale], status: 'published' as const, updatedById: adminId })) },
        versions: { create: { version: 1, snapshot: { title: d.title, body: d.body }, createdById: adminId } },
      },
    });
    created++;
  }
  return created;
}
