// Song page behaviour: a 60-second preview player and lyrics that follow it.
// The page content itself is rendered on the server by worker/index.js.
(() => {
  const LIMIT = 60
  const preview = document.getElementById('preview')
  if (!preview?.dataset.src) return

  const btn = preview.querySelector('.preview-btn')
  const bar = preview.querySelector('.preview-bar')
  const time = preview.querySelector('.preview-time')
  const lyrics = document.getElementById('lyrics')
  const lines = lyrics ? [...lyrics.querySelectorAll('p[data-t]')] : []

  const audio = new Audio()
  audio.preload = 'none'
  let limit = Math.min(LIMIT, Number(preview.dataset.duration) || LIMIT)
  let current = null

  const fmt = s => {
    s = Math.max(0, Math.floor(s || 0))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  function render() {
    const t = Math.min(audio.currentTime || 0, limit)
    bar.style.width = `${limit ? (t / limit) * 100 : 0}%`
    time.textContent = `${fmt(t)} / ${fmt(limit)}`
    const playing = !audio.paused
    preview.classList.toggle('is-playing', playing)
    btn.setAttribute('aria-label', playing ? '暂停' : '试听')
    lyrics?.classList.toggle('is-playing', playing && lines.length > 0)
    syncLyrics(t)
  }

  // Highlight the last line whose timestamp has passed and keep it centred in the lyrics box.
  function syncLyrics(t) {
    if (!lines.length) return
    let next = null
    for (const line of lines) {
      if (Number(line.dataset.t) <= t) next = line
      else break
    }
    if (next === current) return
    current?.classList.remove('on')
    current = next
    if (!current) return
    current.classList.add('on')
    if (!audio.paused) {
      lyrics.scrollTo({ top: current.offsetTop - lyrics.clientHeight / 2 + current.clientHeight / 2, behavior: 'smooth' })
    }
  }

  function stopAtLimit() {
    audio.pause()
    try { audio.currentTime = 0 } catch (e) {}
    render()
  }

  btn.addEventListener('click', async () => {
    if (!audio.src) audio.src = preview.dataset.src
    if (!audio.paused) {
      audio.pause()
      return
    }
    if ((audio.currentTime || 0) >= limit) {
      try { audio.currentTime = 0 } catch (e) {}
    }
    try { await audio.play() } catch (e) { render() }
  })

  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) limit = Math.min(LIMIT, audio.duration)
    render()
  })
  audio.addEventListener('timeupdate', () => {
    if ((audio.currentTime || 0) >= limit) stopAtLimit()
    else render()
  })
  audio.addEventListener('play', render)
  audio.addEventListener('pause', render)
  audio.addEventListener('ended', render)

  render()
})()
