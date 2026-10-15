'use client';
// "Quitter sans enregistrer ?" for dialogs and side sheets: closing (✕, Esc, overlay, Annuler) while the user has typed
// something asks first (12 GLOBAL "leave guard"); `useLeaveGuard` (lib/forms) only covers links and tab closing.
import { useEffect, useState, type ReactNode } from 'react';
import { LeaveGuardDialog } from './global-states';

export function useCloseGuard(dirty: boolean, name: string, onClose: () => void): { requestClose: () => void; element: ReactNode } {
  const [asking, setAsking] = useState(false);
  const requestClose = () => (dirty ? setAsking(true) : onClose());
  const element = (
    <LeaveGuardDialog
      open={asking}
      name={name}
      onStay={() => setAsking(false)}
      onLeave={() => {
        setAsking(false);
        onClose();
      }}
    />
  );
  return { requestClose, element };
}

/**
 * "The user typed something" for a dialog: put `onChange` on the wrapper of its fields (React change events bubble from
 * inputs, selects and text areas; values set by the code do not fire them). Cleared when the dialog closes.
 */
export function useTypedFlag(open: boolean): { dirty: boolean; onChange: () => void; reset: () => void } {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!open) setDirty(false);
  }, [open]);
  return { dirty, onChange: () => setDirty(true), reset: () => setDirty(false) };
}
