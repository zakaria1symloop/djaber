import type { Lang } from '../../errors';

interface Copy {
  subject: string;
  hello: (name: string) => string;
  intro: string;
  button: string;
  expiry: (minutes: number) => string;
  fallback: string;
  ignore: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    subject: 'Reset your Djaber.ai password',
    hello: (n) => `Hello ${n},`,
    intro: 'We received a request to reset the password of your Djaber.ai account.',
    button: 'Choose a new password',
    expiry: (m) => `This link expires in ${m} minutes and works only once.`,
    fallback: 'If the button does not work, copy this link into your browser:',
    ignore: 'If you did not ask for this, you can ignore this e-mail. Your password stays the same.',
  },
  fr: {
    subject: 'Réinitialisez votre mot de passe Djaber.ai',
    hello: (n) => `Bonjour ${n},`,
    intro: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Djaber.ai.',
    button: 'Choisir un nouveau mot de passe',
    expiry: (m) => `Ce lien expire dans ${m} minutes et ne fonctionne qu’une seule fois.`,
    fallback: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail. Votre mot de passe reste inchangé.',
  },
  ar: {
    subject: 'إعادة تعيين كلمة مرور Djaber.ai',
    hello: (n) => `مرحبًا ${n}،`,
    intro: 'تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك على Djaber.ai.',
    button: 'اختيار كلمة مرور جديدة',
    expiry: (m) => `تنتهي صلاحية هذا الرابط خلال ${m} دقيقة ويمكن استخدامه مرة واحدة فقط.`,
    fallback: 'إذا لم يعمل الزر، انسخ هذا الرابط في متصفحك:',
    ignore: 'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة. تبقى كلمة مرورك كما هي.',
  },
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildPasswordResetEmail(
  lang: Lang,
  data: { firstName: string; link: string; minutes: number }
): { subject: string; html: string; text: string } {
  const c = COPY[lang] ?? COPY.en;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  const name = escapeHtml(data.firstName || '');
  const link = escapeHtml(data.link);

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
        <tr><td style="padding:28px 32px 0;text-align:${align};font-family:Arial,Helvetica,sans-serif;">
          <div style="font-size:20px;font-weight:700;color:#0a0a0a;">Djaber<span style="color:#71717a;">.ai</span></div>
        </td></tr>
        <tr><td dir="${dir}" style="padding:20px 32px 8px;text-align:${align};font-family:Arial,Helvetica,sans-serif;color:#18181b;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px;">${c.hello(name)}</p>
          <p style="margin:0 0 24px;">${c.intro}</p>
          <p style="margin:0 0 24px;text-align:center;">
            <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:999px;">${c.button}</a>
          </p>
          <p style="margin:0 0 16px;color:#52525b;font-size:13px;">${c.expiry(data.minutes)}</p>
          <p style="margin:0 0 6px;color:#71717a;font-size:12px;">${c.fallback}</p>
          <p dir="ltr" style="margin:0 0 20px;font-size:12px;word-break:break-all;text-align:left;"><a href="${link}" style="color:#3f3f46;">${link}</a></p>
        </td></tr>
        <tr><td dir="${dir}" style="padding:16px 32px 28px;border-top:1px solid #f4f4f5;text-align:${align};font-family:Arial,Helvetica,sans-serif;color:#a1a1aa;font-size:12px;line-height:1.5;">
          ${c.ignore}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    c.hello(data.firstName || ''),
    '',
    c.intro,
    '',
    `${c.button}: ${data.link}`,
    '',
    c.expiry(data.minutes),
    '',
    c.ignore,
  ].join('\n');

  return { subject: c.subject, html, text };
}
