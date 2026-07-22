const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (motionAllowed) document.body.classList.add('motion-ready')

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
window.addEventListener('scroll', () => nav?.classList.toggle('is-scrolled', window.scrollY > 12), { passive: true })

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
    window.zaraz?.track?.('download_clicked', {
      placement: link.getAttribute('data-download-source') || 'unknown',
      version: '0.1.1',
    })
  })
})
