// claude.service decides at import time whether an Anthropic client exists,
// so each describe block reloads the module with a different environment.

const samplePosts = [
  { id: 'p1', content: 'First post', likes_count: 10, comments_count: 4 },
  { id: 'p2', content: 'Second post', likes_count: 2, comments_count: 0 },
];

function loadService({ apiKey, createImpl } = {}) {
  let service;
  jest.isolateModules(() => {
    if (apiKey) process.env.ANTHROPIC_API_KEY = apiKey;
    else delete process.env.ANTHROPIC_API_KEY;

    if (createImpl) {
      jest.doMock('@anthropic-ai/sdk', () =>
        jest.fn().mockImplementation(() => ({ messages: { create: createImpl } }))
      );
    }
    service = require('../src/services/claude.service');
  });
  return service;
}

describe('without an Anthropic API key (degraded mode)', () => {
  it('rankFeed falls back to engagement-based scoring', async () => {
    const { rankFeed } = loadService();
    const ranked = await rankFeed(samplePosts);

    expect(ranked).toHaveLength(2);
    expect(ranked.every(r => r.reason === 'engagement-based')).toBe(true);
    // more likes + earlier position → higher score
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('rankFeed returns an empty ranking for an empty feed', async () => {
    const { rankFeed } = loadService();
    expect(await rankFeed([])).toEqual([]);
  });

  it('moderateContent fails open with a safe verdict', async () => {
    const { moderateContent } = loadService();
    const result = await moderateContent('hello world');
    expect(result.verdict).toBe('safe');
    expect(result.reason).toMatch(/not configured/i);
  });
});

describe('with a working Anthropic client', () => {
  it('rankFeed parses a fenced JSON ranking from the model', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{
        text: '```json\n[{"postId":"p2","score":0.9,"reason":"original"},{"postId":"p1","score":0.4,"reason":"engagement bait"}]\n```',
      }],
    });
    const { rankFeed } = loadService({ apiKey: 'test-key', createImpl: create });

    const ranked = await rankFeed(samplePosts, 'tech enthusiast');
    expect(ranked).toEqual([
      { postId: 'p2', score: 0.9, reason: 'original' },
      { postId: 'p1', score: 0.4, reason: 'engagement bait' },
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].messages[0].content).toContain('tech enthusiast');
  });

  it('moderateContent parses the moderation verdict', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{
        text: '{"verdict":"blocked","score":0.97,"categories":{"hate":true,"violence":false,"spam":false,"adult":false,"harassment":false},"reason":"hate speech"}',
      }],
    });
    const { moderateContent } = loadService({ apiKey: 'test-key', createImpl: create });

    const result = await moderateContent('some nasty content');
    expect(result.verdict).toBe('blocked');
    expect(result.categories.hate).toBe(true);
  });

  it('truncates long content before sending it for moderation', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{ text: '{"verdict":"safe","score":0,"categories":{},"reason":"ok"}' }],
    });
    const { moderateContent } = loadService({ apiKey: 'test-key', createImpl: create });

    await moderateContent('x'.repeat(5000));
    const prompt = create.mock.calls[0][0].messages[0].content;
    // 1000-char content cap + prompt scaffolding
    expect(prompt.length).toBeLessThan(1500);
  });
});

describe('when the Anthropic API errors', () => {
  const failing = jest.fn().mockRejectedValue(new Error('rate limited'));

  it('rankFeed degrades to fallback scoring instead of failing the feed', async () => {
    const { rankFeed } = loadService({ apiKey: 'test-key', createImpl: failing });
    const ranked = await rankFeed(samplePosts);
    expect(ranked).toHaveLength(2);
    expect(ranked.every(r => r.reason === 'fallback')).toBe(true);
  });

  it('moderateContent fails open with a safe verdict', async () => {
    const { moderateContent } = loadService({ apiKey: 'test-key', createImpl: failing });
    const result = await moderateContent('hello');
    expect(result.verdict).toBe('safe');
    expect(result.reason).toMatch(/error/i);
  });
});
