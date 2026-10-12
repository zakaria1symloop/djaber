// /s/[code] — public parcel tracking (QR on the label). No layout group: PublicLayout header only (02 §1).
import { PublicTrackingPage } from '@/features/delivery/public/tracking-page';

export default async function TrackingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PublicTrackingPage code={decodeURIComponent(code)} />;
}
