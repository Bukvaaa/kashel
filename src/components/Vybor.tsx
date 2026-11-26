/*
 * Выпадающий список в стиле Кошеля — замена <select>.
 *
 * Системный список рисует операционная система: на Windows — свой, на Маке —
 * синее меню со своим шрифтом и стрелкой, и рядом с полем даты автора
 * (DateField) это были два разных мира в одном окне. Здесь кнопка выглядит
 * как обычное поле, стрелка — значок автора, а список — такая же панель, как
 * календарик.
 *
 * Пишется так же, как <select>: value, onChange(e => e.target.value) и
 * <option> внутри — замена в разметке механическая. Внутри остаётся
 * спрятанный настоящий <select>: он держит значение для проверок и
 * для тех, кто ищет поле по-старому, но в фокус и в дерево доступности не
 * попадает.
 *
 * Клавиатура как у системного: ↑ ↓ Home End, Enter и пробел, Escape, первая
 * буква — к ближайшему пункту на неё.
 */
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../lib/icons'

interface Пунктъ {
  value: string
  label: React.ReactNode
  текстъ: string
  disabled?: boolean
}

const текстомъ = (n: React.ReactNode): string =>
  typeof n === 'string' || typeof n === 'number'
    ? String(n)
    : Array.isArray(n)
      ? n.map(текстомъ).join('')
      : React.isValidElement(n)
        ? текстомъ((n.props as { children?: React.ReactNode }).children)
        : ''

function пункты(children: React.ReactNode): Пунктъ[] {
  const out: Пунктъ[] = []
  const обойти = (узлы: React.ReactNode) =>
    React.Children.forEach(узлы, (н) => {
      if (!React.isValidElement(н)) return
      if (н.type === React.Fragment) return обойти((н.props as { children?: React.ReactNode }).children)
      if (н.type !== 'option') return
      const p = н.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean }
      const текстъ = текстомъ(p.children)
      out.push({ value: p.value === undefined ? текстъ : String(p.value), label: p.children, текстъ, disabled: p.disabled })
    })
  обойти(children)
  return out
}

export type VyborChange = { target: { value: string } }

