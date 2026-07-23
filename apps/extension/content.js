// content.js — injected via chrome.scripting.executeScript({ files: ['content.js'] }).
// The completion value of this script (the IIFE's return) is delivered back to the
// caller as results[0].result. It extracts a readable version of the page plus the
// current text selection using a small readability heuristic.
(function extractReadable() {
  const MIN_TEXT = 200;

  function clean(input) {
    return (input || '')
      .replace(/\r/g, '')
      .replace(/[\t  ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Remove non-content chrome from a cloned node before reading its text.
  function stripClone(node) {
    const clone = node.cloneNode(true);
    const junk = clone.querySelectorAll(
      'script,style,noscript,template,nav,header,footer,aside,form,button,svg,iframe,' +
        'figure figcaption,[aria-hidden="true"],[hidden],[role="navigation"],' +
        '[role="banner"],[role="contentinfo"],[role="complementary"],[role="search"]',
    );
    junk.forEach((el) => el.remove());
    return clone;
  }

  function readText(node) {
    if (!node) return '';
    const clone = stripClone(node);
    return clean(clone.innerText || clone.textContent || '');
  }

  // Score a candidate by the amount of paragraph-like text, penalizing link density.
  function paragraphScore(el) {
    let text = 0;
    let linkText = 0;
    el.querySelectorAll('p,li,blockquote,pre,h2,h3').forEach((p) => {
      text += (p.innerText || '').trim().length;
    });
    el.querySelectorAll('a').forEach((a) => {
      linkText += (a.innerText || '').trim().length;
    });
    if (text === 0) return 0;
    const density = 1 - Math.min(linkText / text, 1);
    return text * density;
  }

  function pickMain() {
    // 1) Prefer a semantic <article> with enough content.
    const article = document.querySelector('article');
    if (article && readText(article).length >= MIN_TEXT) return article;

    // 2) Otherwise scan likely containers for the densest text block.
    let best = null;
    let bestScore = 0;
    const explicit = document.querySelector('main, [role="main"]');
    if (explicit) {
      best = explicit;
      bestScore = paragraphScore(explicit);
    }
    const candidates = document.querySelectorAll(
      'article, main, [role="main"], .post, .article, .post-content, .entry-content, ' +
        '.article-body, .markdown-body, .content, #content, #main, section, div',
    );
    candidates.forEach((el) => {
      if (el.closest('nav, header, footer, aside')) return;
      const score = paragraphScore(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best || document.body;
  }

  function metaTitle() {
    const og = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
    if (og && og.content && og.content.trim()) return og.content.trim();
    const h1 = document.querySelector('h1');
    if (h1 && (h1.innerText || '').trim()) return h1.innerText.trim();
    return (document.title || '').trim();
  }

  function metaByline() {
    const a = document.querySelector(
      'meta[name="author"], meta[property="article:author"], [rel="author"]',
    );
    if (!a) return '';
    return (a.content || a.innerText || '').trim();
  }

  const selection =
    window.getSelection && window.getSelection() ? clean(window.getSelection().toString()) : '';
  const main = pickMain();

  return {
    title: metaTitle(),
    url: location.href,
    byline: metaByline(),
    selection: selection,
    text: readText(main),
  };
})();
