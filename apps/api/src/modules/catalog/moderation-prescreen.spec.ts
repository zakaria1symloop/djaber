// 04 §12 pre-screen scoring and auto-approval (AT-MOD-03, unit).
import { DEFAULT_SENSITIVE_KEYWORDS, ModerationPrescreenService, foldText } from './moderation-prescreen.service';

const svc = new ModerationPrescreenService();
const rules = { brands: ['Louis Vuitton'], prohibited: ['arme'], words: ['arnaque'], sensitive: DEFAULT_SENSITIVE_KEYWORDS, priceRefs: [] };
const base = { workspaceId: 'w', name: 'Sac en cuir', description: 'Fait main', price: 4000, categoryId: null, categoryName: null, imageCount: 3, imageFlags: [] };

describe('moderation pre-screen', () => {
  it('a clean product with several photos scores 1, with one photo 0.95 (auto-approvable)', () => {
    expect(svc.score(base, rules, null)).toMatchObject({ aiScore: 1, aiFlags: [], sensitive: false });
    const one = svc.score({ ...base, imageCount: 1 }, rules, null);
    expect(one.aiScore).toBe(0.95);
    expect(one.aiFlags.map((f) => f.code)).toEqual(['single_image']);
  });

  it('flags protected brands, counterfeit wording, health claims, prohibited categories and blocked words (accent / case insensitive)', () => {
    const r = svc.score({ ...base, name: 'Sac LOUIS VUITTON copie qualité AAA', description: 'guérit le stress' }, rules, null);
    expect(r.aiFlags.map((f) => f.code).sort()).toEqual(['counterfeit_wording', 'health_claim', 'protected_brand']);
    expect(r.aiFlags.find((f) => f.code === 'protected_brand')?.field).toBe('name');
    expect(r.aiScore).toBe(0);
    expect(svc.score({ ...base, categoryName: 'Armes blanches' }, rules, null).aiFlags[0]).toMatchObject({ code: 'prohibited_category', field: 'categoryId' });
    expect(svc.score({ ...base, description: 'pas une ARNAQUE' }, rules, null).aiFlags[0]).toMatchObject({ code: 'blocked_word', field: 'description' });
  });

  it('misleading price vs the market reference (−87 %), logo in image, missing warranty for electronics', () => {
    const cheap = svc.score({ ...base, price: 500 }, rules, 4000);
    expect(cheap).toMatchObject({ marketReference: 4000 });
    expect(cheap.aiFlags[0]).toMatchObject({ code: 'misleading_price', field: 'price', message: '-87 %' });
    expect(svc.score({ ...base, imageFlags: ['logo'] }, rules, null).aiFlags[0]?.code).toBe('logo_in_image');
    const phone = svc.score({ ...base, categoryName: 'Téléphones & électronique', description: 'neuf' }, rules, null);
    expect(phone.sensitive).toBe(true);
    expect(phone.aiFlags.map((f) => f.code)).toContain('missing_warranty');
  });

  it('AT-MOD-03 auto-approval needs score ≥ 0.9, trust standard / trusted and a non-sensitive category', () => {
    expect(ModerationPrescreenService.autoApprove({ aiScore: 0.95, sensitive: false }, 'standard')).toBe(true);
    expect(ModerationPrescreenService.autoApprove({ aiScore: 0.95, sensitive: false }, 'trusted')).toBe(true);
    expect(ModerationPrescreenService.autoApprove({ aiScore: 0.95, sensitive: false }, 'new')).toBe(false);
    expect(ModerationPrescreenService.autoApprove({ aiScore: 0.99, sensitive: false }, 'watch')).toBe(false);
    expect(ModerationPrescreenService.autoApprove({ aiScore: 0.99, sensitive: true }, 'trusted')).toBe(false);
    expect(ModerationPrescreenService.autoApprove({ aiScore: 0.89, sensitive: false }, 'trusted')).toBe(false);
  });

  it('folds Arabic diacritics and tatweel', () => {
    expect(foldText('تَقْلِيـــد')).toBe('تقليد');
    expect(svc.isSensitive('مستحضرات التجميل', rules)).toBe(true);
  });
});
