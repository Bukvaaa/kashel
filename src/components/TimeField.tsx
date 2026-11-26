/*
 * Поле времени со своим списком — по образцу DateField.
 *
 * Вместо <input type="time">: его рисует система, и на Маке у друга он
 * показывал «09:04 AM», синий список Chromium и чужие часики, а вписать
 * время можно было только по сегментам. Здесь всегда 24 часа и пишется как
 * удобно: «930», «9:30», «0930», «21.45», «7» — Enter или уход из поля, и
 * время встаёт как 09:30. Непонятное («25:00») — откат к прежнему значению.
 * Стрелки ↑ ↓ — плюс-минус 5 минут. Список — шаг 15 минут.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../lib/icons'
import { т } from '../i18n'

const двѣ = (n: number) => String(n).padStart(2, '0')

/** Разбор вписанного времени. null — не понял. */
export function разобратьВремя(текстъ: string): string | null {
  const t = текстъ.trim().replace(/[.,\-\s]/g, ':')
  if (!t) return null
  let ч: number, м: number
  const сДвоеточиемъ = t.match(/^(\d{1,2}):(\d{1,2})$/)
  if (сДвоеточиемъ) {
    ч = Number(сДвоеточиемъ[1])
    м = Number(сДвоеточиемъ[2])
  } else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) [ч, м] = [Number(t), 0]
    else if (t.length === 3) [ч, м] = [Number(t[0]), Number(t.slice(1))]
    else [ч, м] = [Number(t.slice(0, 2)), Number(t.slice(2))]
  } else {
    return null
  }
  if (ч > 23 || м > 59) return null
  return двѣ(ч) + ':' + двѣ(м)
}

const ВСѢ = Array.from({ length: 96 }, (_, i) => двѣ(Math.floor(i / 4)) + ':' + двѣ((i % 4) * 15))

