// Shared page chrome for every page: theme toggle and the nav border on scroll.
(() => {
  const meta = document.getElementById('theme-meta')
  const apply = t => {
    document.documentElement.setAttribute('data-theme', t)
    if (meta) meta.content = t === 'dark' ? '#141210' : '#FBF8F3'
  }
  apply(document.documentElement.getAttribute('data-theme'))
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    apply(next)
    try { localStorage.setItem('theme', next) } catch (e) {}
  })

  const nav = document.getElementById('nav')
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8)
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  }
})()