export function Vybor({
  value,
  onChange,
  children,
  className,
  style,
  title,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string | number | undefined
  onChange: (e: VyborChange) => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  title?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  const список = useMemo(() => пункты(children), [children])
  const v = value === undefined || value === null ? '' : String(value)
  const выбранъ = список.find((п) => п.value === v)
  const [открытъ, setОткрытъ] = useState(false)
  const [активный, setАктивный] = useState(-1)
  const кнопка = useRef<HTMLButtonElement>(null)
  const окно = useRef<HTMLDivElement>(null)
  const [мѣсто, setМѣсто] = useState<{ left: number; top: number; width: number; вверхъ: boolean; высота: number } | null>(null)
  const id = useId()

  const выбрать = (п: Пунктъ | undefined) => {
    if (!п || п.disabled) return
    setОткрытъ(false)
    кнопка.current?.focus()
    if (п.value !== v) onChange({ target: { value: п.value } })
  }

  const открыть = () => {
    if (disabled) return
    setАктивный(Math.max(0, список.findIndex((п) => п.value === v)))
    setОткрытъ(true)
  }

  useLayoutEffect(() => {
    if (!открытъ) return
    const посчитать = () => {
      const r = кнопка.current?.getBoundingClientRect()
      if (!r) return
      const нужно = Math.min(300, список.length * 32 + 10)
      const снизу = window.innerHeight - r.bottom - 12
      const вверхъ = снизу < нужно && r.top > снизу
      const высота = Math.min(нужно, вверхъ ? r.top - 12 : снизу)
      const width = Math.max(r.width, 160)
      setМѣсто({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: вверхъ ? r.top - 4 : r.bottom + 4, width, вверхъ, высота })
    }
    // Прокрутка самого списка не двигает окно (см. TimeField).
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
  }, [открытъ, список.length])

  // Активный пункт всегда виден в списке.
  useLayoutEffect(() => {
    if (!открытъ) return
    const эл = окно.current?.querySelector(`[data-i="${активный}"]`) as HTMLElement | null
    эл?.scrollIntoView({ block: 'nearest' })
  }, [открытъ, активный, мѣсто !== null])

  useEffect(() => {
    if (!открытъ) return
    const вне = (e: MouseEvent) => {
      const t = e.target as Node
      if (!кнопка.current?.contains(t) && !окно.current?.contains(t)) setОткрытъ(false)
    }
    // Escape ловим в фазе захвата, как календарик: обработчики окна и
    // программы слушают раньше кнопки и иначе забирают клавишу себе.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setОткрытъ(false)
      кнопка.current?.focus()
    }
    document.addEventListener('mousedown', вне)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('mousedown', вне)
      document.removeEventListener('keydown', escape, true)
    }
  }, [открытъ])

  const шагъ = (откуда: number, на: number) => {
    for (let i = откуда + на; i >= 0 && i < список.length; i += на) if (!список[i].disabled) return i
    return откуда
  }

  const клавиша = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!открытъ) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        открыть()
      }
      return
    }
    if (e.key === 'Tab') {
      setОткрытъ(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setАктивный((a) => шагъ(a, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setАктивный((a) => шагъ(a, -1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setАктивный(шагъ(-1, 1))
    } else if (e.key === 'End') {
      e.preventDefault()
      setАктивный(шагъ(список.length, -1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      выбрать(список[активный])
    } else if (e.key.length === 1) {
      const буква = e.key.toLowerCase()
      const n = список.length
      for (let k = 1; k <= n; k++) {
        const i = (активный + k) % n
        if (!список[i].disabled && список[i].текстъ.trim().toLowerCase().startsWith(буква)) {
          setАктивный(i)
          break
        }
      }
    }
  }

  return (
    <span className={'vybor' + (className ? ' ' + className : '') + (disabled ? ' disabled' : '')} style={style} title={title}>
      <button
        ref={кнопка}
        type="button"
        className="vybor-btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={открытъ}
        aria-controls={открытъ ? id : undefined}
        aria-activedescendant={открытъ && активный >= 0 ? `${id}-${активный}` : undefined}
        aria-label={ariaLabel}
        title={title ? undefined : выбранъ?.текстъ}
        onClick={() => (открытъ ? setОткрытъ(false) : открыть())}
        onKeyDown={клавиша}
      >
        <span className="vybor-val">{выбранъ ? выбранъ.label : ' '}</span>
        <Icon name="down" size={14} className="vybor-arrow" />
      </button>
      <select className="vybor-native" tabIndex={-1} aria-hidden="true" value={v} disabled={disabled} onChange={(e) => onChange({ target: { value: e.target.value } })}>
        {список.map((п) => (
          <option key={п.value} value={п.value} disabled={п.disabled}>{п.текстъ}</option>
        ))}
      </select>
      {открытъ && мѣсто && createPortal(
        <div
          ref={окно}
          id={id}
          className="vybor-pop"
          data-escape-layer=""
          role="listbox"
          style={{ left: мѣсто.left, top: мѣсто.top, minWidth: мѣсто.width, maxHeight: мѣсто.высота, transform: мѣсто.вверхъ ? 'translateY(-100%)' : undefined }}
        >
          {список.map((п, i) => (
            <div
              key={п.value + ':' + i}
              id={`${id}-${i}`}
              data-i={i}
              role="option"
              aria-selected={п.value === v}
              aria-disabled={п.disabled || undefined}
              className={'vybor-opt' + (п.value === v ? ' sel' : '') + (i === активный ? ' active' : '') + (п.disabled ? ' disabled' : '')}
              onMouseEnter={() => setАктивный(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => выбрать(п)}
            >
              <span className="vybor-opt-text">{п.label}</span>
              {п.value === v && <Icon name="check" size={14} />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </span>
  )
}
