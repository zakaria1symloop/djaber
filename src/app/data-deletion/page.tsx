'use client';

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Djaber.ai</p>
        <h1 className="text-3xl font-bold text-white mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
          Suppression de vos données / Data Deletion
        </h1>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold mb-2">🇫🇷 Français</h2>
            <p className="text-zinc-400 mb-3">
              Djaber.ai conserve les conversations Messenger/Instagram échangées avec les pages de nos
              marchands afin de fournir des réponses automatiques. Pour demander la suppression de vos
              données, vous pouvez&nbsp;:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-zinc-400">
              <li>
                Ouvrir <span className="text-zinc-200">Paramètres Facebook → Applications et sites web → Djaber.ai →
                Supprimer</span> — la suppression est traitée automatiquement via notre point de terminaison
                officiel de suppression de données.
              </li>
              <li>
                Ou envoyer un e-mail à <a href="mailto:contact@djaber.ai" className="text-white underline">contact@djaber.ai</a>{' '}
                en précisant le nom de la page concernée — nous supprimons vos conversations sous 30 jours.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-white font-semibold mb-2">🇬🇧 English</h2>
            <p className="text-zinc-400 mb-3">
              Djaber.ai stores the Messenger/Instagram conversations you exchange with our merchants&apos;
              pages in order to provide automatic replies. To request deletion of your data you can:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-zinc-400">
              <li>
                Open <span className="text-zinc-200">Facebook Settings → Apps and Websites → Djaber.ai → Remove</span> —
                deletion is processed automatically through our official data-deletion endpoint.
              </li>
              <li>
                Or email <a href="mailto:contact@djaber.ai" className="text-white underline">contact@djaber.ai</a>{' '}
                mentioning the page you talked to — we delete your conversations within 30 days.
              </li>
            </ol>
          </section>

          <section className="border-t border-white/10 pt-6">
            <p className="text-zinc-500 text-xs">
              What gets deleted: your conversation threads, message contents, and any customer record
              created from your chats. See also our{' '}
              <a href="/privacy" className="text-zinc-300 underline">Privacy Policy</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
