// Google Picker (GSH-02 "choose via Google Picker", scope `drive.file`) for the live Google driver only — with the
// simulated Google (SHEETS_DRIVER=fake, dev / test) the dialog lists `files` from the picker token and never loads this.
// Written against the documented Picker API; never run locally (no Google OAuth client exists — carry-overs M11 "Live
// Google Sheets driver").
type PickerDoc = { id: string; name: string };
type PickerResponse = { action: string; docs?: PickerDoc[] };
type PickerBuilder = {
  addView: (v: unknown) => PickerBuilder;
  setOAuthToken: (t: string) => PickerBuilder;
  setDeveloperKey: (k: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setLocale: (l: string) => PickerBuilder;
  setCallback: (cb: (r: PickerResponse) => void) => PickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
};
type GoogleNs = { picker: { PickerBuilder: new () => PickerBuilder; ViewId: { SPREADSHEETS: unknown }; Action: { PICKED: string; CANCEL: string } } };
type Gapi = { load: (lib: string, cb: () => void) => void };

let loading: Promise<void> | null = null;
const loadScript = () =>
  (loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.async = true;
    s.onload = () => {
      const gapi = (window as unknown as { gapi?: Gapi }).gapi;
      if (!gapi) return reject(new Error('gapi missing'));
      gapi.load('picker', () => resolve());
    };
    s.onerror = () => {
      loading = null;
      reject(new Error('picker script failed'));
    };
    document.head.appendChild(s);
  }));

/** Opens the Picker on the merchant's spreadsheets; resolves with the chosen file, or null when cancelled. */
export async function openGooglePicker(o: { accessToken: string; developerKey: string | null; appId: string | null; locale: string }): Promise<PickerDoc | null> {
  await loadScript();
  const google = (window as unknown as { google?: GoogleNs }).google;
  if (!google?.picker) throw new Error('picker unavailable');
  return new Promise((resolve) => {
    let b = new google.picker.PickerBuilder().addView(google.picker.ViewId.SPREADSHEETS).setOAuthToken(o.accessToken).setLocale(o.locale);
    if (o.developerKey) b = b.setDeveloperKey(o.developerKey);
    if (o.appId) b = b.setAppId(o.appId);
    b.setCallback((r) => {
      if (r.action === google.picker.Action.PICKED && r.docs?.[0]) resolve({ id: r.docs[0].id, name: r.docs[0].name });
      else if (r.action === google.picker.Action.CANCEL) resolve(null);
    })
      .build()
      .setVisible(true);
  });
}
