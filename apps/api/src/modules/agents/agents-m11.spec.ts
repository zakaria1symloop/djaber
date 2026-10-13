// M11 carry-overs of the agents module (pure rules): FAQ import of Word documents (M4 row), the merchant's edited review
// of a generation (AGT-03 `override`), the server texts resolved as i18n keys.
import { strToU8, zipSync } from 'fflate';
import { getMessages, type AgentGenerationResult } from '@djaber/shared';
import { agentTextKey } from './agent.presenter';
import { docxText, parseFaqText } from './knowledge.service';
import { applyOverride } from './page.service';

const docx = (paragraphs: string[]) => {
  const body = paragraphs.map((p) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>${p}</w:p>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  return Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(xml) }));
};
const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;

describe('docxText (FAQ import of .docx)', () => {
  it('one line per paragraph, runs joined, entities decoded, Arabic kept; then parsed as Q/A pairs', () => {
    const buf = docx([run('Q: Livrez-vous ') + run('à Oran ?'), run('R: Oui, en 48 h &amp; à domicile.'), run('س: هل الدفع عند الاستلام؟'), `${run('ج: نعم')}<w:r><w:br/></w:r>${run('في كل الولايات')}`]);
    const text = docxText(buf)!;
    expect(text.split('\n').slice(0, 2)).toEqual(['Q: Livrez-vous à Oran ?', 'R: Oui, en 48 h & à domicile.']);
    expect(parseFaqText(text)).toEqual([
      { question: 'Livrez-vous à Oran ?', answer: 'Oui, en 48 h & à domicile.' },
      { question: 'هل الدفع عند الاستلام؟', answer: 'نعم\nفي كل الولايات' },
    ]);
  });

  it('a file that is not a Word document gives null', () => {
    expect(docxText(Buffer.from('%PDF-1.7 not a zip'))).toBeNull();
    expect(docxText(Buffer.from(zipSync({ 'other.xml': strToU8('<x/>') })))).toBeNull();
  });
});

describe('applyOverride (POST /agents/generate/:jobId/apply { override })', () => {
  const result: AgentGenerationResult = {
    channelId: '00000000-0000-7000-8000-000000000001',
    conversations: 3,
    messages: 20,
    summary: 's',
    languages: [],
    topQuestions: [],
    tone: 'friendly',
    proposedInstructions: 'Proposition',
    proposedFaq: [{ q: 'Prix ?', a: '1000 DA' }],
    proposedPolicies: { delivery: '58 wilayas' },
    linkedAgent: null,
  };
  it('absent override or fields keep the proposal; given fields replace it (an empty FAQ list = no FAQ)', () => {
    expect(applyOverride(result, undefined)).toBe(result);
    expect(applyOverride(result, { instructions: 'Texte revu' })).toMatchObject({ proposedInstructions: 'Texte revu', proposedFaq: result.proposedFaq, proposedPolicies: result.proposedPolicies });
    expect(applyOverride(result, { faq: [], policies: { payment: 'À la livraison' } })).toMatchObject({ proposedInstructions: 'Proposition', proposedFaq: [], proposedPolicies: { payment: 'À la livraison' } });
    expect(applyOverride(result, { faq: [{ q: ' Délai ? ', a: ' 3 jours ' }] }).proposedFaq).toEqual([{ q: 'Délai ?', a: '3 jours' }]);
  });
});

describe('agents server texts (agent.api.* keys)', () => {
  it('exist in the 3 locales with the exact former French texts', () => {
    const keys = ['defaultName', 'copySuffix', 'generatedName', 'readiness.catalog', 'readiness.productsWithoutPhoto', 'readiness.feeGrid', 'readiness.policies', 'readiness.channels', 'readiness.emailVerified', 'readiness.credits', 'readiness.pendingModeration'];
    for (const l of ['fr', 'ar', 'en'] as const) for (const k of keys) expect(getMessages(l)[agentTextKey(k)]).toEqual(expect.any(String));
    expect(getMessages('fr')[agentTextKey('defaultName')]).toBe('Nouvel agent');
    expect(getMessages('fr')[agentTextKey('copySuffix')]).toBe('(copie)');
    expect(getMessages('fr')[agentTextKey('generatedName')]).toBe('Agent de {page}');
    expect(getMessages('ar')[agentTextKey('readiness.feeGrid')]).toBe('جدول رسوم التوصيل');
  });
});
