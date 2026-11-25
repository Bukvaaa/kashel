/*
 * Период «Графа»: готовые отрезки от сегодняшнего дня назад и свой — от и до.
 * Ничего не знает о React — проверяется в самопроверке.
 */
import { addDays, addMonths, humanDate, today } from './date'
import { т } from '../i18n'

export type ВидПериодаГрафа = '1d' | '7d' | '1m' | '3m' | '6m' | '12m' | 'all' | 'custom'

export interface ПериодГрафа {
  k: ВидПериодаГрафа
  /** Для своего периода: с какого дня и по какой, включительно. */
  from?: string
  to?: string
}

export const ВЕСЬ_ПЕРИОД: ПериодГрафа = { k: 'all' }

/** Кнопки выбора — в том порядке, в каком стоят. «Свой» открывает календарь. */
export const ПЕРИОДЫ_ГРАФА: { k: ВидПериодаГрафа; t: string }[] = [
  { k: '1d', t: т('День') },
  { k: '7d', t: т('Неделя') },
  { k: '1m', t: т('Месяц') },
  { k: '3m', t: т('3 мес') },
  { k: '6m', t: т('Полгода') },
  { k: '12m', t: т('Год') },
  { k: 'all', t: т('Всё') },
  { k: 'custom', t: т('Свой…') },
]

/** Отрезок дат периода. Пустая строка — без границы с этой стороны. */
export function отрезокГрафа(п: ПериодГрафа, сегодня: string = today()): { с: string; по: string } {
  switch (п.k) {
    case '1d': return { с: сегодня, по: '' }
    case '7d': return { с: addDays(сегодня, -6), по: '' }
    case '1m': return { с: addMonths(сегодня, -1), по: '' }
    case '3m': return { с: addMonths(сегодня, -3), по: '' }
    case '6m': return { с: addMonths(сегодня, -6), по: '' }
    case '12m': return { с: addMonths(сегодня, -12), по: '' }
    case 'custom': {
      const [a, b] = [п.from ?? '', п.to ?? '']
      // Перепутанные концы — не повод показать пустоту.
      return a && b && a > b ? { с: b, по: a } : { с: a, по: b }
    }
    default: return { с: '', по: '' }
  }
}

/** Входит ли день в период. */
export function вПериоде(дата: string, о: { с: string; по: string }): boolean {
  return (!о.с || дата >= о.с) && (!о.по || дата <= о.по)
}

/** Подпись для карточки узла: «за месяц», «за 3 мес.», «с 1 мар по 9 мар». */
export function заПериодГрафа(п: ПериодГрафа): string {
  switch (п.k) {
    case '1d': return т('за сегодня')
    case '7d': return т('за неделю')
    case '1m': return т('за месяц')
    case '3m': return т('за {0} мес.', 3)
    case '6m': return т('за {0} мес.', 6)
    case '12m': return т('за год')
    case 'custom': {
      const о = отрезокГрафа(п)
      if (!о.с || !о.по) return т('за всё время')
      return о.с === о.по ? т('за {0}', humanDate(о.с)) : т('с {0} по {1}', humanDate(о.с), humanDate(о.по))
    }
    default: return т('за всё время')
  }
}

/** Подпись кнопки «Свой»: пока даты не выбраны — «Свой…», потом сами даты. */
export function подписьСвоего(п: ПериодГрафа): string {
  if (п.k !== 'custom' || !п.from || !п.to) return т('Свой…')
  const о = отрезокГрафа(п)
  return о.с === о.по ? humanDate(о.с) : `${humanDate(о.с)} – ${humanDate(о.по)}`
}
