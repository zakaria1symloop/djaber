// 04-ai-pipeline §4.2 `quote_delivery` — common darija / arabizi / English spellings of wilaya names → wilaya id.
// The official names (`Wilaya.nameFr | nameAr`) are matched first; this table only adds what customers really type.
export const fold = (s: string) =>
  s
    // NFD splits accents and the Arabic hamza forms into base letter + mark; the marks (and the tashkil) are dropped
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٕ]/g, '')
    .toLowerCase()
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/^(wilaya|ولايه)\s+/, '')
    // the article: a separate word in Latin script ("El Oued"), attached in Arabic ("الوادي") — never the "Al" of "Alger"
    .replace(/^(el|al)[\s-]+/, '')
    .replace(/^ال/, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim();

const RAW: Record<string, number> = {
  alger: 16, algiers: 16, dzair: 16, djazair: 16, 'alger centre': 16, 'الجزاير': 16, 'العاصمه': 16, 'دزاير': 16,
  oran: 31, wahran: 31, wahrane: 31, 'وهران': 31,
  constantine: 25, qsantina: 25, ksentina: 25, 'قسنطينه': 25,
  annaba: 23, '3annaba': 23, bone: 23, 'عنابه': 23,
  setif: 19, stif: 19, 'سطيف': 19,
  blida: 9, 'البليده': 9, 'بليده': 9,
  'tizi ouzou': 15, tizi: 15, 'تيزي وزو': 15,
  bejaia: 6, bgayet: 6, bougie: 6, 'بجايه': 6,
  tlemcen: 13, 'تلمسان': 13,
  batna: 5, 'باتنه': 5,
  chlef: 2, 'الشلف': 2,
  biskra: 7, 'بسكره': 7,
  'sidi bel abbes': 22, sba: 22, 'بلعباس': 22,
  mostaganem: 27, mosta: 27, 'مستغانم': 27,
  boumerdes: 35, 'بومرداس': 35,
  tipaza: 42, tipasa: 42, 'تيبازه': 42,
  ghardaia: 47, 'غردايه': 47,
  ouargla: 30, wargla: 30, 'ورقله': 30,
  djelfa: 17, 'الجلفه': 17,
  medea: 26, 'المديه': 26,
  msila: 28, "m'sila": 28, 'المسيله': 28,
  skikda: 21, 'سكيكده': 21,
  jijel: 18, 'جيجل': 18,
  'bordj bou arreridj': 34, bba: 34, 'برج بوعريريج': 34,
  'oum el bouaghi': 4, 'ام البواقي': 4,
  'ain defla': 44, 'عين الدفلي': 44,
  'ain temouchent': 46, 'عين تموشنت': 46,
};
/** Keyed by the folded spelling (what `fold` returns for the customer's text). */
export const WILAYA_ALIASES: Record<string, number> = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [fold(k), v]));
