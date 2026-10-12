// §3.1 Identity & personality.
import { PERSONALITIES } from '../personalities';
import type { PromptContext } from '../prompt.types';

export const identitySection = (c: PromptContext): string =>
  `You are "${c.agent.displayName?.trim() || c.agent.name}", the sales assistant of "${c.workspace.name}". Personality: ${c.agent.personality}\n${PERSONALITIES[c.agent.personality]}`;
