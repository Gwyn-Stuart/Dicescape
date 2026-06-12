// =====================================================================
// BLOG CONFIG: paste the published Google Sheet CSV link between the
// quotes below. See the comment at the top of blog.html for setup steps.
// =====================================================================
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOcI6_wGjjyyAF2ms9sAegQIxzr1AzMYgtb5PFdxewE-eGD0Vk0KsXeAxIiXuBTJav36wPzEQ72eMc/pub?gid=0&single=true&output=csv';

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

// ---------- Blog (runs only on pages with a #blog-list element) ----------
// Minimal CSV parser that handles quoted fields, commas, and line
// breaks inside post bodies.
function parseCSV(text){
  const rows = []; let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQuotes){
      if (c === '"'){
        if (text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ','){ row.push(field); field = ''; }
      else if (c === '\n' || c === '\r'){
        if (c === '\r' && text[i+1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  row.push(field);
  if (row.some(f => f.trim() !== '')) rows.push(row);
  return rows;
}

function escapeHTML(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function slugify(title){
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'post';
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

function excerpt(body, max){
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
}

function renderList(posts){
  const list = document.getElementById('blog-list');
  if (!posts.length){
    list.innerHTML = '<p class="blog__empty">No posts yet. The dice are still rolling.</p>';
    return;
  }
  list.innerHTML = posts.map(p => {
    return '<article class="post">' +
      (p.date ? '<p class="post__date">' + escapeHTML(p.date) + '</p>' : '') +
      '<h3 class="post__title"><a href="post.html?p=' + encodeURIComponent(p.slug) + '">' + escapeHTML(p.title) + '</a></h3>' +
      '<p class="post__body">' + escapeHTML(excerpt(p.body, 180)) + '</p>' +
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
  const safeLink = post.link && /^https?:\/\//i.test(post.link.trim()) ? post.link.trim() : '';
  const link = safeLink
    ? '<a class="post__link" href="' + escapeHTML(safeLink) + '" target="_blank" rel="noopener">' +
      escapeHTML(post.linkText && post.linkText.trim() ? post.linkText.trim() : 'Read more') + ' &rarr;</a>'
    : '';
  const body = escapeHTML(post.body).replace(/\n+/g, '</p><p class="post__body">');
  el.innerHTML = '<article class="post">' +
    (post.date ? '<p class="post__date">' + escapeHTML(post.date) + '</p>' : '') +
    '<h1 class="post__title">' + escapeHTML(post.title) + '</h1>' +
    '<p class="post__body">' + body + '</p>' +
    link +
  '</article>';
}

async function loadBlog(){
  const list = document.getElementById('blog-list');
  const single = document.getElementById('post-content');
  if (!list && !single) return;
  const target = list || single;
  const fail = msg => { target.innerHTML = '<p class="blog__empty">' + msg + '</p>'; };
  if (!SHEET_CSV_URL){ fail('No posts yet. The dice are still rolling.'); return; }
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());
    const headers = rows.length ? rows[0].map(h => h.trim().toLowerCase()) : [];
    const col = name => headers.indexOf(name);
    const posts = withSlugs(rows.slice(1).map(r => ({
      date: (r[col('date')] || '').trim(),
      title: (r[col('title')] || '').trim(),
      body: (r[col('body')] || '').trim(),
      link: r[col('link')] || '',
      linkText: r[col('linktext')] || '',
    })).filter(p => p.title));
    if (list) renderList(posts);
    else renderSingle(posts);
  } catch (err){
    fail('Posts could not load right now. Try refreshing the page.');
  }
}
loadBlog();
