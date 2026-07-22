const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtKlccHxr1kuXlIP6YjXeVTQ5VAAA9eAtNn4RJjHzSMo7b62QaTi7i8A8mDFYMvME/exec';
const SITE_URL = 'https://etosidpalu.com';
const FALLBACK_IMAGE = 'https://lh3.googleusercontent.com/d/1vre9si_Z0EmxHxyvf2kHvADxj1KwPlao=w1600';
const LOGO_URL = 'https://drive.google.com/thumbnail?id=1RBwPV9Zy28PsN3X1A76Z9dmWz5W4LB1i&sz=w400';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength) {
  const clean = stripHtml(value);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).replace(/\s+\S*$/, '') + '…';
}

function normalizeType(value) {
  return String(value || '').toLowerCase() === 'berita' ? 'Berita' : 'Opini';
}

function routeSegment(type) {
  return normalizeType(type) === 'Berita' ? 'berita' : 'opini';
}

function normalizeImageUrl(value) {
  const url = String(value || '').trim();
  if (!url || /^data:/i.test(url)) return FALLBACK_IMAGE;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}=w1800`;
  }
  return /^https:\/\//i.test(url) ? url : FALLBACK_IMAGE;
}

function sanitizeArticleHtml(rawHtml) {
  let html = String(rawHtml || '');
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  }
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed|form|input|textarea|button|link|meta)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  return html;
}

async function fetchPublication(slug) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const endpoint = new URL(GAS_URL);
    endpoint.searchParams.set('api', 'publication-full');
    endpoint.searchParams.set('slug', slug);
    endpoint.searchParams.set('_ts', String(Date.now()));
    const response = await fetch(endpoint.toString(), {
      redirect: 'follow', signal: controller.signal, cache: 'no-store',
      headers: { accept: 'application/json,text/plain,*/*', 'cache-control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    const payload = await response.json();
    return payload && payload.status === 'success' ? payload.data : null;
  } finally { clearTimeout(timeout); }
}

function renderShell(title, body, statusTitle) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0c332d"><title>${escapeHtml(title)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f6f5f1;color:#17211d;font-family:Arial,sans-serif}.header{display:flex;align-items:center;min-height:78px;padding:0 clamp(1rem,4vw,3.5rem);background:#fff;border-top:2px solid #2b7a60;border-bottom:1px solid #dce5df}.header img{width:82px;height:42px;object-fit:contain}.brand{margin-left:.75rem;font:700 clamp(1.3rem,2.3vw,1.85rem) Georgia,serif}.status{margin-left:auto;font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#5e6b65}.center{min-height:calc(100vh - 78px);display:grid;place-items:center;padding:2rem}.card{max-width:650px;padding:clamp(1.6rem,5vw,3rem);border:1px solid #dce5df;border-radius:24px;background:#fff;text-align:center;box-shadow:0 18px 50px rgba(8,35,31,.08)}h1{font:700 clamp(2rem,6vw,3.5rem)/1.05 Georgia,serif;margin:.5rem 0 1rem}p{line-height:1.7;color:#617069}a{display:inline-flex;margin-top:1rem;padding:.85rem 1.15rem;border-radius:999px;background:#155e4b;color:#fff;text-decoration:none;font-weight:700}</style></head><body><header class="header"><img src="${LOGO_URL}" alt="Etos ID"><span class="brand">Etos ID Palu</span><span class="status">${escapeHtml(statusTitle || '')}</span></header>${body}</body></html>`;
}

function renderUnavailable(slug, temporary) {
  const title = temporary ? 'Tulisan sedang dimuat ulang' : 'Publikasi tidak ditemukan';
  const message = temporary
    ? 'Server publikasi sedang menyelesaikan permintaan. Silakan muat ulang beberapa saat lagi.'
    : `Tautan ${escapeHtml(slug)} tidak tersedia atau tulisannya belum diterbitkan.`;
  return renderShell(`${title} | Etos ID Palu`, `<main class="center"><section class="card"><h1>${title}</h1><p>${message}</p><a href="${SITE_URL}/">Kembali ke Etos ID Palu</a></section></main>`, 'Publikasi');
}

