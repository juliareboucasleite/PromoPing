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
    cardWidth: 340,
    cardHeight: 232,
    gap: 28,
    padding: 28,
    radius: 20,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    serifFontFamily: 'Georgia, "Times New Roman", serif',
    // Card surface
    cardBg: '#ffffff',
    cardBorder: 'rgba(20, 10, 0, 0.06)',
    cardShadowColor: 'rgba(40, 20, 0, 0.12)',
    cardShadowBlur: 24,
    cardShadowOffsetY: 8,
    // Decorative
    quoteGlyphColor: '#FFA54B',
    dividerColor: 'rgba(20, 10, 0, 0.08)',
    // Stars
    starColor: '#FFA54B',
    starEmptyColor: 'rgba(20, 10, 0, 0.14)',
    // Text
    quoteTextColor: '#1a1a1a',
    nameColor: '#0a0a0a',
    roleColor: '#6b6b6b',
    // Avatar
    avatarGradientStart: '#FFA54B',
    avatarGradientEnd: '#e68200',
    avatarTextColor: '#ffffff',
    maxTextLines: 3
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

  function getInitials(name) {
    if (!name) return '?';
    const trimmed = String(name).trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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
        width: Math.max(240, Math.min(272, wrapperWidth - 20)),
        height: 220,
        gap: 16,
        padding: 22,
        maxTextLines: 3
      };
    }

    if (isMobile) {
      return {
        width: Math.max(260, Math.min(300, wrapperWidth - 28)),
        height: 224,
        gap: 20,
        padding: 24,
        maxTextLines: 3
      };
    }

    return {
      width: 340,
      height: 232,
      gap: 28,
      padding: 28,
      maxTextLines: 3
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
    const maxCanvasHeight = window.innerWidth <= 768 ? CONFIG.cardHeight + 48 : CONFIG.cardHeight + 56;
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
    const pad = CONFIG.padding;
    const innerW = w - pad * 2;

    // Card surface with soft drop shadow
    ctx.save();
    ctx.shadowColor = CONFIG.cardShadowColor;
    ctx.shadowBlur = CONFIG.cardShadowBlur;
    ctx.shadowOffsetY = CONFIG.cardShadowOffsetY;
    ctx.fillStyle = CONFIG.cardBg;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();

    // Hairline border for definition
    ctx.strokeStyle = CONFIG.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // Reset baseline for the rest of the card
    ctx.textBaseline = 'top';

    // Decorative quote glyph in brand orange (top-left, compact)
    ctx.fillStyle = CONFIG.quoteGlyphColor;
    ctx.font = 'bold 36px ' + CONFIG.serifFontFamily;
    ctx.fillText('“', x + pad, y + pad - 12);

    // Quote text — the hero of the card
    const textTop = y + pad + 30;
    ctx.font = '500 14.5px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.quoteTextColor;
    const lines = wrapLines(ctx, card.text, innerW);
    const lineHeight = 21;
    const maxL = CONFIG.maxTextLines;
    const visible = Math.min(lines.length, maxL);
    for (let i = 0; i < visible; i++) {
      let line = lines[i];
      if (i === maxL - 1 && lines.length > maxL) {
        // Append ellipsis fitting within innerW
        while (line.length > 0 && ctx.measureText(line + '…').width > innerW) {
          line = line.slice(0, -1);
        }
        line = line + '…';
      }
      ctx.fillText(line, x + pad, textTop + i * lineHeight);
    }

    // Bottom block: divider + avatar + name/role (+ stars)
    const bottomBlockH = 56;
    const bottomY = y + h - pad - bottomBlockH + 16;

    // Divider hairline
    ctx.strokeStyle = CONFIG.dividerColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, bottomY - 14);
    ctx.lineTo(x + w - pad, bottomY - 14);
    ctx.stroke();

    // Avatar circle with gradient + initials
    const avSize = 36;
    const avX = x + pad;
    const avY = bottomY;
    const grad = ctx.createLinearGradient(avX, avY, avX + avSize, avY + avSize);
    grad.addColorStop(0, CONFIG.avatarGradientStart);
    grad.addColorStop(1, CONFIG.avatarGradientEnd);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
    ctx.fill();

    const initials = getInitials(card.authorName);
    ctx.fillStyle = CONFIG.avatarTextColor;
    ctx.font = '700 13px ' + CONFIG.fontFamily;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(initials, avX + avSize / 2, avY + avSize / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Name + role (right of avatar)
    const textX = avX + avSize + 12;
    ctx.font = '600 13.5px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.nameColor;
    const nameMaxW = w - pad - textX;
    let displayName = card.authorName || '';
    while (displayName.length > 0 && ctx.measureText(displayName).width > nameMaxW) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== (card.authorName || '')) {
      displayName = displayName.slice(0, -1) + '…';
    }
    ctx.fillText(displayName, textX, avY + 2);

    // Role + stars on the same line, separated by a middle dot
    const stars = (card.rating != null && card.rating >= 1 && card.rating <= 5)
      ? Math.floor(card.rating) : 5;
    ctx.font = '12px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.roleColor;
    const roleText = card.role + '  ·  ';
    ctx.fillText(roleText, textX, avY + 22);
    const roleW = ctx.measureText(roleText).width;

    // Stars: filled then empty, smaller than before
    ctx.font = '11px ' + CONFIG.fontFamily;
    let sx = textX + roleW;
    const sy = avY + 23;
    ctx.fillStyle = CONFIG.starColor;
    for (let i = 0; i < stars; i++) {
      ctx.fillText('★', sx, sy);
      sx += 12;
    }
    ctx.fillStyle = CONFIG.starEmptyColor;
    for (let i = stars; i < 5; i++) {
      ctx.fillText('★', sx, sy);
      sx += 12;
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
    const section = document.getElementById('testimonials') || document.getElementById('testimonials-canvas')?.closest('section');
    const canvas = document.getElementById('testimonials-canvas');
    if (!canvas) return;

    const start = function () {
      if (testimonialsInited) return;
      testimonialsInited = true;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTestimonials);
      } else {
        loadTestimonials();
      }
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          observer.disconnect();
          start();
        }
      }, { rootMargin: '200px 0px' });
      observer.observe(section || canvas);
      return;
    }

    start();
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
