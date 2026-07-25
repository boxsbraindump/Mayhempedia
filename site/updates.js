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
    releaseList.innerHTML = data.releases.map((release, index) => {
      const isClosedBeta = release.status === 'closed_beta'
      const isUnreleased = release.status === 'unreleased'
      const statusText = isClosedBeta ? 'Closed beta' : (isUnreleased ? 'In progress' : escapeHtml(release.date))
      const statusClass = (isClosedBeta || isUnreleased) ? 'release-draft' : ''
      const action = isClosedBeta
        ? '<a class="text-link" href="https://discord.gg/V56Yxb4sPm" target="_blank" rel="noreferrer">Join the closed beta <span aria-hidden="true">&#8594;</span></a>'
        : (release.releaseUrl ? `<a class="text-link" href="${escapeHtml(release.releaseUrl)}" target="_blank" rel="noreferrer">Open GitHub release <span aria-hidden="true">&#8594;</span></a>` : '')
      return `
      <article class="release-entry ${statusClass}" data-reveal>
        <div class="release-meta">
          <span class="release-version">v${escapeHtml(release.version)}</span>
          <span>${statusText}</span>
        </div>
        <div class="release-body">
          <div class="release-heading">
            <p class="release-kicker">${index === 0 ? (isClosedBeta ? 'Latest closed beta' : 'Latest update') : 'Release'}</p>
            <h2>${escapeHtml(release.titleEn)}</h2>
            <p>${escapeHtml(release.summaryEn)}</p>
            ${action}
          </div>
          <div class="release-details">
            ${releaseSection('Added', release.addedEn)}
            ${releaseSection('Changed', release.changedEn)}
            ${releaseSection('Fixed', release.fixedEn)}
          </div>
        </div>
      </article>
    `
    }).join('')
    releaseList.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'))
  } catch (error) {
    releaseList.innerHTML = '<p class="release-error">Release notes could not be loaded. View the <a href="https://github.com/boxsbraindump/Mayhempedia/blob/main/CHANGELOG.md">GitHub changelog</a> instead.</p>'
  }
}

renderReleases()
