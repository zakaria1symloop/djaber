import { describe, expect, it } from 'vitest';
import { AI_TYPING_TTL_MS, applyTyping, clearTyping, MEMBER_TYPING_TTL_MS, nextExpiry, typingOf, type TypingState } from './typing-logic';

describe('typing indicators (WS conversation.typing, M11)', () => {
  const now = 1_000_000;
  it('a member typing shows for a few seconds; my own signal and malformed payloads are ignored', () => {
    let s: TypingState = {};
    s = applyTyping(s, { conversationId: 'c1', userId: 'u2', at: 'x' }, now, 'me');
    expect(typingOf(s, 'c1', now)).toEqual({ ai: false, userIds: ['u2'] });
    expect(typingOf(s, 'c1', now + MEMBER_TYPING_TTL_MS)).toEqual({ ai: false, userIds: [] });
    expect(applyTyping(s, { conversationId: 'c1', userId: 'me' }, now, 'me')).toBe(s);
    expect(applyTyping(s, { userId: 'u3' }, now, 'me')).toBe(s);
    expect(applyTyping(s, null, now, 'me')).toBe(s);
    expect(typingOf(s, 'other', now)).toEqual({ ai: false, userIds: [] });
  });
  it('the AI is "replying" from active:true until active:false (or the safety TTL)', () => {
    let s = applyTyping({}, { conversationId: 'c1', ai: true, active: true }, now, null);
    expect(typingOf(s, 'c1', now + 1000).ai).toBe(true);
    expect(typingOf(s, 'c1', now + AI_TYPING_TTL_MS).ai).toBe(false);
    s = applyTyping(s, { conversationId: 'c1', ai: true, active: false }, now + 2000, null);
    expect(typingOf(s, 'c1', now + 2000).ai).toBe(false);
  });
  it('the reply itself clears the indicator; members are listed oldest signal first', () => {
    let s = applyTyping({}, { conversationId: 'c1', ai: true, active: true }, now, null);
    s = applyTyping(s, { conversationId: 'c1', userId: 'u2' }, now, null);
    s = applyTyping(s, { conversationId: 'c1', userId: 'u3' }, now + 10, null);
    expect(typingOf(s, 'c1', now + 20).userIds).toEqual(['u2', 'u3']);
    s = clearTyping(s, 'c1', { ai: true });
    s = clearTyping(s, 'c1', { userId: 'u2' });
    expect(typingOf(s, 'c1', now + 20)).toEqual({ ai: false, userIds: ['u3'] });
    expect(clearTyping(s, 'unknown', { ai: true })).toBe(s);
  });
  it('nextExpiry gives the earliest future end (re-render timer)', () => {
    let s = applyTyping({}, { conversationId: 'c1', ai: true, active: true }, now, null);
    s = applyTyping(s, { conversationId: 'c2', userId: 'u2' }, now, null);
    expect(nextExpiry(s, now)).toBe(now + MEMBER_TYPING_TTL_MS);
    expect(nextExpiry(s, now + AI_TYPING_TTL_MS)).toBeNull();
  });
});
