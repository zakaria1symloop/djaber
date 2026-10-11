// /inbox, /inbox/[conversationId] — Figma "INB — Inbox — thread with handoff" / "INB — Inbox — AR (RTL)".
// The three panes are rendered by the layout: the list keeps its state while the thread segment changes.
import { Suspense, type ReactNode } from 'react';
import { InboxView } from '@/features/inbox/inbox-view';

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <InboxView />
      {children}
    </Suspense>
  );
}
