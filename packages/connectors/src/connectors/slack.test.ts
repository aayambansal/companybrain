import { describe, it, expect } from 'vitest';
import { slackMessageDoc } from './slack.js';

describe('slackMessageDoc', () => {
  it('maps a normal message to a document', () => {
    const doc = slackMessageDoc({ type: 'message', user: 'U1', text: 'Deploy is green', ts: '1700000000.000100' }, 'C1');
    expect(doc).not.toBeNull();
    expect(doc!.sourceId).toBe('C1:1700000000.000100');
    expect(doc!.content).toBe('Deploy is green');
    expect(doc!.metadata?.user).toBe('U1');
  });

  it('skips empty messages and channel-join noise', () => {
    expect(slackMessageDoc({ type: 'message', text: '   ' }, 'C1')).toBeNull();
    expect(slackMessageDoc({ type: 'message', subtype: 'channel_join', text: 'joined' }, 'C1')).toBeNull();
  });

  it('keeps thread broadcasts', () => {
    const doc = slackMessageDoc({ type: 'message', subtype: 'thread_broadcast', text: 'shipped', ts: '1.1' }, 'C1');
    expect(doc).not.toBeNull();
  });
});
