(() => {
  'use strict';

  const PROFILE_URL = 'https://www.trustpilot.com/review/promcbot.dev';

  function formatReviewCount(value) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  }

  function renderStars(container, score) {
    container.replaceChildren();
    if (score === null) return;
    for (let index = 0; index < 5; index += 1) {
      const star = document.createElement('span');
      star.className = 'trustpilot-star';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '★';
      const fill = Math.max(0, Math.min(1, score - index));
      star.style.setProperty('--star-fill', `${fill * 100}%`);
      container.appendChild(star);
    }
  }

  function renderWidget(root, stats) {
    const score = Number.isFinite(stats?.score) ? stats.score : null;
    const reviewCount = Number.isFinite(stats?.reviewCount) ? stats.reviewCount : null;
    const available = score !== null && reviewCount !== null;
    const profileUrl = stats?.profileUrl || PROFILE_URL;
    const status = root.querySelector('[data-trustpilot-status]');
    const value = root.querySelector('[data-trustpilot-value]');
    const count = root.querySelector('[data-trustpilot-count]');
    const stars = root.querySelector('[data-trustpilot-stars]');
    const updated = root.querySelector('[data-trustpilot-updated]');

    root.dataset.state = available ? 'available' : 'fallback';
    renderStars(stars, available ? score : null);
    if (available) {
      value.textContent = score.toFixed(1);
      count.textContent = `${formatReviewCount(reviewCount)} ${reviewCount === 1 ? 'review' : 'reviews'}`;
      status.textContent = 'Verified reputation data';
      root.querySelector('[data-trustpilot-rating-label]').textContent = `Rated ${score.toFixed(1)} out of 5 based on ${formatReviewCount(reviewCount)} ${reviewCount === 1 ? 'review' : 'reviews'}.`;
      updated.textContent = stats.lastUpdated ? `Updated ${stats.lastUpdated}` : '';
    } else {
      value.textContent = '—';
      count.textContent = 'No review statistics are configured yet';
      status.textContent = 'Reviews on Trustpilot';
      root.querySelector('[data-trustpilot-rating-label]').textContent = 'Trustpilot review statistics are not available yet.';
      updated.textContent = 'Statistics will appear here when a permitted source is connected.';
    }
    root.querySelectorAll('[data-trustpilot-link]').forEach(link => {
      link.href = profileUrl;
    });
  }

  async function loadWidget(root) {
    try {
      const response = await fetch('/api/trustpilot/stats', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Trustpilot stats request failed: ${response.status}`);
      renderWidget(root, await response.json());
    } catch (_) {
      renderWidget(root, { score: null, reviewCount: null, profileUrl: PROFILE_URL });
    }
  }

  document.querySelectorAll('[data-trustpilot-widget]').forEach(loadWidget);
})();
