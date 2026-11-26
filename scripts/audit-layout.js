// Замеры вёрстки для дизайн-аудита. Грузится в открытое окно Кошеля:
//   await import('/audit-layout.js'); await window.__audit.all({...})
// Ничего не меняет в программе, только читает геометрию и стили.
(() => {
  const VIEWS = ['dashboard', 'transactions', 'accounts', 'categories', 'tasks', 'budget', 'goals', 'recurring',
    'reminders', 'debts', 'profile', 'znaki', 'forecast', 'calendar', 'year', 'advice', 'quotes', 'canvas', 'notes',
    'graph', 'import', 'settings']
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const R = (el) => el.getBoundingClientRect()
  const visible = (el) => {
    const r = R(el)
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05
  }
  const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
  // Путь до элемента: класс карточки + класс самого — чтобы найти глазами.
  const where = (el) => {
    const parts = []
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const c = (e.className && typeof e.className === 'string') ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
      parts.unshift(e.tagName.toLowerCase() + c)
      if (e.classList?.contains('card')) break
    }
    return parts.join(' > ')
  }
  const rect = (el) => { const r = R(el); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }

  function scan() {
    const root = document.querySelector('.main') || document.body
    const out = []
    const add = (kind, el, extra = {}) => out.push({ kind, where: where(el), text: txt(el), rect: rect(el), ...extra })
    const all = [...root.querySelectorAll('*')].filter(visible)
    const rootR = R(root)

    for (const el of all) {
      const s = getComputedStyle(el)
      // 1. Содержимое шире своего блока и обрезано (или вылезает).
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !['auto', 'scroll'].includes(s.overflowX)
        && !el.closest('svg') && !el.matches('input,textarea,select,.sr-only,.znak .seat')) {
        const clipped = s.overflowX === 'hidden' || s.overflowX === 'clip'
        const ell = s.textOverflow === 'ellipsis'
        add(ell ? 'многоточие' : clipped ? 'обрезано' : 'вылезает', el, { over: el.scrollWidth - el.clientWidth })
      }
      // 2. Ребёнок карточки за её краем.
      if (el.classList.contains('card')) {
        const cr = R(el)
        for (const ch of el.querySelectorAll('*')) {
          if (!visible(ch) || ch.closest('svg') || ch.closest('.fx-glare') !== el.closest('.fx-glare')) continue
          const r = R(ch)
          if (r.right > cr.right + 1.5 || r.left < cr.left - 1.5) {
            if (getComputedStyle(ch).position === 'absolute') continue
            add('за краем карточки', ch, { card: where(el), by: Math.round(Math.max(r.right - cr.right, cr.left - r.left)) })
            break
          }
        }
      }
      // 3. Блок за правым краем рабочей области.
      const r = R(el)
      if (r.right > rootR.right + 1 && r.width < rootR.width && s.position !== 'fixed' && !el.closest('.cv-world,.canvas-world,.canvas-layer,svg')) {
        const p = el.parentElement && R(el.parentElement)
        if (!p || p.right <= rootR.right + 1) add('за краем окна', el, { by: Math.round(r.right - rootR.right) })
      }
    }

    // 4. Ряды «подпись над числом»: в одном ряду подписи переносятся по-разному.
    const rows = new Set()
    for (const el of all) {
      const s = getComputedStyle(el)
      if ((s.display === 'flex' && !s.flexDirection.startsWith('column')) || s.display === 'grid') {
        const kids = [...el.children].filter(visible)
        if (kids.length >= 2 && kids.length <= 6) rows.add(el)
      }
    }
    for (const row of rows) {
      const kids = [...row.children].filter(visible)
      // берём первую строку текста каждого ребёнка (подпись) и проверяем перенос
      const labels = kids.map((k) => {
        const first = [...k.querySelectorAll('*')].find((d) => d.children.length === 0 && txt(d) && visible(d)) || (k.children.length === 0 ? k : null)
        if (!first) return null
        const st = getComputedStyle(first)
        const lh = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.5
        return { el: first, lines: Math.round(R(first).height / lh), fs: parseFloat(st.fontSize), top: R(first).top }
      })
      if (labels.some((l) => !l)) continue
      const sameFs = labels.every((l) => l.fs === labels[0].fs)
      const sameTop = labels.every((l) => Math.abs(l.top - labels[0].top) < 2)
      if (sameFs && sameTop && kids.every((k) => R(k).width < 400)) {
        const lines = labels.map((l) => l.lines)
        if (Math.max(...lines) > 1 && Math.min(...lines) === 1) {
          add('разный перенос подписей в ряду', row, { lines })
          // и где после этого оказались крупные числа
          const big = kids.map((k) => [...k.querySelectorAll('*')].filter((d) => d.children.length === 0 && visible(d) && parseFloat(getComputedStyle(d).fontSize) >= 18)[0])
          if (big.every(Boolean)) {
            const tops = big.map((b) => Math.round(R(b).top))
            if (Math.max(...tops) - Math.min(...tops) > 2) add('числа не на одной линии', row, { tops })
          }
        }
      }
    }

    // 5. Мелкие зоны клика.
    for (const el of root.querySelectorAll('button, a[href], [role=button], input[type=checkbox], input[type=radio]')) {
      if (!visible(el)) continue
      const r = R(el)
      if (r.width < 24 || r.height < 24) add('мелкая зона клика', el, { size: [Math.round(r.width), Math.round(r.height)] })
    }

    // 6. Системные поля — вид диктует ОС, не наш дизайн.
    for (const el of root.querySelectorAll('select, input[type=time], input[type=date], input[type=month], input[type=datetime-local], input[type=number], input[type=color], input[type=range], input[type=checkbox], input[type=radio], input[type=file]')) {
      if (!visible(el)) continue
      add('системное поле', el, { type: el.tagName === 'SELECT' ? 'select' : el.type, appearance: getComputedStyle(el).appearance })
    }

    // 7. Размеры шрифта в ходу.
    const fs = {}
    for (const el of all) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      const f = getComputedStyle(el).fontSize
      fs[f] = (fs[f] || 0) + 1
    }
    return { issues: out, fontSizes: fs }
  }

  async function open(i) {
    const items = document.querySelectorAll('.sidebar .nav-item')
    items[i]?.click()
    await sleep(150)
    // Прогон открывает раздел за разделом: лишние вкладки закрываем,
    // иначе полоса вкладок растёт и мешает замерам.
    for (let k = 0; k < 40; k++) {
      const x = document.querySelector('.tabbar .tab:not(.active) .close')
      if (!x) break
      x.click()
      await sleep(20)
    }
    await sleep(600)
  }

  /** Ширина букв: 0 — как есть (Windows), 0.03em ≈ SF Pro на Маке, 0.06em — запас. */
  function track(em) {
    let st = document.getElementById('audit-track')
    if (!st) { st = document.createElement('style'); st.id = 'audit-track'; document.head.appendChild(st) }
    st.textContent = em ? `body, body * { letter-spacing: ${em}em !important; }` : ''
  }

  /** Сжатая сводка по одному прогону: тип → вид → [{где, текст, на сколько}] */
  function compact(res) {
    const o = {}
    for (const [v, r] of Object.entries(res)) for (const i of r.issues) {
      if (i.kind === 'мелкая зона клика' || i.kind === 'системное поле') continue
      if (i.where.includes('tabbar')) continue
      if (Math.abs(i.by ?? i.over ?? 99) <= 4 && (i.kind === 'вылезает')) continue
      const key = i.kind + ' | ' + v + ' | ' + i.where.split(' > ').slice(-2).join(' > ') + ' | ' + i.text.slice(0, 32)
      o[key] = Math.max(o[key] || 0, i.by ?? i.over ?? (i.lines ? i.lines.join('/') : i.tops ? Math.max(...i.tops) - Math.min(...i.tops) : 1))
    }
    return o
  }

  async function all({ views = VIEWS } = {}) {
    const res = {}
    for (const v of views) {
      const i = VIEWS.indexOf(v)
      await open(i)
      // докрутить вниз и обратно — ленивые блоки дорисуются
      const sc = document.querySelector('.main .view, .main [class*=scroll], .main')
      res[v] = scan()
    }
    return res
  }

  // Сжатая сводка: тип → [вид: число]
  function summary(res) {
    const s = {}
    for (const [v, r] of Object.entries(res)) for (const i of r.issues) {
      s[i.kind] ??= {}
      s[i.kind][v] = (s[i.kind][v] || 0) + 1
    }
    return s
  }

  window.__audit = { VIEWS, scan, open, all, summary, track, compact }
})()
