// Server-side rendering for song share pages (/song/<JM-ID>).
// Only /song/* reaches this script (see run_worker_first in wrangler.jsonc); everything else
// is served straight from static assets.

const API = 'https://api.hachimi.world'
const SITE = 'https://hachimi.world'
const WEB_APP = 'https://app.hachimi.world'
const DEFAULT_IMAGE = `${SITE}/static/og-image.jpg`
const ID_PATTERN = /^JM-[A-Z0-9]+-\d+$/

const CREATION_TYPES = ['原创', '二创', '三创']
const PLATFORMS = { bilibili: '哔哩哔哩', douyin: '抖音', youtube: 'YouTube', netease: '网易云音乐', qqmusic: 'QQ 音乐', niconico: 'niconico' }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/song/')) return renderSong(env, url)
    return env.ASSETS.fetch(request)
  },
}

async function renderSong(env, url) {
  const segment = decodeURIComponent(url.pathname.slice('/song/'.length).split('/')[0] || '')
  const queryId = url.searchParams.get('id')
  const id = (segment || queryId || '').trim().toUpperCase()

  // Old share links used /song/?id=JM-...; give them the canonical path.
  if (!segment && queryId && ID_PATTERN.test(id)) {
    return Response.redirect(`${url.origin}/song/${id}`, 301)
  }

  let state = 'missing'
  let song = null
  if (ID_PATTERN.test(id)) {
    try {
      const resp = await fetch(`${API}/song/detail?id=${encodeURIComponent(id)}`, {
        cf: { cacheTtl: 300, cacheEverything: true },
      })
      const body = await resp.json()
      if (body.ok) {
        song = body.data
        state = 'ok'
      } else {
        state = body.data?.code === 'not_found' ? 'missing' : 'error'
      }
    } catch {
      state = 'error'
    }
  }

  const template = await env.ASSETS.fetch(new URL('/song/template', url))
  const rewriter = state === 'ok' ? songRewriter(song) : emptyRewriter(state)
  rewriter.on('[data-show]', {
    element(el) {
      if (el.getAttribute('data-show') !== state) el.remove()
      else el.removeAttribute('data-show')
    },
  })

  const res = rewriter.transform(template)
  const status = state === 'ok' ? 200 : state === 'missing' ? 404 : 502
  return new Response(res.body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': state === 'error' ? 'no-store' : 'public, max-age=60',
    },
  })
}

/* ---------- rewriters ---------- */

function emptyRewriter(state) {
  const title = state === 'missing' ? '没有找到这首歌 · 基米天堂' : '暂时无法加载 · 基米天堂'
  return new HTMLRewriter()
    .on('title', text(title))
    .on('meta[name="robots"]', attr('content', 'noindex'))
    .on('meta[property="og:title"], meta[name="twitter:title"]', attr('content', title))
    .on('[data-bind="jsonld"]', { element: el => el.remove() })
}

function songRewriter(song) {
  const canonical = `${SITE}/song/${song.display_id}`
  const title = [song.title, song.uploader_name, '基米天堂'].filter(Boolean).join(' · ')
  const description = describe(song)
  const image = song.cover_url || DEFAULT_IMAGE
  const lyrics = parseLyrics(song.lyrics)

  return new HTMLRewriter()
    .on('title', text(title))
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', attr('content', description))
    .on('meta[property="og:title"], meta[name="twitter:title"]', attr('content', title))
    .on('meta[property="og:image"], meta[name="twitter:image"]', attr('content', image))
    .on('meta[property="og:url"]', attr('content', canonical))
    .on('link[rel="canonical"]', attr('href', canonical))
    .on('[data-bind="jsonld"]', html(JSON.stringify(jsonLd(song, canonical, description)).replace(/</g, '\\u003c')))
    .on('[data-bind="backdrop"]', attr('src', image))
    .on('[data-bind="cover"]', {
      element(el) {
        el.setAttribute('src', image)
        el.setAttribute('alt', `${song.title} 封面`)
      },
    })
    .on('[data-bind="jmid"]', text(song.display_id))
    .on('[data-bind="title"]', text(song.title || '未命名'))
    .on('[data-bind="subtitle"]', song.subtitle ? text(song.subtitle) : remove())
    .on('[data-bind="uploader"]', text(song.uploader_name || ''))
    .on('[data-bind="tags"]', song.tags?.length ? html(song.tags.map(t => `<span class="tag">${esc(t.name)}</span>`).join('')) : remove())
    .on('[data-bind="stats"]', html(stats(song)))
    .on('[data-bind="preview"]', song.audio_url ? {
      element(el) {
        el.setAttribute('data-src', song.audio_url)
        el.setAttribute('data-duration', String(song.duration_seconds || 0))
      },
    } : remove())
    .on('[data-bind="preview-note"]', song.audio_url ? {} : remove())
    .on('[data-bind="web-link"]', attr('href', `${WEB_APP}/#/song/${song.display_id}`))
    .on('[data-bind="lyrics"]', {
      element(el) {
        if (!lyrics.length) {
          el.setInnerContent('<p class="lyrics-empty">暂无歌词</p>', { html: true })
          return
        }
        if (lyrics.some(l => l.t != null)) el.setAttribute('data-synced', '')
        el.setInnerContent(lyrics.map(l => l.t != null ? `<p data-t="${l.t}">${esc(l.text)}</p>` : `<p>${esc(l.text)}</p>`).join(''), { html: true })
      },
    })
    .on('[data-bind="details"]', html(details(song)))
}

/* ---------- content ---------- */

