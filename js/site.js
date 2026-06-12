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

function renderPosts(posts){
  const list = document.getElementById('blog-list');
  if (!posts.length){
    list.innerHTML = '<p class="blog__empty">No posts yet. The dice are still rolling.</p>';
    return;
  }
  list.innerHTML = posts.map(p => {
    const safeLink = p.link && /^https?:\/\//i.test(p.link.trim()) ? p.link.trim() : '';
    const link = safeLink
      ? '<a class="post__link" href="' + escapeHTML(safeLink) + '" target="_blank" rel="noopener">' +
        escapeHTML(p.linkText && p.linkText.trim() ? p.linkText.trim() : 'Read more') + ' &rarr;</a>'
      : '';
    const body = escapeHTML(p.body).replace(/\n+/g, '</p><p class="post__body">');
    return '<article class="post">' +
      (p.date ? '<p class="post__date">' + escapeHTML(p.date) + '</p>' : '') +
      '<h3 class="post__title">' + escapeHTML(p.title) + '</h3>' +
      '<p class="post__body">' + body + '</p>' +
      link +
    '</article>';
  }).join('');
}

async function loadBlog(){
  const list = document.getElementById('blog-list');
  if (!list) return;
  if (!SHEET_CSV_URL){
    list.innerHTML = '<p class="blog__empty">No posts yet. The dice are still rolling.</p>';
    return;
  }
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());
    if (rows.length < 2){ renderPosts([]); return; }
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const col = name => headers.indexOf(name);
    const posts = rows.slice(1).map(r => ({
      date: (r[col('date')] || '').trim(),
      title: (r[col('title')] || '').trim(),
      body: (r[col('body')] || '').trim(),
      link: r[col('link')] || '',
      linkText: r[col('linktext')] || '',
    })).filter(p => p.title);
    renderPosts(posts);
  } catch (err){
    list.innerHTML = '<p class="blog__empty">Posts could not load right now. Try refreshing the page.</p>';
  }
}
loadBlog();
