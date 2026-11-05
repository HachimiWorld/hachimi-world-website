// /account/revert-email?token=<token>: puts the old email back on the account and sets a new password.
(() => {
  const API = 'https://api.hachimi.world'
  const MIN_PASSWORD = 8 // The server's minimum
  const LANG = (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'

  const T = {
    zh: {
      tooShort: `密码至少要 ${MIN_PASSWORD} 位`,
      notMatch: '两次输入的密码不一样',
      submitting: '正在提交…',
      oldEmailTaken: '原来的邮箱已被其他账号使用，请联系我们',
      failed: '提交失败，请稍后重试',
    },
    en: {
      title: 'Change back to your email',
      label: 'Account security',
      intro: 'This puts the email that got this message back on the account, and cancels a change that is still waiting. Whoever changed it may know your password, so set a new one. Every device will be logged out.',
      password: 'New password',
      repeat: 'New password again',
      submit: 'Change back and set the password',
      doneTitle: 'Changed back',
      doneText: 'Your account email is back, and every device has been logged out. Log in again with your new password.',
      openApp: 'Open the web app to log in',
      invalidTitle: 'Invalid link',
      invalidText: 'This link is invalid, used or expired. If something is still wrong with your account, please contact us.',
      home: 'Back to home',
      web: 'Web app',
      tooShort: `Use at least ${MIN_PASSWORD} characters`,
      notMatch: "The passwords don't match",
      submitting: 'Submitting…',
      oldEmailTaken: 'Your email is used by another account now. Please contact us',
      failed: 'Something went wrong. Please try again later',
    },
  }
  const t = key => T[LANG][key] ?? T.zh[key]

  if (LANG === 'en') {
    document.documentElement.lang = 'en'
    document.title = 'Hachimi World · ' + t('title')
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const text = T.en[el.dataset.i18n]
      if (text) el.textContent = text
    })
  }

  const show = state => {
    document.querySelectorAll('[data-state]').forEach(el => { el.hidden = el.dataset.state !== state })
  }

  const token = new URLSearchParams(location.search).get('token')?.trim()
  if (!token) {
    show('invalid')
    return
  }
  const form = document.getElementById('form')
  const password = document.getElementById('password')
  const repeat = document.getElementById('repeat')
  const error = document.getElementById('error')
  const submit = document.getElementById('submit')

  const setError = text => {
    error.textContent = text || ''
    error.hidden = !text
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    if (password.value.length < MIN_PASSWORD) return setError(t('tooShort'))
    if (password.value !== repeat.value) return setError(t('notMatch'))
    setError(null)

    const label = submit.textContent
    submit.disabled = true
    submit.textContent = t('submitting')
    try {
      const r = await fetch(`${API}/auth/email/revert_change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password.value }),
      })
      const d = await r.json()
      if (d.ok) {
        show('done')
      } else if (d.data?.code === 'invalid_token') {
        show('invalid')
      } else if (d.data?.code === 'old_email_taken') {
        setError(t('oldEmailTaken'))
      } else if (d.data?.code === 'invalid_password') {
        setError(t('tooShort'))
      } else {
        setError(t('failed'))
      }
    } catch {
      setError(t('failed'))
    } finally {
      submit.disabled = false
      submit.textContent = label
    }
  })
})()
