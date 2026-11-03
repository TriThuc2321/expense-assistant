import { describe, expect, it } from 'vitest';

import { inputState } from './input-state';

const T = '2026-11-03';

describe('inputState', () => {
  it('treats empty and whitespace as empty, not a question', () => {
    expect(inputState('', T).kind).toBe('empty');
    expect(inputState('   ', T).kind).toBe('empty');
  });
  it('detects questions', () => {
    expect(
      inputState('Tháng này mình tiêu bao nhiêu cho cà phê?', T).kind,
    ).toBe('question');
  });
  it('parses entries', () => {
    expect(inputState('ăn phở 45k', T).kind).toBe('parsed');
  });
  it('flags a zero amount as unparseable', () => {
    expect(inputState('0', T).kind).toBe('unparseable');
  });
});
