// Draft of the product form in `sessionStorage`, keyed by route (02-next-route-map §6 "Drafts"): restored after a
// session-expired re-login, cleared on save / cancel. Only form values are stored (no token, no file), together with
// the server version they were typed on, so the draft can be replayed on a newer version (`rebaseForm`).
import { emptyForm, type ProductFormValues } from './model';

export type FormDraft = { values: ProductFormValues; base: ProductFormValues };
const keyOf = (route: string) => `djaber.draft:${route}`;
const valid = (v: unknown): v is ProductFormValues => !!v && typeof v === 'object' && typeof (v as ProductFormValues).name === 'string' && Array.isArray((v as ProductFormValues).variants);

export function readDraft(route: string): FormDraft | null {
  try {
    const raw = window.sessionStorage.getItem(keyOf(route));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormDraft>;
    if (!valid(parsed.values) || !valid(parsed.base)) return null;
    return { values: { ...emptyForm(), ...parsed.values }, base: { ...emptyForm(), ...parsed.base } };
  } catch {
    return null;
  }
}

export function writeDraft(route: string, draft: FormDraft) {
  try {
    window.sessionStorage.setItem(keyOf(route), JSON.stringify(draft));
  } catch {
    // storage full or blocked: the draft is a convenience
  }
}

export function clearDraft(route: string) {
  try {
    window.sessionStorage.removeItem(keyOf(route));
  } catch {}
}
