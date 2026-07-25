const releaseList = document.querySelector('#release-list')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function releaseSection(title, items) {
  if (!items.length) return ''
  return `<div class="release-section"><h3>${title}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
}

async function renderReleases() {
  try {
    const response = await fetch('updates.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('Release notes unavailable')
    const data = await response.json()
    releaseList.innerHTML = data.releases.map((release, index) => `
      <article class="release-entry ${release.status === 'unreleased' ? 'release-draft' : ''}" data-reveal>
        <div class="release-meta">
          <span class="release-version">v${escapeHtml(release.version)}</span>
          <span>${release.status === 'unreleased' ? 'In progress' : escapeHtml(release.date)}</span>
        </div>
        <div class="release-body">
          <div class="release-heading">
            <p class="release-kicker">${index === 0 ? 'Latest update' : 'Release'}</p>
            <h2>${escapeHtml(release.titleEn)}</h2>
            <p>${escapeHtml(release.summaryEn)}</p>
            ${release.releaseUrl ? `<a class="text-link" href="${escapeHtml(release.releaseUrl)}" target="_blank" rel="noreferrer">Open GitHub release <span aria-hidden="true">&#8594;</span></a>` : ''}
          </div>
          <div class="release-details">
            ${releaseSection('Added', release.addedEn)}
            ${releaseSection('Changed', release.changedEn)}
            ${releaseSection('Fixed', release.fixedEn)}
          </div>
        </div>
      </article>
    `).join('')
    releaseList.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'))
  } catch (error) {
    releaseList.innerHTML = '<p class="release-error">Release notes could not be loaded. View the <a href="https://github.com/boxsbraindump/Mayhempedia/blob/main/CHANGELOG.md">GitHub changelog</a> instead.</p>'
  }
}

renderReleases()
