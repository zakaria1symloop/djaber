// /settings/integrations/[tab] — Figma "SET — Settings — Integrations (Sheets · API keys · webhooks)" + the dialogs
// "Google Sheets — choisir la feuille" and "Webhook sortant" of "DLG — Settings & billing — dialogs catalogue".
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { IntegrationTabPage } from '@/features/integrations/tab-page';
import { isIntegrationTab } from '@/features/integrations/tabs';

export default async function IntegrationsTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!isIntegrationTab(tab)) notFound();
  return (
    <Suspense fallback={null}>
      <IntegrationTabPage tab={tab} />
    </Suspense>
  );
}
