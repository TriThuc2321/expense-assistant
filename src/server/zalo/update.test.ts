import { describe, expect, it } from 'vitest';

import {
  classify,
  parseZaloUpdate,
  stripMention,
  type ZaloUpdate,
} from './update';

const CAPTURE = {
  ok: true,
  result: {
    message: {
      chat: { id: '456155d51d9af4c4a111', chat_type: 'PRIVATE' },
      text: 'hi',
      message_id: '1d9ee2dss5549a7dc332',
      date: 1793699855630,
      message_type: 'CHAT_TEXT',
      from: {
        id: '146155d51d9aa4c4dddd',
        is_bot: false,
        display_name: 'Trần Trí Thức',
      },
    },
    event_name: 'message.text.received',
  },
  error_code: 0,
};

const EXPECTED: ZaloUpdate = {
  messageId: '1d9ee2dss5549a7dc332',
  chatId: '456155d51d9af4c4a111',
  chatType: 'PRIVATE',
  fromId: '146155d51d9aa4c4dddd',
  fromName: 'Trần Trí Thức',
  event: 'text',
  text: 'hi',
  photoUrl: null,
};

function textUpdate(text: string): ZaloUpdate {
  return { ...EXPECTED, text };
}

describe('parseZaloUpdate', () => {
  it('parses wrapped and bare bodies', () => {
    expect(parseZaloUpdate(CAPTURE)).toEqual(EXPECTED);
    expect(parseZaloUpdate(CAPTURE.result)).toEqual(EXPECTED);
  });

  it('parses an image with caption', () => {
    const body = {
      event_name: 'message.image.received',
      message: {
        ...CAPTURE.result.message,
        text: undefined,
        caption: 'cơm trưa',
        photo_url: 'https://img/x.jpg',
      },
    };
    expect(parseZaloUpdate(body)).toEqual({
      ...EXPECTED,
      event: 'image',
      text: 'cơm trưa',
      photoUrl: 'https://img/x.jpg',
    });
  });

  it('falls back to the Zalo user id when the display name is missing or blank', () => {
    const { message } = CAPTURE.result;
    const anonymous = { ...message.from, display_name: undefined };
    for (const from of [anonymous, { ...message.from, display_name: '  ' }]) {
      expect(
        parseZaloUpdate({ ...CAPTURE.result, message: { ...message, from } })
          ?.fromName,
      ).toBe('146155d51d9aa4c4dddd');
    }
  });

  it('marks other events and drops bot senders and malformed bodies', () => {
    const { message } = CAPTURE.result;
    expect(
      parseZaloUpdate({ event_name: 'message.sticker.received', message })
        ?.event,
    ).toBe('other');
    expect(
      parseZaloUpdate({
        event_name: 'message.text.received',
        message: { ...message, from: { ...message.from, is_bot: true } },
      }),
    ).toBeNull();
    expect(
      parseZaloUpdate({
        event_name: 'message.text.received',
        message: { ...message, chat: { id: '1', chat_type: 'CHANNEL' } },
      }),
    ).toBeNull();
    expect(parseZaloUpdate({ message: { text: 'x' } })).toBeNull();
    expect(parseZaloUpdate(null)).toBeNull();
    expect(parseZaloUpdate('nope')).toBeNull();
  });
});

describe('stripMention', () => {
  it('strips the mention anywhere, case-insensitively', () => {
    expect(stripMention('ăn phở @sổ chi 45k')).toBe('ăn phở 45k');
    expect(stripMention('@Sổ Chi')).toBe('');
    expect(stripMention('@Sổ Chi /undo')).toBe('/undo');
  });

  it('matches decomposed unicode and escapes regex chars', () => {
    expect(stripMention('@Sổ Chi cafe 30k'.normalize('NFD'))).toBe('cafe 30k');
    expect(stripMention('a @b.c d @bxc', 'b.c')).toBe('a d @bxc');
  });
});

describe('classify', () => {
  it('classifies link, undo, text, image and sticker', () => {
    expect(classify(textUpdate('/link'))).toEqual({ kind: 'link', code: '' });
    expect(classify(textUpdate('@Sổ Chi /LINK abc123'))).toEqual({
      kind: 'link',
      code: 'abc123',
    });
    expect(classify(textUpdate('/undo'))).toEqual({ kind: 'undo' });
    expect(classify(textUpdate('ăn phở 45k'))).toEqual({
      kind: 'text',
      text: 'ăn phở 45k',
    });
    expect(classify(textUpdate('@Sổ Chi'))).toEqual({ kind: 'text', text: '' });
    expect(
      classify({ ...EXPECTED, event: 'image', photoUrl: 'https://img/x.jpg' }),
    ).toEqual({ kind: 'image', url: 'https://img/x.jpg' });
    expect(classify({ ...EXPECTED, event: 'image', photoUrl: null })).toEqual({
      kind: 'ignore',
    });
    expect(classify({ ...EXPECTED, event: 'other', text: null })).toEqual({
      kind: 'ignore',
    });
  });
});
