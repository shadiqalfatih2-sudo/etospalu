const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtKlccHxr1kuXlIP6YjXeVTQ5VAAA9eAtNn4RJjHzSMo7b62QaTi7i8A8mDFYMvME/exec';
const SITE_URL = 'https://etosidpalu.com';
const FALLBACK_IMAGE = 'https://lh3.googleusercontent.com/d/1vre9si_Z0EmxHxyvf2kHvADxj1KwPlao=w1600';
const LOGO_URL = 'https://drive.google.com/thumbnail?id=1RBwPV9Zy28PsN3X1A76Z9dmWz5W4LB1i&sz=w400';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, maxLength) {
  const clean = stripHtml(value);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).replace(/\s+\S*$/, '') + '…';
}

function normalizeType(value) {
  return String(value || '').toLowerCase() === 'berita' ? 'Berita' : 'Opini';
}

function toIsoDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return '';
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  const hour = (match[4] || '00').padStart(2, '0');
  const minute = (match[5] || '00').padStart(2, '0');
  const second = (match[6] || '00').padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
}


function routeSegment(type) {
  return normalizeType(type) === 'Berita' ? 'berita' : 'opini';
}

function normalizeImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return FALLBACK_IMAGE;

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=w1600`;
    }
  }

  return /^https:\/\//i.test(url) ? url : FALLBACK_IMAGE;
}

async function fetchPublication(slug) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const endpoint = new URL(GAS_URL);
    endpoint.searchParams.set('api', 'publication');
    endpoint.searchParams.set('slug', slug);
    endpoint.searchParams.set('_ts', String(Date.now()));

    const response = await fetch(endpoint.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'Etos-ID-Palu-Metadata/2.0',
        'cache-control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Metadata upstream returned ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || payload.status !== 'success' || !payload.data) return null;
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

function renderNotFound(slug) {
  const safeSlug = escapeHtml(slug);
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#0e2f2d">
  <title>Publikasi tidak ditemukan | Etos ID Palu</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#f4f7f6;color:#17211d}
    main{min-height:100vh;display:grid;place-items:center;padding:2rem}.card{max-width:620px;padding:2.5rem;border:1px solid #dfe8e3;border-radius:24px;background:#fff;text-align:center;box-shadow:0 20px 50px rgba(8,35,31,.08)}
    h1{font-family:Georgia,serif;font-size:clamp(2rem,6vw,3.4rem);margin:.5rem 0 1rem}p{line-height:1.7;color:#62706a}a{display:inline-flex;margin-top:1rem;padding:.9rem 1.25rem;border-radius:999px;background:#155e4b;color:#fff;text-decoration:none;font-weight:700}
  </style>
</head>
<body><main><div class="card"><img src="${LOGO_URL}" alt="Etos ID Palu" width="120"><h1>Publikasi tidak ditemukan</h1><p>Tautan <strong>${safeSlug}</strong> tidak tersedia atau tulisannya belum diterbitkan.</p><a href="${SITE_URL}/">Kembali ke Etos ID Palu</a></div></main></body>
</html>`;
}

