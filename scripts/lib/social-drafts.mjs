const BUFFER_ENDPOINT = 'https://api.buffer.com';
const MAX_X_LENGTH = 280;

function parseScalar(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseFrontMatter(markdown) {
  if (!markdown.startsWith('---\n')) throw new Error('Field Note is missing front matter.');
  const end = markdown.indexOf('\n---', 4);
  if (end < 0) throw new Error('Field Note front matter is not closed.');
  const meta = {};
  for (const line of markdown.slice(4, end).split('\n')) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    meta[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1).trim());
  }
  return meta;
}

function trackedUrl(canonical, slug, source, content, now) {
  const url = new URL(canonical || `https://ryanbaumann.dev/writing/${slug}/`);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', 'organic_social');
  url.searchParams.set('utm_campaign', `fn_${slug.replaceAll('-', '_')}_${now.toISOString().slice(0, 7).replace('-', '')}`);
  url.searchParams.set('utm_content', content);
  return url.toString();
}

function fitXText(title, url) {
  const suffix = `\n\n${url}`;
  if (`${title}${suffix}`.length <= MAX_X_LENGTH) return `${title}${suffix}`;
  const available = MAX_X_LENGTH - suffix.length - 1;
  if (available < 1) throw new Error('The tracked Field Note URL is too long for an X draft.');
  return `${title.slice(0, available).trimEnd()}…${suffix}`;
}

// Mirrors isPublished() in portfolio/build.mjs. Staging fires once, on the commit
// that adds the file, so gate on "has not published yet" rather than on draft
// alone: --schedule writes draft: false with a future publishAt.
function isUnpublished(meta, now) {
  if (meta.draft === true) return true;
  if (!meta.publishAt) return false;
  return new Date(meta.publishAt).valueOf() > now.valueOf();
}

export function buildSocialDrafts(meta, slug, now = new Date()) {
  if (!isUnpublished(meta, now) || meta.external || meta.stageSocial === false) return [];
  const title = String(meta.shareTitle || meta.title || '').trim();
  const summary = String(meta.shareSummary || meta.summary || '').trim();
  if (!title || !summary) throw new Error('Field Note needs a title and summary before social drafts can be staged.');
  const canonical = String(meta.canonical || `https://ryanbaumann.dev/writing/${slug}/`);
  const linkedinUrl = trackedUrl(canonical, slug, 'linkedin', 'post_hook_a', now);
  const xUrl = trackedUrl(canonical, slug, 'x', 'post_hook_a', now);
  return [
    { channel: 'linkedin', text: `${title}\n\n${summary}\n\n${linkedinUrl}` },
    { channel: 'x', text: fitXText(title, xUrl) },
  ];
}

async function bufferRequest(apiKey, query, variables, fetchImpl) {
  const response = await fetchImpl(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Buffer API request failed with HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(`Buffer API error: ${payload.errors[0].message}`);
  return payload.data;
}

export async function stageBufferDraft({ apiKey, organizationId, channelId, text, fetchImpl = fetch }) {
  if (!apiKey || !organizationId || !channelId) throw new Error('Buffer draft staging is not configured.');
  if (typeof text !== 'string' || !text.trim() || text.length > 3_000) throw new Error('Social draft text must be between 1 and 3,000 characters.');

  const existing = await bufferRequest(apiKey, `query ExistingDrafts($input: PostsInput!) {
    posts(first: 100, input: $input) {
      edges { node { id text status channelId } }
    }
  }`, {
    input: { organizationId, filter: { status: ['draft', 'needs_approval'], channelIds: [channelId] } },
  }, fetchImpl);
  const duplicate = existing?.posts?.edges?.find((edge) => edge?.node?.text === text)?.node;
  if (duplicate) return { id: duplicate.id, duplicate: true };

  const created = await bufferRequest(apiKey, `mutation StageSocialDraft($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id text status channelId } }
      ... on MutationError { message }
    }
  }`, {
    input: { text, channelId, schedulingType: 'automatic', mode: 'addToQueue', saveToDraft: true, source: 'field-notes' },
  }, fetchImpl);
  if (created?.createPost?.message) throw new Error(`Buffer rejected the draft: ${created.createPost.message}`);
  if (!created?.createPost?.post?.id) throw new Error('Buffer did not return the staged draft.');
  return { id: created.createPost.post.id, duplicate: false };
}
