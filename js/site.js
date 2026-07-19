// =====================================================================
// BLOG CONFIG: posts are managed in Sanity (dicescape.sanity.studio).
// These identify the Sanity project the blog reads from.
// =====================================================================
const SANITY_PROJECT_ID = '6vle4o84';
const SANITY_DATASET = 'production';

// ---------- Scroll reveal ----------
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ---------- Image fallbacks ----------
// External images may be blocked in sandboxed previews; swap in themed
// wordmarks / monograms so the layout still reads. Real assets load in a normal browser.
const D20 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 7.5 21 16.5 12 22 3 16.5 3 7.5Z M12 2 12 8.2 M3 7.5 12 8.2 21 7.5 M12 8.2 6 17.6 18 17.6 12 8.2 M3 16.5 6 17.6 M21 16.5 18 17.6 M12 22 12 17.6"/></svg>';

function logoFallback(img){
  const span = document.createElement('span');
  span.className = 'wordmark ' + (img.dataset.wm || 'wordmark--world');
  span.textContent = img.alt || 'Dicescape';
  img.replaceWith(span);
}

function cardFallback(img){
  const frame = img.closest('.card__frame');
  if (!frame || frame.querySelector('.card__placeholder')) { img.remove(); return; }
  const card = frame.closest('.card');
  const role = card.querySelector('.card__role')?.textContent || '';
  const player = card.querySelector('.card__player')?.textContent || '';
  const source = role && role !== 'Storyteller' ? role : player;
  const initials = source.replace(/["\u201C\u201D]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();
  const ph = document.createElement('div');
  ph.className = 'card__placeholder';
  ph.innerHTML = '<span class="mono">' + initials + '</span>' + D20;
  frame.appendChild(ph);
  img.remove();
}

function handleFail(img){
  if (img.closest('.card__frame')) cardFallback(img);
  else if (img.closest('.nav__logo, .hero, .footer, .world__head, .world-card')) logoFallback(img);
  else img.remove();
}

document.querySelectorAll('img').forEach(img => {
  if (img.complete && img.naturalWidth === 0) handleFail(img);
  else img.addEventListener('error', () => handleFail(img), { once: true });
});

// ---------- Blog (runs only on blog.html / post.html) ----------
// Posts come from Sanity. We keep escapeHTML, slugify, withSlugs, and
// excerpt as shared helpers, and convert Sanity's rich-text "Portable
// Text" body into safe HTML for display.

function escapeHTML(s){
  return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function slugify(title){
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'post';
}

// Assign a unique slug to every post (duplicate titles get -2, -3, ...)
function withSlugs(posts){
  const seen = {};
  return posts.map(p => {
    let slug = slugify(p.title);
    if (seen[slug]){ seen[slug]++; slug = slug + '-' + seen[slug]; }
    else seen[slug] = 1;
    return Object.assign({}, p, { slug });
  });
}

// Turn Portable Text (array of blocks) into a plain-text string for excerpts.
function blocksToText(blocks){
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter(b => b && b._type === 'block' && Array.isArray(b.children))
    .map(b => b.children.map(c => (c && c.text) || '').join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Turn Portable Text into safe HTML (paragraphs, headings, quotes, lists,
// bold, italic, and links). Everything is escaped as it is built.
function blocksToHTML(blocks){
  if (!Array.isArray(blocks)) return '';
  const out = [];
  let listType = null, listItems = [];

  const flushList = () => {
    if (listItems.length){
      out.push('<' + listType + '>' + listItems.join('') + '</' + listType + '>');
      listItems = [];
    }
    listType = null;
  };

  const renderChildren = (block) => {
    const marks = (block.markDefs || []);
    return (block.children || []).map(span => {
      let text = escapeHTML(span.text || '');
      if (!text) return '';
      const active = span.marks || [];
      if (active.includes('strong')) text = '<strong>' + text + '</strong>';
      if (active.includes('em')) text = '<em>' + text + '</em>';
      active.forEach(mk => {
        const def = marks.find(d => d._key === mk);
        if (def && def._type === 'link' && def.href){
          const safe = /^(https?:|mailto:)/i.test(def.href) ? def.href : '#';
          text = '<a href="' + escapeHTML(safe) + '" target="_blank" rel="noopener">' + text + '</a>';
        }
      });
      return text;
    }).join('');
  };

  blocks.forEach(block => {
    if (!block) return;

    // Inline image block
    if (block._type === 'image' && block.asset && block.asset._ref){
      flushList();
      const src = sanityImageUrl(block.asset._ref, 1000);
      if (src){
        const alt = escapeHTML(block.alt || '');
        const cap = block.caption ? '<figcaption class="post__cap">' + escapeHTML(block.caption) + '</figcaption>' : '';
        out.push('<figure class="post__figure"><img src="' + escapeHTML(src) + '" alt="' + alt + '" loading="lazy">' + cap + '</figure>');
      }
      return;
    }

    // YouTube embed block
    if (block._type === 'youtube' && block.url){
      flushList();
      const id = youtubeId(block.url);
      if (id){
        out.push('<div class="post__video"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
          '" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>');
      }
      return;
    }

    // Text block
    if (block._type !== 'block'){ return; }
    const inner = renderChildren(block);
    const listItem = block.listItem;

    if (listItem){
      const wantType = listItem === 'number' ? 'ol' : 'ul';
      if (listType && listType !== wantType) flushList();
      listType = wantType;
      listItems.push('<li>' + inner + '</li>');
      return;
    }
    flushList();

    const style = block.style || 'normal';
    if (style === 'h3') out.push('<h3 class="post__h">' + inner + '</h3>');
    else if (style === 'blockquote') out.push('<blockquote class="post__quote">' + inner + '</blockquote>');
    else if (inner) out.push('<p class="post__body">' + inner + '</p>');
  });
  flushList();
  return out.join('');
}

// Build a Sanity CDN image URL from an asset reference like
// "image-abc123-1200x800-jpg".
function sanityImageUrl(ref, width){
  const m = /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref);
  if (!m) return '';
  const [, id, dims, ext] = m;
  let url = 'https://cdn.sanity.io/images/' + SANITY_PROJECT_ID + '/' + SANITY_DATASET +
    '/' + id + '-' + dims + '.' + ext;
  if (width) url += '?w=' + width + '&auto=format&fit=max';
  return url;
}

// Extract the video id from any common YouTube URL form.
function youtubeId(url){
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns){
    const m = url.match(re);
    if (m) return m[1];
  }
  return '';
}

function excerpt(text, max){
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
}

function fmtDate(raw){
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function renderList(posts){
  const list = document.getElementById('blog-list');
  if (!posts.length){
    list.innerHTML = '<p class="blog__empty">No posts yet. The dice are still rolling.</p>';
    return;
  }
  list.innerHTML = posts.map(p => {
    const text = blocksToText(p.body);
    return '<article class="post">' +
      (p.date ? '<p class="post__date">' + escapeHTML(fmtDate(p.date)) + '</p>' : '') +
      '<h3 class="post__title"><a href="post.html?p=' + encodeURIComponent(p.slug) + '">' + escapeHTML(p.title) + '</a></h3>' +
      '<p class="post__body">' + escapeHTML(excerpt(text, 180)) + '</p>' +
      '<a class="post__link" href="post.html?p=' + encodeURIComponent(p.slug) + '">Read Post &rarr;</a>' +
    '</article>';
  }).join('');
}

function renderSingle(posts){
  const el = document.getElementById('post-content');
  const slug = new URLSearchParams(location.search).get('p');
  const post = posts.find(p => p.slug === slug);
  if (!post){
    el.innerHTML = '<p class="blog__empty">That post could not be found. It may have been renamed or removed.</p>';
    return;
  }
  document.title = post.title + ' | Dicescape';
  const url = post.link && post.link.url && /^https?:\/\//i.test(post.link.url) ? post.link.url : '';
  const linkHTML = url
    ? '<a class="post__link" href="' + escapeHTML(url) + '" target="_blank" rel="noopener">' +
      escapeHTML(post.link.label && post.link.label.trim() ? post.link.label.trim() : 'Read more') + ' &rarr;</a>'
    : '';
  el.innerHTML = '<article class="post">' +
    (post.date ? '<p class="post__date">' + escapeHTML(fmtDate(post.date)) + '</p>' : '') +
    '<h1 class="post__title">' + escapeHTML(post.title) + '</h1>' +
    blocksToHTML(post.body) +
    linkHTML +
  '</article>';
}

async function loadBlog(){
  const list = document.getElementById('blog-list');
  const single = document.getElementById('post-content');
  if (!list && !single) return;
  const target = list || single;
  const fail = msg => { target.innerHTML = '<p class="blog__empty">' + msg + '</p>'; };

  // GROQ query: published posts (no drafts), newest first, with the fields we need.
  const query = '*[_type == "post" && !(_id in path("drafts.**"))]|order(date desc){title, date, body[]{..., _type == "image" => {..., asset}}, link}';
  const url = 'https://' + SANITY_PROJECT_ID + '.apicdn.sanity.io/v2023-05-03/data/query/' +
    SANITY_DATASET + '?query=' + encodeURIComponent(query);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const posts = withSlugs((data.result || []).filter(p => p && p.title));
    if (list) renderList(posts);
    else renderSingle(posts);
  } catch (err){
    fail('Posts could not load right now. Try refreshing the page.');
  }
}
loadBlog();


// =====================================================================
// EPISODES: reads the Sirens of Sundown feed via the Cloudflare Worker.
// Paste your Worker URL between the quotes below.
// =====================================================================
const FEED_WORKER_URL = 'https://sirens-feed.stuartgwyn-e71.workers.dev/';
const ACAST_SHOW_ID = '69d41a69b76468caac7c4c1c';

function epDate(raw){
  const d = new Date(raw);
  if (isNaN(d)) return raw || '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function epExcerpt(text, max){
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
}

// Pull a "Content Warnings:" block out of the notes, if present.
function splitContentWarnings(desc){
  if (!desc) return { notes: '', warnings: '' };
  const re = /content warnings?:\s*/i;
  const m = desc.match(re);
  if (!m) return { notes: desc, warnings: '' };
  const idx = m.index;
  const notes = desc.slice(0, idx).trim();
  let warnings = desc.slice(idx + m[0].length).trim();
  // Cut the warnings off before the boilerplate "Listener discretion" / "New episodes" tail
  warnings = warnings.split(/listener discretion|new episodes of/i)[0].trim();
  return { notes: notes || desc, warnings };
}

function renderEpisodeList(data){
  const list = document.getElementById('episode-list');
  if (!data || !data.episodes || !data.episodes.length){
    list.innerHTML = '<p class="blog__empty">Episodes could not load right now. Try refreshing, or <a class="post__link" href="https://open.spotify.com/show/4d62q4Zbk4rUYOLdlCB3pd" target="_blank" rel="noopener">listen on Spotify</a>.</p>';
    return;
  }
  list.innerHTML = data.episodes.map(ep => {
    const num = ep.episodeNumber ? '<span class="ep-card__num">Ep ' + escapeHTML(ep.episodeNumber) + '</span>' : '';
    const { notes } = splitContentWarnings(ep.description);
    return '<a class="ep-card" href="episode.html?ep=' + encodeURIComponent(ep.id) + '">' +
      '<div class="ep-card__meta">' + num + '<span>' + escapeHTML(epDate(ep.date)) + '</span>' +
        (ep.duration ? '<span>' + escapeHTML(ep.duration) + '</span>' : '') + '</div>' +
      '<h2 class="ep-card__title">' + escapeHTML(ep.title) + '</h2>' +
      '<p class="ep-card__excerpt">' + escapeHTML(epExcerpt(notes, 170)) + '</p>' +
      '<span class="ep-card__cta">Listen &amp; Read More &rarr;</span>' +
    '</a>';
  }).join('');
}

function renderSingleEpisode(data){
  const el = document.getElementById('episode-content');
  const id = new URLSearchParams(location.search).get('ep');
  const ep = data && data.episodes && data.episodes.find(e => e.id === id);
  if (!ep){
    el.innerHTML = '<p class="blog__empty">That episode could not be found. <a class="post__link" href="episodes.html">See all episodes &rarr;</a></p>';
    return;
  }
  document.title = ep.title + ' | Sirens of Sundown';
  const { notes, warnings } = splitContentWarnings(ep.description);
  const num = ep.episodeNumber ? '<span class="ep-card__num">Ep ' + escapeHTML(ep.episodeNumber) + '</span>' : '';
  // Acast embeds a single episode by appending the episode id to the show embed URL.
  const embedId = ep.acastId ? ('/' + encodeURIComponent(ep.acastId)) : '';
  const notesHTML = escapeHTML(notes).split(/\n{2,}/).map(p => '<p>' + p + '</p>').join('');
  const cwHTML = warnings
    ? '<div class="episode__cw"><strong>Content Warnings</strong>' + escapeHTML(warnings) + '</div>'
    : '';
  el.innerHTML =
    '<div class="episode__meta">' + num + '<span>' + escapeHTML(epDate(ep.date)) + '</span>' +
      (ep.duration ? '<span>' + escapeHTML(ep.duration) + '</span>' : '') + '</div>' +
    '<h1 class="episode__title">' + escapeHTML(ep.title) + '</h1>' +
    '<div class="episode__player"><iframe src="https://embed.acast.com/' + ACAST_SHOW_ID + embedId + '" title="' + escapeHTML(ep.title) + '" loading="lazy" allow="autoplay"></iframe></div>' +
    '<div class="episode__notes">' + notesHTML + '</div>' +
    cwHTML;
}

async function loadEpisodes(){
  const list = document.getElementById('episode-list');
  const single = document.getElementById('episode-content');
  if (!list && !single) return;
  const target = list || single;
  const fail = msg => { target.innerHTML = '<p class="blog__empty">' + msg + '</p>'; };
  if (!FEED_WORKER_URL){ fail('Episode feed is not configured yet.'); return; }
  try {
    const res = await fetch(FEED_WORKER_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (list) renderEpisodeList(data);
    else renderSingleEpisode(data);
  } catch (err){
    fail('Episodes could not load right now. Try refreshing the page.');
  }
}
loadEpisodes();


// ---------- Mobile nav toggle ----------
(function(){
  const nav = document.querySelector('.nav');
  const links = document.querySelector('.nav__links');
  if (!nav || !links) return;
  const btn = document.createElement('button');
  btn.className = 'nav__toggle';
  btn.setAttribute('aria-label', 'Open menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(btn);

  const setOpen = (open) => {
    nav.classList.toggle('nav--open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  btn.addEventListener('click', () => setOpen(!nav.classList.contains('nav--open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setOpen(false); });
})();


// ---------- Shows dropdown ----------
(function(){
  const dd = document.querySelector('.nav__dd');
  if (!dd) return;
  const btn = dd.querySelector('.nav__dd-btn');
  const setOpen = (open) => {
    dd.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!dd.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
})();

// ---------- Homepage: The Latest ----------
async function loadLatest(){
  const epEl = document.getElementById('latest-episode');
  const postEl = document.getElementById('latest-post');
  if (!epEl && !postEl) return;

  if (epEl){
    try {
      const res = await fetch(FEED_WORKER_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const ep = data.episodes && data.episodes[0];
      if (!ep) throw new Error('no episodes');
      const { notes } = splitContentWarnings(ep.description);
      epEl.innerHTML =
        '<p class="latest-card__eyebrow">Latest Episode &middot; Sirens of Sundown</p>' +
        '<h3 class="latest-card__title"><a href="episode.html?ep=' + encodeURIComponent(ep.id) + '">' + escapeHTML(ep.title) + '</a></h3>' +
        '<p class="latest-card__meta">' + escapeHTML(epDate(ep.date)) + (ep.duration ? ' &middot; ' + escapeHTML(ep.duration) : '') + '</p>' +
        '<p class="latest-card__excerpt">' + escapeHTML(epExcerpt(notes, 140)) + '</p>' +
        '<a class="latest-card__cta" href="episode.html?ep=' + encodeURIComponent(ep.id) + '">Listen Now &rarr;</a>';
    } catch (err){
      epEl.innerHTML =
        '<p class="latest-card__eyebrow">Sirens of Sundown</p>' +
        '<h3 class="latest-card__title"><a href="episodes.html">Browse all episodes</a></h3>' +
        '<a class="latest-card__cta" href="episodes.html">Episode Archive &rarr;</a>';
    }
  }

  if (postEl){
    try {
      const query = '*[_type == "post" && !(_id in path("drafts.**"))]|order(date desc){title, date, body, link}';
      const url = 'https://' + SANITY_PROJECT_ID + '.apicdn.sanity.io/v2023-05-03/data/query/' + SANITY_DATASET + '?query=' + encodeURIComponent(query);
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const posts = withSlugs((data.result || []).filter(p => p && p.title));
      const post = posts[0];
      if (!post) throw new Error('no posts');
      const text = blocksToText(post.body);
      postEl.innerHTML =
        '<p class="latest-card__eyebrow">From the Blog</p>' +
        '<h3 class="latest-card__title"><a href="post.html?p=' + encodeURIComponent(post.slug) + '">' + escapeHTML(post.title) + '</a></h3>' +
        '<p class="latest-card__meta">' + escapeHTML(fmtDate(post.date)) + '</p>' +
        '<p class="latest-card__excerpt">' + escapeHTML(excerpt(text, 140)) + '</p>' +
        '<a class="latest-card__cta" href="post.html?p=' + encodeURIComponent(post.slug) + '">Read the Post &rarr;</a>';
    } catch (err){
      postEl.innerHTML =
        '<p class="latest-card__eyebrow">From the Blog</p>' +
        '<h3 class="latest-card__title"><a href="blog.html">News &amp; Updates</a></h3>' +
        '<a class="latest-card__cta" href="blog.html">Visit the Blog &rarr;</a>';
    }
  }
}
loadLatest();