function renderPublicationPage(data) {
  const type = normalizeType(data.jenis);
  const segment = routeSegment(type);
  const slug = String(data.slug || '').trim();
  const canonical = `${SITE_URL}/${segment}/${encodeURIComponent(slug)}`;
  const title = String(data.judul || 'Publikasi Etos ID Palu').trim();
  const fullTitle = `${title} | Etos ID Palu`;
  const description = truncate(data.excerpt || data.isi || '', 190) || 'Baca publikasi terbaru dari Etos ID Palu.';
  const image = normalizeImageUrl(data.thumb);
  const author = String(data.penulis || 'Etos ID Palu').trim();
  const date = String(data.tanggal || '').trim();
  const isoDate = toIsoDate(date);
  const iframeUrl = `${GAS_URL}?slug=${encodeURIComponent(slug)}&jenis=${encodeURIComponent(type)}&embedded=1`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': type === 'Berita' ? 'NewsArticle' : 'Article',
    headline: title,
    description,
    image: [image],
    author: { '@type': 'Person', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'Etos ID Palu',
      logo: { '@type': 'ImageObject', url: LOGO_URL }
    },
    mainEntityOfPage: canonical,
    url: canonical,
    ...(isoDate ? { datePublished: isoDate, dateModified: isoDate } : {})
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0e2f2d">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <title>${escapeHtml(fullTitle)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">

  <meta property="og:locale" content="id_ID">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Etos ID Palu">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Thumbnail ${escapeHtml(title)}">
  <meta property="article:author" content="${escapeHtml(author)}">
  <meta property="article:section" content="${escapeHtml(type)}">
  ${isoDate ? `<meta property="article:published_time" content="${escapeHtml(isoDate)}">` : ''}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <link rel="icon" href="https://drive.google.com/thumbnail?id=1RBwPV9Zy28PsN3X1A76Z9dmWz5W4LB1i&sz=w128">
  <link rel="preconnect" href="https://script.google.com">
  <link rel="preconnect" href="https://script.googleusercontent.com">
  <link rel="preconnect" href="https://lh3.googleusercontent.com">
  <link rel="preload" as="image" href="${escapeHtml(image)}">
  <script type="application/ld+json">${structuredData}</script>

  <style>
    :root{--brand:#0e2f2d;--accent:#26735b;--paper:#f4f7f6;--ink:#17211d}
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--paper);font-family:Arial,Helvetica,sans-serif}
    #etos-app{position:fixed;inset:0;z-index:1;width:100%;height:100vh;height:100dvh;border:0;background:var(--paper);opacity:0;pointer-events:none;transition:opacity .42s cubic-bezier(.22,1,.36,1)}
    body.ready #etos-app{opacity:1;pointer-events:auto}
    .preview{position:fixed;inset:0;z-index:2;display:grid;grid-template-rows:76px minmax(0,1fr);background:var(--paper);transition:opacity .38s ease,visibility 0s linear 0s}
    body.ready .preview{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .38s ease,visibility 0s linear .38s}
    .nav{display:flex;align-items:center;gap:1rem;padding:0 clamp(1.2rem,4vw,3rem);border-top:2px solid var(--accent);border-bottom:1px solid #dce5e0;background:#fff}
    .nav img{width:78px;max-height:42px;object-fit:contain}.brand{font-family:Georgia,serif;font-size:1.65rem;font-weight:700}.tag{margin-left:auto;color:#65726c;font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em}
    .cover{position:relative;overflow:hidden;color:#fff;background:var(--brand)}.cover>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(.88) contrast(1.02);transform:scale(1.012)}
    .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,24,20,.94),rgba(3,24,20,.58) 52%,rgba(3,24,20,.18)),linear-gradient(0deg,rgba(3,24,20,.78),transparent 55%)}
    .copy{position:relative;z-index:2;width:min(94%,900px);height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(2.2rem,8vw,6rem) clamp(1.25rem,5vw,4rem)}
    .category{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.19em;color:#d9ebe2}.copy h1{max-width:850px;margin:.9rem 0 1rem;font-family:Georgia,serif;font-size:clamp(2.6rem,7vw,6rem);line-height:.98;letter-spacing:-.04em}.copy p{max-width:700px;margin:0;color:rgba(255,255,255,.78);font-size:clamp(.95rem,2vw,1.15rem);line-height:1.65}.meta{margin-top:1.15rem;color:rgba(255,255,255,.64);font-size:.8rem}.bar{margin-top:1.6rem;width:min(310px,70vw);height:3px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.22)}.bar::after{content:'';display:block;width:38%;height:100%;background:#dcebe4;animation:load 1.35s ease-in-out infinite}
    @keyframes load{0%{transform:translateX(-115%)}65%,100%{transform:translateX(280%)}}
    @media(max-width:720px){.preview{grid-template-rows:70px minmax(0,1fr)}.nav{padding:0 1.1rem}.nav img{width:90px}.brand{display:none}.tag{font-size:.64rem}.cover{display:grid;grid-template-rows:minmax(270px,48dvh) minmax(0,1fr)}.cover>img{position:relative;inset:auto;height:100%;object-fit:cover;object-position:center}.cover::after{background:linear-gradient(0deg,var(--brand) 0%,rgba(14,47,45,.88) 34%,rgba(14,47,45,0) 62%)}.copy{height:auto;justify-content:flex-start;padding:1.2rem 1.25rem 2rem;margin-top:-72px}.copy h1{font-size:clamp(2.25rem,10vw,3.5rem);line-height:1}.copy p{font-size:.88rem;line-height:1.55}.meta{font-size:.72rem}}
    @media(prefers-reduced-motion:reduce){#etos-app,.preview,.bar::after{animation:none;transition-duration:1ms}}
  </style>
</head>
<body>
  <div class="preview" aria-hidden="true">
    <div class="nav"><img src="${LOGO_URL}" alt=""><span class="brand">Etos ID Palu</span><span class="tag">${escapeHtml(type)}</span></div>
    <section class="cover"><img src="${escapeHtml(image)}" alt=""><div class="copy"><span class="category">${escapeHtml(type)} · Etos ID Palu</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><div class="meta">${escapeHtml(author)}${date ? ` · ${escapeHtml(date)}` : ''}</div><div class="bar"></div></div></section>
  </div>

  <iframe id="etos-app" src="${escapeHtml(iframeUrl)}" title="${escapeHtml(title)}" scrolling="yes" loading="eager" allow="camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen" allowfullscreen></iframe>

  <script>
    (function(){
      var GAS_URL=${JSON.stringify(GAS_URL)};
      var iframe=document.getElementById('etos-app');
      var ready=false;
      function parseRoute(path){var m=String(path||'').match(/^\\/(berita|opini)\\/([a-z0-9-]+)\\/?$/i);return m?{jenis:m[1].toLowerCase()==='berita'?'Berita':'Opini',slug:m[2]}:null}
      function iframeUrl(){var r=parseRoute(location.pathname);return r?GAS_URL+'?slug='+encodeURIComponent(r.slug)+'&jenis='+encodeURIComponent(r.jenis)+'&embedded=1':GAS_URL}
      function reveal(){if(ready)return;ready=true;document.body.classList.add('ready')}
      iframe.addEventListener('load',function(){requestAnimationFrame(function(){requestAnimationFrame(reveal)})},{once:true});
      addEventListener('message',function(event){if(event.source!==iframe.contentWindow)return;var d=event.data||{};if(d.source!=='etos-id-palu'||d.action!=='route')return;var path=String(d.path||'/');if(!/^\\/$|^\\/(berita|opini)\\/[a-z0-9-]+\\/?$/i.test(path))path='/';history[d.replace?'replaceState':'pushState']({etosRoute:true},'',path);if(d.title)document.title=d.title});
      addEventListener('popstate',function(){iframe.src=iframeUrl();document.body.classList.add('ready')});
    }());
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  const requestedType = normalizeType(req.query.jenis || 'Opini');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!/^[a-z0-9-]{3,220}$/.test(slug)) {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.end(renderNotFound(slug));
    return;
  }

  try {
    const publication = await fetchPublication(slug);
    if (!publication) {
      res.statusCode = 404;
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.end(renderNotFound(slug));
      return;
    }

    const actualType = normalizeType(publication.jenis);
    const canonicalSlug = String(publication.slug || slug).trim().toLowerCase();
    const actualPath = `/${routeSegment(actualType)}/${encodeURIComponent(canonicalSlug)}`;
    const requestedPath = `/${routeSegment(requestedType)}/${encodeURIComponent(slug)}`;

    /*
     * Bila judul pernah berubah, Apps Script dapat menemukan tulisan melalui
     * ID ART/BRT pada ujung slug dan mengembalikan slug terbaru. URL lama
     * kemudian diarahkan secara permanen ke URL kanonis yang benar.
     */
    if (actualPath !== requestedPath) {
      res.statusCode = 308;
      res.setHeader('Location', actualPath);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.end();
      return;
    }

    publication.slug = canonicalSlug;
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.end(renderPublicationPage(publication));
  } catch (error) {
    console.error('Failed to render publication metadata:', error);
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.end(renderNotFound(slug));
  }
};

module.exports._test = {
  escapeHtml,
  stripHtml,
  truncate,
  normalizeType,
  toIsoDate,
  routeSegment,
  normalizeImageUrl,
  renderPublicationPage
};
