const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (motionAllowed) document.body.classList.add('motion-ready')

// Conversion events stay inert until the site owner wires in an analytics
// provider. This keeps the GitHub Pages build privacy-first while exposing a
// single event contract for Zaraz, Plausible, or a small first-party endpoint.
const PUBLIC_RELEASE_VERSION = '0.1.1'
const analyticsEndpoint = window.MAYHEMPEDIA_ANALYTICS_ENDPOINT || ''

function track(eventName, properties = {}) {
  const payload = {
    ...properties,
    version: PUBLIC_RELEASE_VERSION,
    path: window.location.pathname,
  }

  window.dataLayer?.push({ event: eventName, ...payload })
  window.zaraz?.track?.(eventName, payload)
  window.plausible?.(eventName, { props: payload })

  if (analyticsEndpoint && navigator.sendBeacon) {
    navigator.sendBeacon(
      analyticsEndpoint,
      new Blob([JSON.stringify({ event: eventName, ...payload })], { type: 'application/json' }),
    )
  }
}

track('landing_view')

const revealElements = document.querySelectorAll('[data-reveal]')
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.14 },
  )
  revealElements.forEach((element) => observer.observe(element))
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'))
}

const nav = document.querySelector('[data-nav]')
if (nav && 'IntersectionObserver' in window) {
  const navSentinel = document.createElement('span')
  navSentinel.setAttribute('aria-hidden', 'true')
  nav.before(navSentinel)
  const navObserver = new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-scrolled', !entry.isIntersecting),
    { threshold: 1 },
  )
  navObserver.observe(navSentinel)
}

document.querySelectorAll('[data-demo-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const demo = button.closest('.concept-window')
    const target = button.getAttribute('data-demo-target')
    demo?.querySelectorAll('[data-demo-target]').forEach((tab) => {
      const isActive = tab === button
      tab.classList.toggle('is-active', isActive)
      tab.setAttribute('aria-selected', String(isActive))
    })
    demo?.querySelectorAll('[data-demo-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.getAttribute('data-demo-panel') === target)
    })
  })
})

if (motionAllowed) {
  document.querySelectorAll('[data-parallax-stage]').forEach((stage) => {
    const card = stage.querySelector('[data-parallax-card]')
    const floaters = stage.querySelectorAll('[data-float-card]')
    stage.addEventListener('pointermove', (event) => {
      const bounds = stage.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width - 0.5
      const y = (event.clientY - bounds.top) / bounds.height - 0.5
      card?.style.setProperty('--rx', `${y * -2.4}deg`)
      card?.style.setProperty('--ry', `${x * 3.4}deg`)
      floaters.forEach((floater, index) => {
        floater.style.transform = `translate3d(${x * (index ? -10 : 12)}px, ${y * (index ? -8 : 9)}px, 0)`
      })
    })
    stage.addEventListener('pointerleave', () => {
      card?.style.setProperty('--rx', '0deg')
      card?.style.setProperty('--ry', '0deg')
      floaters.forEach((floater) => { floater.style.transform = '' })
    })
  })

  document.querySelectorAll('[data-tilt-card]').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width - 0.5
      const y = (event.clientY - bounds.top) / bounds.height - 0.5
      card.style.transform = `perspective(1100px) rotateX(${y * -1.2}deg) rotateY(${x * 1.6}deg) translateY(-3px)`
    })
    card.addEventListener('pointerleave', () => { card.style.transform = '' })
  })
}

document.querySelectorAll('[data-download-source]').forEach((link) => {
  link.addEventListener('click', () => {
    track('download_clicked', {
      placement: link.getAttribute('data-download-source') || 'unknown',
    })
  })
})

document.querySelectorAll('[data-preview-source]').forEach((link) => {
  link.addEventListener('click', () => {
    track('preview_clicked', {
      placement: link.getAttribute('data-preview-source') || 'unknown',
    })
  })
})

const demoSection = document.querySelector('#demo-client, #inside')
if (demoSection && 'IntersectionObserver' in window) {
  const demoObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      track('demo_viewed', { placement: demoSection.id })
      demoObserver.disconnect()
    },
    { threshold: 0.35 },
  )
  demoObserver.observe(demoSection)
}