function stats(song) {
  const items = [
    `<span><i class="fas fa-headphones"></i>${song.play_count ?? 0}</span>`,
    `<span><i class="fas fa-heart"></i>${song.like_count ?? 0}</span>`,
  ]
  if (song.duration_seconds) items.push(`<span><i class="far fa-clock"></i>${fmtDuration(song.duration_seconds)}</span>`)
  const date = fmtDate(song.release_time || song.create_time)
  if (date) items.push(`<span>${date}</span>`)
  return items.join('')
}

function details(song) {
  const blocks = []
  const creation = CREATION_TYPES[song.creation_type]
  if (creation) blocks.push(detail('创作类型', esc(creation)))

  for (const [type, label] of [[0, '原曲'], [1, '改编自']]) {
    const items = (song.origin_infos || []).filter(o => o.origin_type === type)
    if (items.length) blocks.push(detail(label, items.map(origin).join('<br>')))
  }

  const crew = groupCrew(song.production_crew)
  if (crew.length) blocks.push(detail('制作人员', crew.map(([role, names]) => `<span class="muted">${esc(role)}</span> ${esc(names.join('、'))}`).join('<br>')))

  const links = (song.external_links || []).filter(l => /^https?:\/\//.test(l.url || ''))
  if (links.length) {
    blocks.push(detail('外部链接', `<div class="detail-links">${links.map(l =>
      `<a class="btn btn-ghost btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(PLATFORMS[l.platform] || l.platform)} <i class="fas fa-arrow-up-right-from-square"></i></a>`).join('')}</div>`))
  }

  if (song.description) blocks.push(detail('简介', esc(song.description).replace(/\n/g, '<br>')))
  return blocks.join('')
}

const detail = (label, body) => `<div class="detail"><h2 class="song-h">${label}</h2><div class="detail-body">${body}</div></div>`

function origin(o) {
  const name = esc(o.title || o.song_display_id || '未知')
  const artist = o.artist ? ` <span class="muted">— ${esc(o.artist)}</span>` : ''
  if (o.song_display_id) return `<a href="/song/${esc(o.song_display_id)}">${name}</a>${artist}`
  if (/^https?:\/\//.test(o.url || '')) return `<a href="${esc(o.url)}" target="_blank" rel="noopener">${name}</a>${artist}`
  return name + artist
}

function groupCrew(crew) {
  const byRole = new Map()
  for (const c of crew || []) {
    if (!c.person_name) continue
    const names = byRole.get(c.role) || []
    if (!names.includes(c.person_name)) names.push(c.person_name)
    byRole.set(c.role, names)
  }
  return [...byRole]
}

// LRC → [{ t?: seconds, text }]. Metadata tags like [ti:] are dropped; plain-text lyrics pass through.
function parseLyrics(raw) {
  const out = []
  for (const line of String(raw || '').split(/\r?\n/)) {
    const times = [...line.matchAll(/\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/g)]
    const textPart = line.replace(/\[[^\]]*\]/g, '').trim()
    if (!times.length) {
      if (/^\s*\[[a-z]+:/i.test(line)) continue
      if (textPart) out.push({ text: textPart })
      continue
    }
    if (!textPart) continue
    for (const m of times) out.push({ t: Math.round((+m[1] * 60 + +m[2]) * 100) / 100, text: textPart })
  }
  if (out.some(l => l.t != null)) out.sort((a, b) => (a.t ?? 0) - (b.t ?? 0))
  return out
}

// e.g. 《R&B哈基米：基基哈哈》，無顏祖本人的哈基米音乐作品。标签：R&B。原曲：方大同——《BB88》
function describe(song) {
  const parts = [
    `《${song.title}》，${song.uploader_name ? `${song.uploader_name}的` : ''}哈基米音乐作品`,
    song.tags?.length ? `标签：${song.tags.map(t => t.name).join('、')}` : null,
    [song.subtitle, song.description].filter(Boolean).join(' / ') || parseLyrics(song.lyrics).map(l => l.text).join(' '),
  ]
  const full = parts.filter(Boolean).join('。').replace(/\s+/g, ' ').trim()
  return full.length > 160 ? full.slice(0, 159) + '…' : full
}

function jsonLd(song, canonical, description) {
  const original = (song.origin_infos || []).find(o => o.origin_type === 0)
  const minutes = Math.floor((song.duration_seconds || 0) / 60)
  const seconds = (song.duration_seconds || 0) % 60
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': canonical,
    url: canonical,
    name: song.title,
    alternateName: song.subtitle || undefined,
    description,
    image: song.cover_url || undefined,
    duration: song.duration_seconds ? `PT${minutes}M${seconds}S` : undefined,
    datePublished: song.release_time || undefined,
    genre: song.tags?.length ? song.tags.map(t => t.name) : undefined,
    byArtist: song.uploader_name ? { '@type': 'Person', name: song.uploader_name } : undefined,
    recordingOf: original ? { '@type': 'MusicComposition', name: original.title || undefined, composer: original.artist ? { '@type': 'Person', name: original.artist } : undefined } : undefined,
    interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ListenAction', userInteractionCount: song.play_count ?? 0 },
    isPartOf: { '@type': 'WebSite', name: '基米天堂', url: SITE },
  }
}

/* ---------- helpers ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtDuration = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
// Dates are shown in Beijing time (UTC+8), where most of the community is.
const fmtDate = iso => {
  const d = iso ? new Date(Date.parse(iso) + 8 * 3600e3) : null
  return d && !isNaN(d) ? `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日` : ''
}

const text = value => ({ element: el => el.setInnerContent(value) })
const html = value => ({ element: el => el.setInnerContent(value, { html: true }) })
const attr = (name, value) => ({ element: el => el.setAttribute(name, value) })
const remove = () => ({ element: el => el.remove() })