function renderPublication(data) {
  const type = normalizeType(data.jenis);
  const slug = String(data.slug || '').trim().toLowerCase();
  const canonical = `${SITE_URL}/${routeSegment(type)}/${encodeURIComponent(slug)}`;
  const title = String(data.judul || 'Publikasi Etos ID Palu').trim();
  const description = truncate(data.excerpt || data.isi || '', 190) || 'Baca publikasi Etos ID Palu.';
  const image = normalizeImageUrl(data.thumb);
  const imagePosition = String(data.thumbPosition || '50% 50%').trim();
  const author = String(data.penulis || 'Etos ID Palu').trim();
  const date = String(data.tanggal || '').trim();
  const content = sanitizeArticleHtml(data.isi || '');
  const sharePayload = JSON.stringify({title, url: canonical}).replace(/</g,'\\u003c');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0c332d">
  <title>${escapeHtml(title)} | Etos ID Palu</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Etos ID Palu">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="preload" as="image" href="${escapeHtml(image)}">
  <style>
    :root{
      --brand:#0c332d;
      --brand2:#155e4b;
      --paper:#f6f5f1;
      --ink:#17211d;
      --muted:#65716c;
      --line:#dce5df;
      --white:#fff;
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{
      margin:0;
      background:var(--paper);
      color:var(--ink);
      font-family:Arial,sans-serif;
      -webkit-font-smoothing:antialiased;
      text-rendering:optimizeLegibility;
    }
    .header{
      display:flex;
      align-items:center;
      min-height:78px;
      padding:0 clamp(1rem,4vw,3.5rem);
      background:#fff;
      border-top:2px solid #2b7a60;
      border-bottom:1px solid var(--line);
    }
    .header img{width:82px;height:42px;object-fit:contain}
    .brand{
      margin-left:.75rem;
      font:700 clamp(1.3rem,2.3vw,1.85rem) Georgia,serif;
    }
    .type{
      margin-left:auto;
      font-size:.72rem;
      font-weight:800;
      letter-spacing:.16em;
      text-transform:uppercase;
      color:#5e6b65;
    }
    .page{
      width:min(100% - 2rem,1160px);
      margin:0 auto;
      padding:clamp(2.25rem,5vw,4.75rem) 0 5.5rem;
    }
    .article-head{
      width:min(100%,940px);
      margin:0 auto;
    }
    .eyebrow{
      margin-bottom:.85rem;
      font-size:.72rem;
      font-weight:800;
      letter-spacing:.18em;
      text-transform:uppercase;
      color:var(--brand2);
    }
    h1{
      max-width:900px;
      margin:0;
      font:700 clamp(2.75rem,4.15vw,4rem)/1.02 Georgia,serif;
      letter-spacing:-.038em;
      text-wrap:balance;
      overflow-wrap:anywhere;
    }
    .dek{
      max-width:760px;
      margin:1.15rem 0 0;
      font-size:clamp(.98rem,1.35vw,1.12rem);
      line-height:1.72;
      color:var(--muted);
    }
    .meta-tools{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem 1.5rem;
      margin-top:1.15rem;
      padding-bottom:1.35rem;
      border-bottom:1px solid var(--line);
    }
    .meta{
      min-width:0;
      font-size:.84rem;
      line-height:1.5;
      color:#7b8681;
    }
    .tools{
      display:flex;
      align-items:center;
      flex-shrink:0;
      gap:.5rem;
    }
    .back,.share{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:.42rem;
      min-height:38px;
      padding:.6rem .86rem;
      border:1px solid var(--line);
      border-radius:999px;
      background:#fff;
      color:#33413b;
      text-decoration:none;
      font-size:.76rem;
      font-weight:700;
      line-height:1;
      white-space:nowrap;
      transition:transform .22s ease,border-color .22s ease,background .22s ease,color .22s ease;
    }
    .share{
      border-color:var(--brand2);
      background:var(--brand2);
      color:#fff;
      cursor:pointer;
    }
    .back:hover,.share:hover{transform:translateY(-2px)}
    .back:focus-visible,.share:focus-visible{
      outline:3px solid rgba(43,122,96,.24);
      outline-offset:3px;
    }
    .mobile-label{display:none}
    .cover{
      position:relative;
      width:min(100%,940px);
      margin:2.15rem auto 0;
      overflow:hidden;
      aspect-ratio:16/9;
      max-height:560px;
      border-radius:18px;
      background:var(--brand);
      box-shadow:0 18px 46px rgba(8,35,31,.1);
    }
    .cover img{
      display:block;
      width:100%;
      height:100%;
      object-fit:cover;
      object-position:${escapeHtml(imagePosition)};
    }
    .cover img.is-fallback{opacity:.72}
    .content{
      width:min(100%,760px);
      margin:clamp(3rem,6vw,5rem) auto 0;
      color:#27322d;
      font:400 clamp(1.06rem,1.35vw,1.16rem)/1.88 Georgia,serif;
      overflow-wrap:anywhere;
    }
    .content p{margin:0 0 1.45em}
    .content h2,.content h3,.content h4{
      margin:2.05em 0 .68em;
      color:#13231d;
      font-weight:700;
      line-height:1.22;
    }
    .content h2{font-size:clamp(1.65rem,3vw,2.3rem)}
    .content h3{font-size:clamp(1.38rem,2.4vw,1.85rem)}
    .content h4{font-size:clamp(1.2rem,2vw,1.5rem)}
    .content blockquote{
      margin:2rem 0;
      padding:1.15rem 1.35rem;
      border-left:4px solid #2b7a60;
      background:#eaf1ed;
      font-style:italic;
    }
    .content img{
      display:block;
      max-width:100%;
      height:auto;
      margin:2.15rem auto;
      border-radius:16px;
    }
    .content ul,.content ol{padding-left:1.35em}
    .content li{margin:.42em 0}
    .content a{color:var(--brand2)}
    footer{
      padding:2rem 1rem;
      background:var(--brand);
      color:rgba(255,255,255,.72);
      text-align:center;
      font-size:.84rem;
    }
    @media(max-width:720px){
      .header{min-height:72px;padding-inline:1rem}
      .header img{width:72px}
      .brand{font-size:1.35rem}
      .type{font-size:.62rem}
      .page{
        width:min(100% - 1.5rem,680px);
        padding:1.65rem 0 4rem;
      }
      .article-head{width:100%}
      .eyebrow{
        margin-bottom:.7rem;
        font-size:.68rem;
        letter-spacing:.17em;
      }
      h1{
        max-width:none;
        font-size:clamp(2.12rem,9.2vw,2.72rem);
        line-height:1.04;
        letter-spacing:-.032em;
      }
      .dek{
        margin-top:1rem;
        font-size:.97rem;
        line-height:1.65;
      }
      .meta-tools{
        align-items:flex-start;
        margin-top:1rem;
        padding-bottom:1rem;
      }
      .meta{
        padding-top:.35rem;
        font-size:.78rem;
      }
      .tools{
        gap:.38rem;
      }
      .back,.share{
        min-height:34px;
        padding:.52rem .68rem;
        font-size:.69rem;
        gap:.32rem;
      }
      .desktop-label{display:none}
      .mobile-label{display:inline}
      .cover{
        width:100%;
        margin-top:1.45rem;
        aspect-ratio:4/3;
        max-height:none;
        border-radius:16px;
        box-shadow:0 12px 32px rgba(8,35,31,.09);
      }
      .content{
        width:100%;
        margin-top:2.8rem;
        font-size:1.04rem;
        line-height:1.84;
      }
      .content p{margin-bottom:1.4em}
      .content h2{font-size:1.7rem}
      .content h3{font-size:1.42rem}
      .content blockquote{
        margin:1.7rem 0;
        padding:1rem 1.05rem;
      }
      .content img{
        margin:1.8rem auto;
        border-radius:14px;
      }
    }
    @media(max-width:410px){
      .brand{font-size:1.25rem}
      .type{display:none}
      h1{font-size:clamp(2rem,10.2vw,2.5rem)}
      .meta-tools{gap:.7rem}
      .back,.share{padding:.5rem .62rem}
    }
    @media(prefers-reduced-motion:reduce){
      html{scroll-behavior:auto}
      .back,.share{transition:none}
    }
  </style>
</head>
<body>
  <header class="header">
    <img src="${LOGO_URL}" alt="Logo Etos ID">
    <span class="brand">Etos ID Palu</span>
    <span class="type">${escapeHtml(type)}</span>
  </header>

  <main class="page">
    <section class="article-head">
      <div class="eyebrow">${escapeHtml(type)} · Etos ID Palu</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="dek">${escapeHtml(description)}</p>
      <div class="meta-tools">
        <div class="meta">${escapeHtml(author)}${date ? ` · ${escapeHtml(date)}` : ''}</div>
        <div class="tools" aria-label="Aksi tulisan">
          <a class="back" href="${SITE_URL}/" aria-label="Kembali ke Etos ID Palu">
            <span aria-hidden="true">←</span>
            <span class="desktop-label">Kembali ke Etos ID Palu</span>
            <span class="mobile-label">Kembali</span>
          </a>
          <button class="share" id="share" type="button" aria-label="Bagikan tulisan">
            <span aria-hidden="true">↗</span>
            <span class="desktop-label">Bagikan tulisan</span>
            <span class="mobile-label">Bagikan</span>
          </button>
        </div>
      </div>
    </section>

    <figure class="cover">
      <img id="cover-image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
    </figure>

    <article class="content">${content}</article>
  </main>

  <footer>© 2026 Etos ID Palu. Hak Cipta Dilindungi Undang-Undang.</footer>

  <script>
    var p=${sharePayload};
    var img=document.getElementById('cover-image');
    img.addEventListener('error',function(){
      if(img.src!==${JSON.stringify(FALLBACK_IMAGE)}){
        img.src=${JSON.stringify(FALLBACK_IMAGE)};
        img.classList.add('is-fallback');
      }
    });
    document.getElementById('share').addEventListener('click',function(){
      if(navigator.share){
        navigator.share({title:p.title,text:p.title,url:p.url}).catch(function(){});
      }else{
        window.open('https://wa.me/?text='+encodeURIComponent(p.title+'\\n'+p.url),'_blank','noopener');
      }
    });
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  const requestedType = normalizeType(req.query.jenis || 'Opini');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!/^[a-z0-9-]{3,240}$/.test(slug)) {
    res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(renderUnavailable(slug,false));return;
  }
  try {
    const publication = await fetchPublication(slug);
    if (!publication) {res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(renderUnavailable(slug,false));return;}
    const actualType=normalizeType(publication.jenis);const canonicalSlug=String(publication.slug||slug).trim().toLowerCase();const actualPath=`/${routeSegment(actualType)}/${encodeURIComponent(canonicalSlug)}`;const requestedPath=`/${routeSegment(requestedType)}/${encodeURIComponent(slug)}`;
    if(actualPath!==requestedPath){res.statusCode=308;res.setHeader('Location',actualPath);res.setHeader('Cache-Control','no-store');res.end();return;}
    publication.slug=canonicalSlug;publication.thumb=normalizeImageUrl(publication.thumb);
    res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');res.end(renderPublication(publication));
  } catch(error) {
    console.error('Publication render failed:',error);res.statusCode=503;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(renderUnavailable(slug,true));
  }
};

module.exports._test={escapeHtml,stripHtml,truncate,normalizeImageUrl,sanitizeArticleHtml,renderPublication};
