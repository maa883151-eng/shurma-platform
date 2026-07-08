const Anthropic = require('@anthropic-ai/sdk');

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseFencedJSON(text) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

async function rankFeed(posts, userContext = '') {
  if (!client || posts.length === 0) {
    return posts.map((p, i) => ({
      postId: p.id,
      score: p.likes_count * 0.1 + p.comments_count * 0.05 + (posts.length - i) * 0.01,
      reason: 'engagement-based',
    }));
  }

  const prompt = `You are a feed ranking engine for Shurma, an anti-algorithmic social platform.
Rank these posts by genuine quality and relevance — no engagement bait, no filter bubbles.
Prioritize original, thoughtful content. User context: ${userContext || 'general feed'}

Posts (JSON array):
${JSON.stringify(posts.slice(0, 30).map(p => ({ id: p.id, content: p.content?.slice(0, 200), likes: p.likes_count, comments: p.comments_count })))}

Return ONLY a JSON array: [{"postId":"<uuid>","score":<0-1>,"reason":"<short>"}]`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return parseFencedJSON(response.content[0].text);
  } catch {
    return posts.map((p, i) => ({
      postId: p.id,
      score: p.likes_count * 0.1 + (posts.length - i) * 0.01,
      reason: 'fallback',
    }));
  }
}

async function moderateContent(content, contentType = 'text') {
  if (!client) {
    return { verdict: 'safe', score: 0, categories: {}, reason: 'AI moderation not configured' };
  }

  const prompt = `You are a content moderator for Shurma social platform.
Analyze this ${contentType} content and respond with ONLY JSON:
{"verdict":"safe|flagged|blocked","score":<0-1>,"categories":{"hate":false,"violence":false,"spam":false,"adult":false,"harassment":false},"reason":"<brief explanation>"}

Content: ${content.slice(0, 1000)}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });
    return parseFencedJSON(response.content[0].text);
  } catch {
    return { verdict: 'safe', score: 0, categories: {}, reason: 'moderation error — defaulting safe' };
  }
}

module.exports = { rankFeed, moderateContent };