export function TimeField({
  value,
  onChange,
  onBlur,
  style,
  title,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  style?: React.CSSProperties
  title?: string
  ariaLabel?: string
}) {
  const [текстъ, setТекстъ] = useState(value)
  const [открытъ, setОткрытъ] = useState(false)
  const поле = useRef<HTMLDivElement>(null)
  const окно = useRef<HTMLDivElement>(null)
  const [мѣсто, setМѣсто] = useState<{ left: number; top: number; вверхъ: boolean } | null>(null)

  useEffect(() => {
    if (document.activeElement !== поле.current?.querySelector('input')) setТекстъ(value)
  }, [value])

  // Двоеточие закреплено: в поле вписываются только цифры, а «:» всегда стоит
  // после часов и не стирается. Курсор после правки ставим туда, где он был
  // по счёту цифр, — иначе React уводил бы его в конец поля.
  const ввод = useRef<HTMLInputElement>(null)
  const курсоръ = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (курсоръ.current === null || !ввод.current) return
    ввод.current.setSelectionRange(курсоръ.current, курсоръ.current)
    курсоръ.current = null
  })

  const вписать = (сырой: string, гдѣ: number) => {
    let цифры = сырой.replace(/\D/g, '')
    let доКурсора = сырой.slice(0, гдѣ).replace(/\D/g, '').length
    // Вписали поверх полного времени — цифра заменяет следующую, а не сдвигает.
    if (цифры.length > 4) цифры = цифры.slice(0, доКурсора) + цифры.slice(доКурсора + 1)
    цифры = цифры.slice(0, 4)
    // «9» — это 09: часов больше 23 не бывает, ноль дописываем сразу.
    if (/^[3-9]/.test(цифры)) {
      цифры = ('0' + цифры).slice(0, 4)
      if (доКурсора > 0) доКурсора++
    }
    доКурсора = Math.min(доКурсора, цифры.length)
    курсоръ.current = доКурсора >= 2 ? доКурсора + 1 : доКурсора
    setТекстъ(цифры ? цифры.slice(0, 2) + ':' + цифры.slice(2) : '')
  }

  const принять = () => {
    const [ч, м] = текстъ.split(':')
    const в = ч ? разобратьВремя(ч + ':' + (м || '0')) : null
    if (в) {
      if (в !== value) onChange(в)
      setТекстъ(в)
    } else {
      setТекстъ(value)
    }
  }

  const сдвинуть = (на: number) => {
    const в = разобратьВремя(текстъ) ?? value ?? '09:00'
    const мин = (Number(в.slice(0, 2)) * 60 + Number(в.slice(3)) + на + 1440) % 1440
    const н = двѣ(Math.floor(мин / 60)) + ':' + двѣ(мин % 60)
    setТекстъ(н)
    onChange(н)
  }

  useLayoutEffect(() => {
    if (!открытъ) return
    const посчитать = () => {
      const r = поле.current?.getBoundingClientRect()
      if (!r) return
      const высота = 244
      const вверхъ = r.bottom + высота > window.innerHeight && r.top > высота
      setМѣсто({ left: Math.max(8, Math.min(r.left, window.innerWidth - 140 - 8)), top: вверхъ ? r.top - 6 : r.bottom + 6, вверхъ })
    }
    // Прокрутка самого списка — не повод двигать окно: иначе каждый щелчок
    // колёсика пересчитывал место и возвращал список к выбранному времени.
    const прокрутка = (e: Event) => {
      if (окно.current && e.target instanceof Node && окно.current.contains(e.target)) return
      посчитать()
    }
    посчитать()
    window.addEventListener('scroll', прокрутка, true)
    window.addEventListener('resize', посчитать)
    return () => {
      window.removeEventListener('scroll', прокрутка, true)
      window.removeEventListener('resize', посчитать)
    }
  }, [открытъ])

  // Список открывается на выбранном времени — один раз при открытии.
  const естьМѣсто = мѣсто !== null
  useLayoutEffect(() => {
    if (!открытъ || !естьМѣсто) return
    const сел = окно.current?.querySelector('.sel, .near') as HTMLElement | null
    if (сел && окно.current) окно.current.scrollTop = сел.offsetTop - 90
  }, [открытъ, естьМѣсто])

  useEffect(() => {
    if (!открытъ) return
    const вне = (e: MouseEvent) => {
      const t = e.target as Node
      if (!поле.current?.contains(t) && !окно.current?.contains(t)) setОткрытъ(false)
    }
    const клавиша = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setОткрытъ(false)
      }
    }
    document.addEventListener('mousedown', вне)
    document.addEventListener('keydown', клавиша, true)
    return () => {
      document.removeEventListener('mousedown', вне)
      document.removeEventListener('keydown', клавиша, true)
    }
  }, [открытъ])

  // Ближайшая к значению строка списка — если значение не кратно 15 минутам.
  const ближайшая = value ? ВСѢ[Math.round((Number(value.slice(0, 2)) * 60 + Number(value.slice(3))) / 15) % 96] : '09:00'

  return (
    <div ref={поле} className="datefield timefield" style={style} title={title}>
      <input
        ref={ввод}
        type="text"
        inputMode="numeric"
        value={текстъ}
        placeholder={т('чч:мм')}
        aria-label={ariaLabel}
        onChange={(e) => вписать(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onBlur={() => {
          принять()
          onBlur?.()
        }}
        onKeyDown={(e) => {
          const поз = e.currentTarget.selectionStart ?? 0
          const безВыделенія = поз === e.currentTarget.selectionEnd
          // Backspace сразу за «:» и Delete перед ним не стирают двоеточие, а
          // перешагивают его — дальше стирается цифра по ту сторону.
          if (e.key === 'Backspace' && безВыделенія && текстъ[поз - 1] === ':') {
            e.preventDefault()
            e.currentTarget.setSelectionRange(поз - 1, поз - 1)
          } else if (e.key === 'Delete' && безВыделенія && текстъ[поз] === ':') {
            e.preventDefault()
            e.currentTarget.setSelectionRange(поз + 1, поз + 1)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            принять()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            if (e.altKey) setОткрытъ(true)
            else сдвинуть(e.key === 'ArrowUp' ? 5 : -5)
          }
        }}
      />
      <button
        type="button"
        className="datefield-btn"
        title={т('Выбрать время из списка')}
        aria-haspopup="listbox"
        aria-expanded={открытъ}
        onClick={() => setОткрытъ((о) => !о)}
      >
        <Icon name="clock" size={15} />
      </button>
      {открытъ && мѣсто && createPortal(
        <div
          ref={окно}
          className="timepop vybor-pop"
          data-escape-layer=""
          role="listbox"
          aria-label={т('Выбор времени')}
          style={{ left: мѣсто.left, top: мѣсто.top, transform: мѣсто.вверхъ ? 'translateY(-100%)' : undefined }}
        >
          {ВСѢ.map((в) => (
            <button
              key={в}
              type="button"
              role="option"
              aria-selected={в === value}
              className={'vybor-opt' + (в === value ? ' sel' : в === ближайшая ? ' near' : '')}
              onClick={() => {
                onChange(в)
                setТекстъ(в)
                setОткрытъ(false)
                onBlur?.()
              }}
            >
              {в}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
