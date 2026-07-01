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
      // wrap decorators
      if (active.includes('strong')) text = '<strong>' + text + '</strong>';
      if (active.includes('em')) text = '<em>' + text + '</em>';
      // wrap link annotations
      active.forEach(m => {
        const def = marks.find(d => d._key === m);
        if (def && def._type === 'link' && def.href){
          const safe = /^(https?:|mailto:)/i.test(def.href) ? def.href : '#';
          text = '<a href="' + escapeHTML(safe) + '" target="_blank" rel="noopener">' + text + '</a>';
        }
      });
      return text;
    }).join('');
  };

  blocks.forEach(block => {
    if (!block || block._type !== 'block'){ return; }
    const inner = renderChildren(block);
    const listItem = block.listItem; // 'bullet' | 'number' | undefined

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
    else out.push('<p class="post__body">' + inner + '</p>');
  });
  flushList();
  return out.join('');
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
      '<a class="post__link" href="post.html?p=' + encodeURIComponent(p.slug) + '">Read post &rarr;</a>' +
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
  const query = '*[_type == "post" && !(_id in path("drafts.**"))]|order(date desc){title, date, body, link}';
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
      '<span class="ep-card__cta">Listen &amp; read more &rarr;</span>' +
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
