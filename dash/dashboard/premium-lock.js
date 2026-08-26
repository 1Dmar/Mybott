(function () {
  window.renderFeatureLock = function ({ title, requiredPlan, description, feature }) {
    const wrapper = document.createElement('article');
    wrapper.className = 'feature-lock';
    wrapper.dataset.feature = feature || '';
    wrapper.innerHTML = `<h3></h3><span class="feature-lock-badge">LOCKED · ${requiredPlan}</span><p></p><a class="feature-lock-action" href="/premium">Upgrade to ${requiredPlan}</a>`;
    wrapper.querySelector('h3').textContent = title || 'Premium feature';
    wrapper.querySelector('p').textContent = description || 'Unlock deeper operational intelligence.';
    return wrapper;
  };
})();
