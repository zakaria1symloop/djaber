// Tool schemas must be accepted by every provider: Anthropic refuses a top-level oneOf / allOf / anyOf in input_schema.
import { TOOL_DEFS } from './tool-registry';

describe('TOOL_DEFS', () => {
  it.each(Object.values(TOOL_DEFS).map((d) => [d.name, d] as const))('%s: an object schema without top-level oneOf / allOf / anyOf', (_name, def) => {
    const schema = def.parameters as Record<string, unknown>;
    expect(schema.type).toBe('object');
    for (const k of ['oneOf', 'allOf', 'anyOf']) expect(schema).not.toHaveProperty(k);
  });
});
