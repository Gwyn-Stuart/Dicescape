// Sirens of Sundown — Acast RSS → JSON proxy
// Paste this into your Cloudflare Worker (sirens-feed) and Deploy.
// It fetches the Acast feed, parses each episode, and returns clean JSON
// that your static site can read directly (with CORS allowed).
//
// This file is a backup copy of the Worker source. The authoritative version
// lives in the Cloudflare dashboard under the "sirens-feed" Worker at:
// https://sirens-feed.stuartgwyn-e71.workers.dev/

const FEED_URL = 'https://feeds.acast.com/public/shows/69d41a69b76468caac7c4c1c';

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    try {
      const res = await fetch(FEED_URL, {
        headers: { 'User-Agent': 'DicescapeFeedWorker/1.0' },
        cf: { cacheTtl: 600, cacheEverything: true }, // cache 10 min at edge
      });
      if (!res.ok) throw new Error('Feed responded ' + res.status);
      const xml = await res.text();

      const channel = {
        title: tag(xml, 'title'),
        description: clean(tag(xml, 'description')),
        image: attr(xml, 'itunes:image', 'href') || tag(xml, 'url'),
      };

      const episodes = items(xml).map((item, i) => {
        const title = tag(item, 'title');
        return {
          id: slugify(title) || ('episode-' + i),
          title,
          date: tag(item, 'pubDate'),
          description: clean(tag(item, 'description') || tag(item, 'itunes:summary')),
          duration: tag(item, 'itunes:duration'),
          audio: attr(item, 'enclosure', 'url'),
          episodeNumber: tag(item, 'itunes:episode'),
          acastId: tag(item, 'acast:episodeId') || tag(item, 'guid'),
          image: attr(item, 'itunes:image', 'href') || channel.image,
        };
      });

      // De-duplicate slugs (episodes with identical titles)
      const seen = {};
      for (const ep of episodes) {
        if (seen[ep.id]) { seen[ep.id]++; ep.id = ep.id + '-' + seen[ep.id]; }
        else seen[ep.id] = 1;
      }

      return json({ channel, episodes });
    } catch (err) {
      return json({ error: String(err && err.message || err) }, 502);
    }
  },
};

// ---------- helpers ----------
function items(xml) {
  const out = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function tag(xml, name) {
  const re = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i');
  const m = xml.match(re);
  return m ? decode(m[1].trim()) : '';
}

function attr(xml, tagName, attrName) {
  const re = new RegExp('<' + tagName + '\\b[^>]*\\b' + attrName + '="([^"]*)"', 'i');
  const m = xml.match(re);
  return m ? decode(m[1]) : '';
}

// Strip CDATA wrappers and HTML tags, collapse whitespace.
function clean(s) {
  if (!s) return '';
  return decode(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>(?=\S)/gi, ' ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...cors(),
    },
  });
}
