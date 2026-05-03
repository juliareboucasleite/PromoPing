/**
 * Carrossel de depoimentos em Canvas (como o de marcas).
 * Carrega reviews da API e desenha cards em loop infinito.
 */
(function() {
  'use strict';

  const API_ENDPOINT = '/api/status/reviews/public';

  const CONFIG = {
    speed: 0.4,
    pauseOnHover: false,
    cardWidth: 320,
    cardHeight: 200,
    gap: 56,
    padding: 28,
    radius: 16,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    starColor: '#fa5c00',
    starEmptyColor: 'rgba(255,255,255,0.2)',
    textColor: 'rgba(255,255,255,0.9)',
    roleColor: 'rgba(255,255,255,0.6)',
    cardBg: 'rgba(255,255,255,0.12)',
    cardBorder: 'rgba(255,255,255,0.25)',
    maxTextLines: 4
  };

  const translations = {
    'A carregar depoimentos...': 'Loading testimonials...',
    'No testimonials available yet.': 'No testimonials available yet.',
    'Error loading testimonials.': 'Error loading testimonials.',
    'Anonymous': 'Anonymous',
    'User': 'User',
    'Bot User': 'Bot User'
  };

  let canvas = null;
  let ctx = null;
  let wrapper = null;
  let messageEl = null;
  let animationId = null;
  let isPaused = false;
  let offsetX = 0;
  let loopWidth = 0;
  let dpr = 1;
  let reviewsData = [];

  function isEnglish() {
    const langText = document.getElementById('lang-text');
    return langText && langText.textContent.trim() === 'EN';
  }

  function translate(text) {
    if (isEnglish() && translations[text]) return translations[text];
    return text;
  }

  function getAuthorName(review) {
    const name = review.author.isAnonymous ? 'Anonymous' : (review.author.name || 'User');
    return translate(name);
  }

  function getRole(review) {
    const role = review.type === 'site' ? 'User' :
      review.type === 'bot' ? 'Bot User' :
      review.type === 'suporte' ? 'User' : 'User';
    return translate(role);
  }

  function formatText(text, maxLen) {
    if (!text) return '';
    if (text.length <= (maxLen || 180)) return text;
    return text.substring(0, maxLen || 180).trim() + '...';
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      const m = ctx.measureText(test);
      if (m.width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function showMessage(text, showCanvas) {
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.style.display = text ? 'block' : 'none';
    }
    if (canvas) {
      canvas.style.display = showCanvas ? 'block' : 'none';
    }
  }

  function getResponsiveCardMetrics() {
    const viewportWidth = window.innerWidth || 1280;
    const wrapperWidth = wrapper ? Math.floor(wrapper.getBoundingClientRect().width) : viewportWidth;
    const isSmallMobile = viewportWidth <= 480;
    const isMobile = viewportWidth <= 768;

    if (isSmallMobile) {
      return {
        width: Math.max(220, Math.min(252, wrapperWidth - 20)),
        height: 190,
        gap: 18,
        padding: 18,
        maxTextLines: 3
      };
    }

    if (isMobile) {
      return {
        width: Math.max(240, Math.min(280, wrapperWidth - 28)),
        height: 196,
        gap: 22,
        padding: 20,
        maxTextLines: 3
      };
    }

    return {
      width: 320,
      height: 200,
      gap: 56,
      padding: 28,
      maxTextLines: 4
    };
  }

  function initCanvas() {
    canvas = document.getElementById('testimonials-canvas');
    messageEl = document.getElementById('testimonials-message');
    if (!canvas) return;

    wrapper = canvas.closest('.testimonials-columns-wrapper');
    if (!wrapper) return;

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    window.addEventListener('resize', resize);
    if (CONFIG.pauseOnHover && wrapper) {
      wrapper.addEventListener('mouseenter', function() { isPaused = true; });
      wrapper.addEventListener('mouseleave', function() { isPaused = false; });
    }
    document.addEventListener('visibilitychange', function() {
      isPaused = document.hidden;
    });
  }

  function resize() {
    if (!canvas || !wrapper) return;
    if (reviewsData.length === 0) return;

    dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const metrics = getResponsiveCardMetrics();
    CONFIG.cardWidth = metrics.width;
    CONFIG.cardHeight = metrics.height;
    CONFIG.gap = metrics.gap;
    CONFIG.padding = metrics.padding;
    CONFIG.maxTextLines = metrics.maxTextLines;
    const maxCanvasHeight = window.innerWidth <= 768 ? CONFIG.cardHeight + 8 : 240;
    const h = Math.min(maxCanvasHeight, Math.max(CONFIG.cardHeight + 8, Math.floor(rect.height)));

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var n = reviewsData.length;
    loopWidth = n * (CONFIG.cardWidth + CONFIG.gap);
    offsetX = 0;
    draw();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
    ctx.closePath();
  }

  function drawCard(ctx, card, x, y, w, h) {
    const r = CONFIG.radius;
    ctx.fillStyle = CONFIG.cardBg;
    ctx.strokeStyle = CONFIG.cardBorder;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    let ty = y + CONFIG.padding;

    ctx.font = '16px ' + CONFIG.fontFamily;
    const stars = (card.rating != null && card.rating >= 1 && card.rating <= 5)
      ? Math.floor(card.rating) : 5;
    const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    ctx.fillStyle = CONFIG.starColor;
    ctx.fillText(starStr.substring(0, stars), x + CONFIG.padding, ty + 10);
    ctx.fillStyle = CONFIG.starEmptyColor;
    ctx.fillText(starStr.substring(stars, 5), x + CONFIG.padding + ctx.measureText(starStr.substring(0, stars)).width, ty + 10);
    ty += 28;

    ctx.font = '600 14px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.textColor;
    ctx.fillText(card.authorName, x + CONFIG.padding, ty + 10);
    ty += 22;

    ctx.font = '12px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.roleColor;
    ctx.fillText(card.role, x + CONFIG.padding, ty + 8);
    ty += 24;

    const textWidth = w - CONFIG.padding * 2;
    ctx.font = '13px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.textColor;
    const lines = wrapLines(ctx, card.text, textWidth);
    const lineHeight = 18;
    const maxL = CONFIG.maxTextLines;
    for (let i = 0; i < Math.min(lines.length, maxL); i++) {
      ctx.fillText(lines[i], x + CONFIG.padding, ty + 10);
      ty += lineHeight;
    }
    if (lines.length > maxL) {
      ctx.fillStyle = CONFIG.roleColor;
      ctx.fillText('...', x + CONFIG.padding, ty - lineHeight + 10);
    }
  }

  function draw() {
    if (!ctx || !canvas || reviewsData.length === 0) return;

    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.clearRect(0, 0, cw, ch);

    const cardW = CONFIG.cardWidth;
    const cardH = CONFIG.cardHeight;
    const gap = CONFIG.gap;
    const y = (ch - cardH) / 2;

    for (let copy = 0; copy < 2; copy++) {
      let x = copy * loopWidth - offsetX;
      for (let i = 0; i < reviewsData.length; i++) {
        if (x + cardW >= -20 && x <= cw + 20) {
          drawCard(ctx, reviewsData[i], x, y, cardW, cardH);
        }
        x += cardW + gap;
      }
    }
  }

  function animate() {
    if (isPaused || !canvas || reviewsData.length === 0) {
      animationId = null;
      return;
    }
    offsetX += CONFIG.speed;
    while (loopWidth > 0 && offsetX >= loopWidth) {
      offsetX -= loopWidth;
    }
    draw();
    animationId = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (animationId) return;
    if (reviewsData.length === 0) return;
    isPaused = false;
    animationId = requestAnimationFrame(animate);
  }

  async function loadTestimonials() {
    if (!messageEl && document.getElementById('testimonials-message')) {
      messageEl = document.getElementById('testimonials-message');
    }
    if (!canvas && document.getElementById('testimonials-canvas')) {
      canvas = document.getElementById('testimonials-canvas');
      wrapper = canvas && canvas.closest('.testimonials-columns-wrapper');
      if (canvas && wrapper) {
        ctx = canvas.getContext('2d');
        if (!testimonialsInited) {
          initCanvas();
          testimonialsInited = true;
        }
      }
    }

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    showMessage(translate('Loading testimonials...'), false);

    try {
      const response = await fetch(API_ENDPOINT + '?limit=30');
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const data = await response.json();
      if (data.status !== 'ok' || !data.reviews || data.reviews.length === 0) {
        showMessage(translate('No testimonials available yet.'), false);
        reviewsData = [];
        return;
      }

      reviewsData = data.reviews.map(function(r) {
        return {
          authorName: getAuthorName(r),
          role: getRole(r),
          text: formatText(r.text),
          rating: r.rating != null ? r.rating : 5
        };
      });

      showMessage('', true);
      resize();
      window.addEventListener('load', function onLoad() {
        window.removeEventListener('load', onLoad);
        resize();
        if (!animationId) startAnimation();
      });
      startAnimation();
    } catch (err) {
      console.error('[TESTIMONIALS]', err);
      showMessage(translate('Error loading testimonials.'), false);
      reviewsData = [];
    }
  }

  let testimonialsInited = false;

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadTestimonials);
    } else {
      setTimeout(loadTestimonials, 50);
    }
  }

  init();

  const langEl = document.getElementById('lang-text');
  if (langEl) {
    let lastLang = langEl.textContent.trim();
    const observer = new MutationObserver(function() {
      const cur = langEl.textContent.trim();
      if (cur !== lastLang && (cur === 'PT' || cur === 'EN')) {
        lastLang = cur;
        loadTestimonials();
      }
    });
    observer.observe(langEl, { childList: true, characterData: true, subtree: true });
  }

  window.loadTestimonials = loadTestimonials;
})();
