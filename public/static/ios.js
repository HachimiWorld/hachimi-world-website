// iOS guide (/ios/, /en/ios/): point the download button straight at the latest IPA.
// Without the API (or the snapshot in fallback.js) the button keeps linking to the download section.
(() => {
  const API = 'https://api.hachimi.world'
  const btn = document.getElementById('ipa-dl')
  if (!btn) return

  async function latestIpa() {
    try {
      const r = await fetch(`${API}/version/latest_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: ['release-ios'] }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error('api error')
      return d.data[0]
    } catch {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = '/static/fallback.js'
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
      return window.HW_FALLBACK.versions.find(v => v.variant === 'release-ios')
    }
  }

  latestIpa().then(v => {
    if (!v?.url) return
    btn.href = v.url
    const ver = String(v.version_name || '').split('-')[0]
    if (ver) btn.querySelector('span').textContent += ` · v${ver}`
  }).catch(() => {})
})()
