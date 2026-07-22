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

function routeSegment(type) {
  return normalizeType(type) === 'Berita' ? 'berita' : 'opini';
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
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=w1800`;
    }
  }

  return /^https:\/\//i.test(url) ? url : FALLBACK_IMAGE;
}

async function fetchGasPublication(slug, full) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), full ? 30000 : 15000);

  try {
    const endpoint = new URL(GAS_URL);
    endpoint.searchParams.set('api', full ? 'publication-full' : 'publication');
    endpoint.searchParams.set('slug', slug);
    endpoint.searchParams.set('_ts', String(Date.now()));

    const response = await fetch(endpoint.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': full
          ? 'Etos-ID-Palu-Article/3.0'
          : 'Etos-ID-Palu-Metadata/3.0',
        'cache-control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
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
  const description = truncate(data.excerpt || '', 190) || 'Baca publikasi terbaru dari Etos ID Palu.';
  const image = normalizeImageUrl(data.thumb);
  const imagePosition = String(data.thumbPosition || '50% 50%').trim();
  const author = String(data.penulis || 'Etos ID Palu').trim();
  const date = String(data.tanggal || '').trim();
  const isoDate = toIsoDate(date);
  const bootstrap = JSON.stringify({
    slug,
    type,
    title,
    author,
    date,
    image,
    imagePosition,
    canonical
  }).replace(/</g, '\\u003c');

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
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
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
  <link rel="preconnect" href="https://lh3.googleusercontent.com">
  <link rel="preload" as="image" href="${escapeHtml(image)}">
  <script type="application/ld+json">${structuredData}</script>

  <style>
    :root{--brand:#0c332d;--brand-2:#155e4b;--accent:#2b7a60;--paper:#f6f5f1;--ink:#17211d;--muted:#68736e;--line:#dce5df;--white:#fff}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
    a{color:inherit}
    .site-header{position:relative;z-index:5;display:flex;align-items:center;min-height:88px;padding:0 clamp(1.1rem,4vw,4rem);border-top:2px solid var(--accent);border-bottom:1px solid var(--line);background:rgba(255,255,255,.97)}
    .site-header img{width:88px;height:44px;object-fit:contain}.brand{margin-left:.85rem;font-family:Georgia,serif;font-size:clamp(1.4rem,2.4vw,2rem);font-weight:700}.section-label{margin-left:auto;font-size:.75rem;font-weight:800;letter-spacing:.17em;text-transform:uppercase;color:#53615b}
    .hero{position:relative;min-height:min(720px,78vh);display:flex;align-items:flex-end;overflow:hidden;background:var(--brand);color:#fff}
    .hero-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${escapeHtml(imagePosition)};filter:saturate(.88) contrast(1.03)}
    .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,25,21,.94) 0%,rgba(2,25,21,.75) 43%,rgba(2,25,21,.24) 100%),linear-gradient(0deg,rgba(2,25,21,.88),transparent 65%)}
    .hero-copy{position:relative;z-index:2;width:min(100%,1080px);padding:clamp(3rem,8vw,7rem) clamp(1.25rem,5vw,4.75rem)}
    .eyebrow{font-size:.73rem;font-weight:800;letter-spacing:.19em;text-transform:uppercase;color:#d7e8df}
    h1{max-width:1000px;margin:.9rem 0 1.2rem;font-family:Georgia,serif;font-size:clamp(3rem,8vw,7rem);line-height:.94;letter-spacing:-.045em;text-wrap:balance}
    .lead{max-width:760px;margin:0;font-size:clamp(1rem,2vw,1.22rem);line-height:1.7;color:rgba(255,255,255,.82)}
    .meta{margin-top:1.3rem;font-size:.84rem;color:rgba(255,255,255,.66)}
    .article-shell{width:min(100% - 2rem,900px);margin:0 auto;padding:clamp(2.4rem,7vw,6rem) 0 6rem}
    .article-tools{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:2.5rem}
    .back,.share{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:.75rem 1rem;border:1px solid var(--line);border-radius:999px;background:#fff;text-decoration:none;font-weight:700;color:#33413b}
    .share{cursor:pointer;background:var(--brand-2);border-color:var(--brand-2);color:#fff}
    .article-content{font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.08rem,2vw,1.28rem);line-height:1.9;color:#27322d;overflow-wrap:anywhere}
    .article-content p{margin:0 0 1.55em}.article-content h2,.article-content h3,.article-content h4{line-height:1.2;color:#13231d;margin:2.2em 0 .75em}.article-content h2{font-size:clamp(1.8rem,4vw,2.75rem)}.article-content h3{font-size:clamp(1.45rem,3vw,2rem)}
    .article-content blockquote{margin:2rem 0;padding:1.25rem 1.5rem;border-left:4px solid var(--accent);background:#eaf1ed;font-style:italic}
    .article-content img{display:block;max-width:100%;height:auto;margin:2.2rem auto;border-radius:18px}.article-content a{color:var(--brand-2)}
    .article-content ul,.article-content ol{padding-left:1.4em}.article-content li{margin:.45em 0}
    .loading{transition:opacity .28s ease}.loading.done{opacity:0;height:0;overflow:hidden;pointer-events:none}
    .loading-note{display:flex;align-items:center;gap:.8rem;margin-bottom:1.7rem;color:var(--muted);font-family:Arial,sans-serif;font-size:.9rem}
    .pulse-dot{width:11px;height:11px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 0 rgba(43,122,96,.38);animation:pulse 1.4s infinite}
    .skeleton{height:17px;margin:0 0 16px;border-radius:999px;background:linear-gradient(90deg,#e3e8e5 20%,#f4f6f5 45%,#e3e8e5 70%);background-size:240% 100%;animation:shimmer 1.25s linear infinite}.skeleton:nth-child(3n){width:76%}.skeleton:nth-child(4n){width:91%}
    .article-content.is-ready{animation:contentIn .38s cubic-bezier(.22,1,.36,1)}
    .load-error{display:none;padding:1.5rem;border:1px solid #d9e1dc;border-radius:18px;background:#fff;color:#56645d}.load-error.show{display:block}.retry{margin-top:1rem;padding:.75rem 1rem;border:0;border-radius:999px;background:var(--brand-2);color:#fff;font-weight:700;cursor:pointer}
    footer{padding:2rem 1.2rem;background:var(--brand);color:rgba(255,255,255,.72);text-align:center;font-size:.83rem}
    @keyframes shimmer{to{background-position:-240% 0}}@keyframes pulse{70%{box-shadow:0 0 0 10px rgba(43,122,96,0)}}@keyframes contentIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @media(max-width:720px){
      .site-header{min-height:74px}.site-header img{width:76px}.brand{font-size:1.4rem}.section-label{font-size:.62rem}
      .hero{display:grid;min-height:0;background:var(--brand)}.hero-image{position:relative;inset:auto;display:block;aspect-ratio:4/3;height:auto;object-fit:cover;object-position:${escapeHtml(imagePosition)}}
      .hero::after{background:linear-gradient(0deg,var(--brand) 0%,rgba(12,51,45,.88) 30%,rgba(12,51,45,0) 68%)}
      .hero-copy{margin-top:-96px;padding:1.5rem 1.25rem 2.4rem}.hero h1{font-size:clamp(2.55rem,12vw,4.25rem);line-height:.96}.lead{font-size:.96rem;line-height:1.6}
      .article-shell{width:min(100% - 2rem,760px);padding-top:2.2rem}.article-tools{margin-bottom:2rem}.article-content{font-size:1.06rem;line-height:1.82}
    }
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.pulse-dot,.skeleton,.article-content.is-ready{animation:none}}
  </style>
</head>
<body>
  <header class="site-header">
    <img src="${LOGO_URL}" alt="Logo Etos ID">
    <span class="brand">Etos ID Palu</span>
    <span class="section-label">${escapeHtml(type)}</span>
  </header>

  <section class="hero">
    <img id="hero-image" class="hero-image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
    <div class="hero-copy">
      <div class="eyebrow">${escapeHtml(type)} · Etos ID Palu</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">${escapeHtml(description)}</p>
      <div class="meta">${escapeHtml(author)}${date ? ` · ${escapeHtml(date)}` : ''}</div>
    </div>
  </section>

  <main class="article-shell">
    <div class="article-tools">
      <a class="back" href="${SITE_URL}/">← Kembali ke Etos ID Palu</a>
      <button class="share" id="share-button" type="button">Bagikan tulisan</button>
    </div>

    <div id="article-loading" class="loading" aria-live="polite">
      <div class="loading-note"><span class="pulse-dot"></span><span>Menyiapkan isi tulisan…</span></div>
      <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    </div>

    <article id="article-content" class="article-content" hidden></article>

    <section id="load-error" class="load-error">
      <strong>Isi tulisan belum berhasil dimuat.</strong>
      <p>Koneksi mungkin terputus. Halaman ini tidak perlu dibuka ulang dari awal.</p>
      <button id="retry-button" class="retry" type="button">Coba lagi</button>
    </section>
  </main>

  <footer>© 2026 Etos ID Palu. Hak Cipta Dilindungi Undang-Undang.</footer>

  <script>
    window.__ETOS_PUBLICATION__ = ${bootstrap};

    (function(){
      var state = window.__ETOS_PUBLICATION__;
      var loading = document.getElementById('article-loading');
      var article = document.getElementById('article-content');
      var errorBox = document.getElementById('load-error');
      var retryButton = document.getElementById('retry-button');
      var shareButton = document.getElementById('share-button');
      var heroImage = document.getElementById('hero-image');
      var fallbackImage = ${JSON.stringify(FALLBACK_IMAGE)};

      heroImage.addEventListener('error', function(){
        if(heroImage.src !== fallbackImage) heroImage.src = fallbackImage;
      });

      function escapeText(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function sanitizeArticleHtml(rawHtml) {
        var raw = String(rawHtml || '');
        if(!/<[a-z][\s\S]*>/i.test(raw)) {
          return raw
            .split(/\n{2,}/)
            .map(function(paragraph){
              return '<p>' + escapeText(paragraph).replace(/\n/g, '<br>') + '</p>';
            })
            .join('');
        }

        var template = document.createElement('template');
        template.innerHTML = raw;

        template.content
          .querySelectorAll('script,style,iframe,object,embed,form,input,textarea,button,link,meta')
          .forEach(function(node){ node.remove(); });

        template.content.querySelectorAll('*').forEach(function(node){
          Array.prototype.slice.call(node.attributes || []).forEach(function(attribute){
            var name = String(attribute.name || '').toLowerCase();
            var value = String(attribute.value || '');
            if(name.indexOf('on') === 0) node.removeAttribute(attribute.name);
            if((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
              node.removeAttribute(attribute.name);
            }
            if(name === 'style' && /expression\s*\(|javascript:|url\s*\(\s*['"]?\s*javascript:/i.test(value)) {
              node.removeAttribute('style');
            }
          });
        });

        return template.innerHTML;
      }

      function setLoading(isLoading) {
        if(isLoading) {
          loading.classList.remove('done');
          loading.removeAttribute('aria-hidden');
          article.hidden = true;
          errorBox.classList.remove('show');
        } else {
          loading.classList.add('done');
          loading.setAttribute('aria-hidden', 'true');
        }
      }

      function loadFullArticle() {
        setLoading(true);

        var endpoint = '/api/content?format=json&jenis=' +
          encodeURIComponent(state.type) +
          '&slug=' + encodeURIComponent(state.slug) +
          '&_ts=' + Date.now();

        fetch(endpoint, {
          cache: 'no-store',
          headers: { accept: 'application/json' }
        })
          .then(function(response){
            if(!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function(payload){
            if(!payload || payload.status !== 'success' || !payload.data) {
              throw new Error((payload && payload.message) || 'Data tulisan tidak tersedia.');
            }

            var data = payload.data;
            var html = sanitizeArticleHtml(data.isi || '');
            if(!html.trim()) throw new Error('Isi tulisan kosong.');

            article.innerHTML = html;
            article.hidden = false;
            article.classList.remove('is-ready');
            void article.offsetWidth;
            article.classList.add('is-ready');
            setLoading(false);

            if(data.thumb) {
              var nextImage = String(data.thumb);
              if(nextImage && !/^data:/i.test(nextImage)) heroImage.src = nextImage;
            }
          })
          .catch(function(error){
            console.error('Gagal memuat isi publikasi:', error);
            loading.classList.add('done');
            article.hidden = true;
            errorBox.classList.add('show');
          });
      }

      retryButton.addEventListener('click', loadFullArticle);

      shareButton.addEventListener('click', function(){
        var shareData = {
          title: state.title,
          text: state.title,
          url: state.canonical
        };

        if(navigator.share) {
          navigator.share(shareData).catch(function(){});
          return;
        }

        var whatsapp = 'https://wa.me/?text=' +
          encodeURIComponent(state.title + '\n' + state.canonical);
        window.open(whatsapp, '_blank', 'noopener');
      });

      loadFullArticle();
    }());
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  const requestedType = normalizeType(req.query.jenis || 'Opini');
  const format = String(req.query.format || '').trim().toLowerCase();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!/^[a-z0-9-]{3,220}$/.test(slug)) {
    if (format === 'json') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ status: 'error', message: 'Slug tidak valid.', data: null }));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.end(renderNotFound(slug));
    return;
  }

  try {
    if (format === 'json') {
      const publication = await fetchGasPublication(slug, true);
      if (!publication) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({
          status: 'error',
          message: 'Isi tulisan tidak ditemukan atau belum diterbitkan.',
          data: null
        }));
        return;
      }

      publication.thumb = normalizeImageUrl(publication.thumb);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.end(JSON.stringify({ status: 'success', data: publication }));
      return;
    }

    const publication = await fetchGasPublication(slug, false);
    if (!publication) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.end(renderNotFound(slug));
      return;
    }

    const actualType = normalizeType(publication.jenis);
    const canonicalSlug = String(publication.slug || slug).trim().toLowerCase();
    const actualPath = `/${routeSegment(actualType)}/${encodeURIComponent(canonicalSlug)}`;
    const requestedPath = `/${routeSegment(requestedType)}/${encodeURIComponent(slug)}`;

    if (actualPath !== requestedPath) {
      res.statusCode = 308;
      res.setHeader('Location', actualPath);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.end();
      return;
    }

    publication.slug = canonicalSlug;
    publication.thumb = normalizeImageUrl(publication.thumb);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.end(renderPublicationPage(publication));
  } catch (error) {
    console.error('Failed to render publication:', error);

    if (format === 'json') {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({
        status: 'error',
        message: 'Isi tulisan sedang tidak dapat dimuat.',
        data: null
      }));
      return;
    }

    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(renderNotFound(slug));
  }
};

module.exports._test = {
  escapeHtml,
  stripHtml,
  truncate,
  normalizeType,
  routeSegment,
  toIsoDate,
  normalizeImageUrl,
  renderPublicationPage
};
