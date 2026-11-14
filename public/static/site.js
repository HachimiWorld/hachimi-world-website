// Homepage behaviour for / and /en/: weekly chart, cover wall, downloads, screenshot slides.
(() => {
  const API = 'https://api.hachimi.world'
  const WEB_APP = 'https://app.hachimi.world'
  const LANG = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'

  const T = {
    zh: {
      no1: '本周 No.1',
      coverAlt: title => `${title} 封面`,
      currentOs: name => `当前系统 · ${name}`,
      appFor: name => `基米天堂 for ${name}`,
      downloadVer: v => `下载 ${v}`,
      heroDownload: name => `下载 ${name} 版`,
      otherPlatforms: '其他平台',
      released: date => `${date} 发布`,
      changes: v => `${v} 更新内容`,
      copy: '复制',
      copied: '已复制',
      noInstall: '无需安装',
      iosHint: 'iOS 安装包需自签名',
      web: '网页版',
      openWeb: '打开网页版',
      webNote: '实验性 · 无需安装',
      harmonyNote: '开发中',
      macTitle: '首次打开',
      macText: '安装包未经 Apple 公证，首次打开时系统可能提示应用已损坏。将应用拖入“应用程序”文件夹后，在终端执行以下命令即可。',
      iosTitle: '安装方式',
      iosText: '安装包未经签名，需用自己的 Apple ID 签名后安装。免费账号签名的应用有效期为 7 天，到期后重新签名即可。',
      iosGuide: 'iOS 安装教程',
      iosGuideHref: '/ios/',
      notes: {
        windows: 'Windows 10 及以上 · MSI',
        macos: '仅 Apple Silicon（M 系列）',
        linux: 'Ubuntu / Debian · DEB',
        android: 'Android 9 及以上 · APK',
        ios: 'IPA，需要自签名安装',
      },
      locale: 'zh-CN',
    },
    en: {
      no1: 'No.1 this week',
      coverAlt: title => `Cover of ${title}`,
      currentOs: name => `Your system · ${name}`,
      appFor: name => `Hachimi World for ${name}`,
      downloadVer: v => `Download ${v}`,
      heroDownload: name => `Download for ${name}`,
      otherPlatforms: 'Other platforms',
      released: date => `Released ${date}`,
      changes: v => `What's new in ${v}`,
      copy: 'Copy',
      copied: 'Copied',
      noInstall: 'No installation needed',
      iosHint: 'The iOS package requires self-signing',
      web: 'Web',
      openWeb: 'Open the web app',
      webNote: 'Experimental · No installation',
      harmonyNote: 'In development',
      macTitle: 'First launch',
      macText: 'The app is not notarized by Apple, so macOS may report it as damaged on first launch. After moving it to Applications, run this command in Terminal.',
      iosTitle: 'Installing',
      iosText: 'The package is unsigned. Sign it with your own Apple ID to install it. Apps signed with a free Apple ID expire after 7 days; sign again to keep using it.',
      iosGuide: 'iOS installation guide',
      iosGuideHref: '/en/ios/',
      notes: {
        windows: 'Windows 10 or later · MSI',
        macos: 'Apple Silicon (M-series) only',
        linux: 'Ubuntu / Debian · DEB',
        android: 'Android 9 or later · APK',
        ios: 'IPA, requires self-signing',
      },
      locale: 'en-US',
    },
  }[LANG]

  const PLATFORMS = [
    { key: 'windows', name: 'Windows', icon: 'fab fa-windows' },
    { key: 'macos', name: 'macOS', icon: 'fab fa-apple' },
    { key: 'linux', name: 'Linux', icon: 'fab fa-linux' },
    { key: 'android', name: 'Android', icon: 'fab fa-android' },
    { key: 'ios', name: 'iOS', icon: 'fab fa-apple' },
  ]

  const SONG_PAGE = id => `/song/${encodeURIComponent(String(id).toLowerCase())}`
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const shortVer = v => String(v || '').split('-')[0]
  const fmtCount = n => {
    if (LANG === 'zh') return n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + ' 万' : String(n)
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n)
  }

  /* ---------- data ---------- */
  async function getJSON(url, init) {
    const r = await fetch(url, init)
    const d = await r.json()
    if (!d.ok) throw new Error('api error')
    return d.data
  }

  let fallback
  function loadFallback() {
    fallback ??= new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = '/static/fallback.js'
      s.onload = () => resolve(window.HW_FALLBACK)
      s.onerror = reject
      document.head.appendChild(s)
    })
    return fallback
  }

  async function loadSongs() {
    try {
      const data = await getJSON(`${API}/song/hot/weekly`)
      return data.songs.map(s => ({ ...s, tags: s.tags.map(t => t.name) }))
    } catch {
      return (await loadFallback()).hot
    }
  }

  async function loadVersions() {
    try {
      return await getJSON(`${API}/version/latest_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: PLATFORMS.map(p => 'release-' + p.key) }),
      })
    } catch {
      return (await loadFallback()).versions
    }
  }

  function detectPlatform() {
    const ua = navigator.userAgent
    if (/Android/i.test(ua)) return 'android'
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
    if (/Mac/i.test(ua)) return 'macos'
    if (/Win/i.test(ua)) return 'windows'
    if (/Linux|X11/i.test(ua)) return 'linux'
    return 'web'
  }

  // Changelog lines look like "1. Support following users. 支持关注用户。"; items of every section, shown as written.
  function parseChanges(changelog) {
    const out = []
    for (const line of String(changelog || '').split('\n')) {
      if (!/^\d+\./.test(line)) continue
      const text = line.replace(/^\d+\.\s*/, '').trim()
      if (text) out.push(text)
    }
    return out.slice(0, 4)
  }

  /* ---------- render ---------- */
  function renderWall(songs) {
    const pool = songs.filter(s => s.cover_url).slice(0, 18)
    const cols = [[], [], []]
    pool.forEach((s, i) => cols[i % 3].push(s))
    document.getElementById('wall').innerHTML = cols.map(col => {
      const items = col.map(s => `<a href="${SONG_PAGE(s.display_id)}" tabindex="-1"><img src="${esc(s.cover_url)}" alt="" decoding="async"></a>`).join('')
      return `<div class="wall-col">${items}${items}</div>`
    }).join('')
  }

  function renderNow(song) {
    const el = document.getElementById('now')
    el.href = SONG_PAGE(song.display_id)
    el.innerHTML = `
      <img src="${esc(song.cover_url)}" alt="">
      <div class="now-meta">
        <div class="now-tag">${T.no1}</div>
        <div class="now-title">${esc(song.title)}</div>
        <div class="now-by">${esc(song.uploader_name)}</div>
      </div>
      <div class="now-plays"><i class="fas fa-headphones"></i> ${fmtCount(song.play_count)}</div>`
  }

  function renderChart(songs) {
    const [first, ...rest] = songs.slice(0, 10)
    const top1 = document.getElementById('top1')
    top1.href = SONG_PAGE(first.display_id)
    top1.innerHTML = `
      <div class="top1-cover">
        <img src="${esc(first.cover_url)}" alt="${esc(T.coverAlt(first.title))}" loading="lazy">
        <div class="top1-rank">01</div>
      </div>
      <div class="top1-body">
        <div class="top1-title">${esc(first.title)}</div>
        <div class="top1-by">${esc(first.uploader_name)}</div>
        ${first.tags.length ? `<div class="tags">${first.tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="stats"><span><i class="fas fa-headphones"></i>${fmtCount(first.play_count)}</span><span><i class="fas fa-heart"></i>${fmtCount(first.like_count)}</span></div>
      </div>`

    document.getElementById('list').innerHTML = rest.map((s, i) => `
      <li><a class="row" href="${SONG_PAGE(s.display_id)}">
        <div class="rank">${String(i + 2).padStart(2, '0')}</div>
        <img src="${esc(s.cover_url)}" alt="" loading="lazy">
        <div class="row-main">
          <div class="row-title">${esc(s.title)}</div>
          <div class="row-by">${esc(s.uploader_name)}${s.tags[0] ? `<span class="tag">${esc(s.tags[0])}</span>` : ''}</div>
        </div>
        <div class="row-plays"><i class="fas fa-headphones"></i> ${fmtCount(s.play_count)}</div>
      </a></li>`).join('')
  }

  function renderGenres() {
    const a = ['叮咚鸡', '纯净哈基米', '活全家', '审判曲', '原曲不使用', '大狗叫', '术力口', '古典', '电棍', '新世纪福音战士', '音游曲', '冰！']
    const b = ['游戏音乐', '农场主', '硬核', 'J-Pop', '情歌', '前卫摇滚', 'FutureBass', '泰拉瑞亚', 'DJ', '说唱', 'Ambient', '史诗']
    const chips = (list, offset) => list.map((t, i) => {
      const k = (i + offset) % 6
      return `<span class="chip${k === 0 ? ' hot' : k === 3 ? ' ink' : ''}">#${esc(t)}</span>`
    }).join('')
    // Each track holds the list twice so the -50% slide loops seamlessly.
    document.getElementById('mq1').innerHTML = chips(a, 0) + chips(a, 0)
    document.getElementById('mq2').innerHTML = chips(b, 2) + chips(b, 2)
  }

  // SHA-256 of the package, shortened, with a button that copies all of it. Older versions have none.
  function checksum(sha256) {
    if (!sha256) return ''
    return `<div class="sum"><span>SHA-256</span>
      <code title="${esc(sha256)}">${esc(sha256.slice(0, 8))}…${esc(sha256.slice(-8))}</code>
      <button type="button" data-copy="${esc(sha256)}">${T.copy}</button></div>`
  }

  // The DMG is not notarized and the IPA is unsigned, so both need a step after downloading.
  // The installed bundle is "Hachimi World.app" (checked on a 1.7.0 release build), despite macOS packageName = "基米天堂".
  const MAC_CMD = 'xattr -dr com.apple.quarantine "/Applications/Hachimi World.app"'
  function installNote(key) {
    if (key === 'macos') return `<div class="install"><b>${T.macTitle}</b><p>${T.macText}</p>
      <div class="cmd"><code>${esc(MAC_CMD)}</code><button type="button" data-copy="${esc(MAC_CMD)}">${T.copy}</button></div></div>`
    if (key === 'ios') return `<div class="install"><b>${T.iosTitle}</b><p>${T.iosText}</p>
      <a class="guide-link" href="${T.iosGuideHref}">${T.iosGuide} <i class="fas fa-arrow-right"></i></a></div>`
    return ''
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]')
    if (!btn) return
    try {
      await navigator.clipboard.writeText(btn.dataset.copy)
    } catch {
      return
    }
    btn.textContent = T.copied
    setTimeout(() => { btn.textContent = T.copy }, 1500)
  })

  function renderDownloads(versions) {
    const byKey = Object.fromEntries(versions.map(v => [v.variant.replace('release-', ''), v]))
    const detected = detectPlatform()
    // The iOS build needs self-signing, so iPhone/iPad visitors are pointed at the web app first.
    const startKey = (detected === 'ios' || detected === 'web' || !byKey[detected]) ? 'web' : detected
    const main = document.getElementById('dl-main')
    const list = document.getElementById('platforms')

    // The hero button always points at the visitor's own system
    if (startKey !== 'web') {
      const p = PLATFORMS.find(p => p.key === startKey)
      const v = byKey[startKey]
      const heroBtn = document.getElementById('hero-dl')
      heroBtn.href = v.url
      heroBtn.querySelector('span').textContent = T.heroDownload(p.name)
      document.getElementById('hero-note').innerHTML = `v${esc(shortVer(v.version_name))} · <a href="#download">${T.otherPlatforms}</a>`
    }

    // The card on the left shows the platform picked in the list, starting with the visitor's own
    function renderMain(key) {
      const latest = byKey[key] || byKey.windows
      const changes = parseChanges(latest?.changelog)
      const changesHtml = changes.length ? `
        <div class="changes"><b>${esc(T.changes(shortVer(latest.version_name)))}</b>
          <ul>${changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''

      if (key === 'web') {
        main.innerHTML = `
          <div class="os"><i class="fas fa-globe"></i><span>${detected === 'ios' ? T.iosHint : T.noInstall}</span></div>
          <h3>${T.web}</h3>
          <a class="btn btn-accent" href="${WEB_APP}"><i class="fas fa-arrow-up-right-from-square"></i> ${T.openWeb}</a>
          ${detected === 'ios' ? `<a class="guide-link" href="${T.iosGuideHref}">${T.iosGuide} <i class="fas fa-arrow-right"></i></a>` : ''}
          ${changesHtml}`
        return
      }
      const p = PLATFORMS.find(p => p.key === key)
      const v = byKey[key]
      const date = new Date(v.release_time).toLocaleDateString(T.locale, { year: 'numeric', month: 'long', day: 'numeric' })
      main.innerHTML = `
        <div class="os"><i class="${p.icon}"></i><span>${esc(key === detected ? T.currentOs(p.name) : p.name)}</span></div>
        <h3>${esc(T.appFor(p.name))}</h3>
        <a class="btn btn-accent" href="${esc(v.url)}"><i class="fas fa-download"></i> ${esc(T.downloadVer(shortVer(v.version_name)))}</a>
        <div class="ver" title="${esc(v.version_name)}">${esc(T.notes[p.key])} · ${esc(T.released(date))}</div>
        ${checksum(v.sha256)}
        ${installNote(key)}
        ${changesHtml}`
    }

    function select(key) {
      renderMain(key)
      list.querySelectorAll('.row').forEach(row => {
        const on = row.dataset.key === key
        row.classList.toggle('current', on)
        row.setAttribute('aria-pressed', String(on))
      })
    }

    // A row picks the platform; the icon at its end downloads straight away
    const row = (key, icon, name, note, version, href, goIcon, goLabel) => `
      <li><div class="row" role="button" tabindex="0" aria-pressed="false" data-key="${key}">
        <i class="p ${icon}"></i>
        <div><div class="name">${name}</div><div class="note">${note}</div></div>
        ${version}
        <a class="go" href="${esc(href)}" title="${esc(goLabel)}" aria-label="${esc(goLabel)}"><i class="${goIcon}"></i></a></div></li>`

    list.innerHTML = PLATFORMS.filter(p => byKey[p.key]).map(p => {
      const v = byKey[p.key]
      return row(p.key, p.icon, p.name, esc(T.notes[p.key]),
        `<span class="v" title="${esc(v.version_name)}">${esc(shortVer(v.version_name))}</span>`,
        v.url, 'fas fa-download', `${p.name} · ${T.downloadVer(shortVer(v.version_name))}`)
    }).join('') +
      row('web', 'fas fa-globe', T.web, T.webNote, '<span class="v url">app.hachimi.world</span>',
        WEB_APP, 'fas fa-arrow-up-right-from-square', T.openWeb) + `
      <li><div class="soon">
        <i class="p fas fa-mobile-screen"></i>
        <div><div class="name">HarmonyOS</div><div class="note">${T.harmonyNote}</div></div>
        <span class="v">—</span><span></span></div></li>`

    function pick(target) {
      const r = target.closest('.row')
      if (!r) return
      select(r.dataset.key)
      // On narrow screens the card is above the list, out of sight
      const top = main.getBoundingClientRect().top
      if (top < 0 || top > window.innerHeight * 0.6) main.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    list.addEventListener('click', e => {
      if (e.target.closest('a.go')) return
      pick(e.target)
    })
    list.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('row')) {
        e.preventDefault()
        pick(e.target)
      }
    })

    select(startKey)
  }

  // Screenshot slides in the apps section. The active tab's progress line is a CSS animation;
  // when it ends we advance, so hover/offscreen pausing and reduced motion need no timer logic.
  function initShots() {
    const root = document.getElementById('shots')
    if (!root) return
    const tabs = [...root.querySelectorAll('.shot-tab')]
    const show = i => {
      root.dataset.shot = i
      tabs.forEach((tab, k) => {
        tab.setAttribute('aria-selected', String(k === i))
        const bar = tab.querySelector('i')
        bar.style.animation = 'none'
        void bar.offsetWidth // restart the progress animation
        bar.style.animation = ''
      })
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => show(i))
      tab.querySelector('i').addEventListener('animationend', () => show((i + 1) % tabs.length))
    })
    new IntersectionObserver(([e]) => root.classList.toggle('offscreen', !e.isIntersecting)).observe(root)
    // Start on the slide matching the page theme (0 = light, 1 = dark).
    show(document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0)
  }

  initShots()
  renderGenres()
  loadSongs().then(songs => {
    if (!songs?.length) return
    renderWall(songs)
    renderNow(songs[0])
    renderChart(songs)
  })
  loadVersions().then(renderDownloads)
})()
