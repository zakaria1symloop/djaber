// /channels/connect/return — where the API callback lands when the connect flow ran in this tab (pop-up blocked) or
// when the callback page redirects instead of posting to its opener.
import { Suspense } from 'react';
import { ConnectReturn } from '@/features/channels/connect-return';

export default function ConnectReturnPage() {
  return (
    <Suspense fallback={null}>
      <ConnectReturn />
    </Suspense>
  );
}
