/*
 * Валюты и курсы.
 *
 * Основная валюта — та, в которой Кошель считает всё: итоги, бюджет,
 * прогноз, награды. Сумма операции (Transaction.amount) всегда в основной
 * валюте по курсу дня записи — поэтому прошлые месяцы не «плавают», когда
 * курс меняется. Валютная сумма лежит рядом (cur/curAmount — как ввели,
 * accAmount/toAmount — в валюте счёта). Из неё считается остаток валютного
 * счёта, а в основной валюте этот остаток стоит уже по сегодняшнему курсу.
 *
 * Основная валюта и курсы ставятся из настроек при каждой отрисовке (как
 * формат дат): их читают money() и движок остатков, которым настройки не
 * передаются.
 */
import type { Money } from './types'
import { т } from '../i18n'

export type КодВалюты = 'BAM' | 'EUR' | 'USD' | 'RUB'

export interface Валюта {
  код: КодВалюты
  знак: string
  имя: string
}

/** Порядок — как в выборе: марка, евро, доллар, рубль. */
export const ВАЛЮТЫ: Валюта[] = [
  { код: 'BAM', знак: 'KM', имя: т('Конвертируемая марка') },
  { код: 'EUR', знак: '€', имя: т('Евро') },
  { код: 'USD', знак: '$', имя: т('Доллар США') },
  { код: 'RUB', знак: '₽', имя: т('Российский рубль') },
]
export const КОДЫ = ВАЛЮТЫ.map((в) => в.код)
const ПО_КОДУ = new Map(ВАЛЮТЫ.map((в) => [в.код, в]))

export const этоКод = (x: unknown): x is КодВалюты => typeof x === 'string' && ПО_КОДУ.has(x as КодВалюты)
export const знакВалюты = (к: КодВалюты | undefined): string => ПО_КОДУ.get(к ?? основная)?.знак ?? '₽'
export const имяВалюты = (к: КодВалюты): string => ПО_КОДУ.get(к)?.имя ?? к

/** Старые хранилища держали только символ валюты — по нему и узнаём основную. */
export function кодПоЗнаку(знак: string | undefined): КодВалюты | undefined {
  const з = (знак ?? '').trim().toLowerCase()
  if (!з) return undefined
  if (з === '₽' || з.startsWith('руб') || з === 'rub') return 'RUB'
  if (з === '$' || з === 'usd') return 'USD'
  if (з === '€' || з === 'eur') return 'EUR'
  if (з === 'km' || з === 'км' || з === 'bam') return 'BAM'
  return undefined
}

/**
 * Курсы: сколько единиц каждой валюты дают за одну единицу основной.
 * «1 KM = 0,51 €» — rates.EUR = 0.51 при base = 'BAM'.
 */
export interface Курсы {
  base: КодВалюты
  rates: Partial<Record<КодВалюты, number>>
  /** Когда курсы пришли из сети, ISO. */
  updatedAt?: string
}

// ------------------------------------------------------------ состояние
let основная: КодВалюты = 'RUB'
let скачанные: Курсы | undefined
let ручные: Partial<Record<КодВалюты, number>> = {}

/** Ставится из настроек при каждой отрисовке App. */
export function поставитьВалюты(о: КодВалюты, к?: Курсы, р?: Partial<Record<КодВалюты, number>>) {
  основная = о
  скачанные = к
  ручные = р ?? {}
}
export const основнаяВалюта = (): КодВалюты => основная

/**
 * Курс «1 основной = x валюты». Ручной главнее скачанного; скачанный годится,
 * только если скачан от этой же основной валюты (после смены основной старые
 * курсы ничего не значат). Для самой основной — 1.
 */
export function курсОтОсновной(к: КодВалюты): number | undefined {
  if (к === основная) return 1
  const р = ручные[к]
  if (р && р > 0) return р
  if (скачанные?.base === основная) {
    const с = скачанные.rates[к]
    if (с && с > 0) return с
  }
  return undefined
}

/** Курс из одной валюты в другую: сколько «в» за одну «из». Неизвестен — undefined. */
export function курс(из: КодВалюты, в: КодВалюты): number | undefined {
  if (из === в) return 1
  const а = курсОтОсновной(из)
  const б = курсОтОсновной(в)
  return а && б ? б / а : undefined
}

/** Сумма (в копейках) из одной валюты в другую. Курса нет — undefined. */
export function перевести(m: Money, из: КодВалюты, в: КодВалюты): Money | undefined {
  const к = курс(из, в)
  return к === undefined ? undefined : Math.round(m * к)
}

/** Перевести в основную; курса нет — сумма как есть (лучше так, чем ноль в итогах). */
export const вОсновную = (m: Money, из: КодВалюты | undefined): Money =>
  !из || из === основная ? m : перевести(m, из, основная) ?? m

/** Валюта счёта: не задана — основная. */
export const валютаСчёта = (a: { currency?: КодВалюты } | undefined): КодВалюты => a?.currency ?? основная

/** Подпись курса для людей: «1 KM = 0,5113 €». */
export function подписьКурса(к: КодВалюты, значение: number): string {
  const знаков = значение >= 100 ? 2 : значение >= 1 ? 4 : 5
  return `1 ${знакВалюты(основная)} = ${значение.toFixed(знаков).replace('.', ',')} ${знакВалюты(к)}`
}

// ------------------------------------------------------------ загрузка
/** Бесплатный источник без ключа: курсы ЦБ и рынка раз в сутки. */
const ИСТОЧНИК = 'https://open.er-api.com/v6/latest/'

/** Скачать курсы от основной валюты. Ничего, кроме кода валюты, не отправляется. */
export async function скачатьКурсы(база: КодВалюты): Promise<Курсы> {
  const ответ = await fetch(ИСТОЧНИК + база, { cache: 'no-store' })
  if (!ответ.ok) throw new Error(т('Сервер курсов ответил {0}', ответ.status))
  const j = (await ответ.json()) as { result?: string; base_code?: string; rates?: Record<string, number> }
  if (j.result !== 'success' || j.base_code !== база || !j.rates) throw new Error(т('Сервер курсов прислал не то'))
  const rates: Partial<Record<КодВалюты, number>> = {}
  for (const к of КОДЫ) if (к !== база && typeof j.rates[к] === 'number' && j.rates[к] > 0) rates[к] = j.rates[к]
  return { base: база, rates, updatedAt: new Date().toISOString() }
}

/** Пора ли обновить: курсов нет, они от другой основной или старше 12 часов. */
export function пораОбновить(к: Курсы | undefined, база: КодВалюты, сейчас = Date.now()): boolean {
  if (!к || к.base !== база || !к.updatedAt) return true
  return сейчас - Date.parse(к.updatedAt) > 12 * 3600 * 1000
}

// ------------------------------------------------------------ суммы операции
/** Что из валютных полей операции считается при записи. */
export interface ВалютныеСуммы {
  /** В основной валюте — то, что идёт в итоги. */
  amount: Money
  cur?: КодВалюты
  curAmount?: Money
  accAmount?: Money
  toAmount?: Money
}

/**
 * Суммы операции из введённой: в основной валюте (по сегодняшнему курсу —
 * он и есть курс дня записи), в валюте счёта списания и счёта зачисления.
 * Валютные поля пишутся, только когда в них есть смысл. Курса нет — null.
 */
export function суммыОперации(
  введено: Money,
  cur: КодВалюты,
  счёт: { currency?: КодВалюты } | undefined,
  наСчёт?: { currency?: КодВалюты },
): ВалютныеСуммы | null {
  const amount = cur === основная ? введено : перевести(введено, cur, основная)
  if (amount === undefined) return null
  const р: ВалютныеСуммы = { amount }
  if (cur !== основная) { р.cur = cur; р.curAmount = введено }
  const вСвоей = (с: { currency?: КодВалюты } | undefined): Money | undefined | null => {
    const к = с?.currency
    if (!к || к === основная) return undefined
    return к === cur ? введено : перевести(введено, cur, к) ?? null
  }
  const а = вСвоей(счёт)
  const б = вСвоей(наСчёт)
  if (а === null || б === null) return null
  if (а !== undefined) р.accAmount = а
  if (б !== undefined) р.toAmount = б
  return р
}

/** Валюты, без курса до которых операцию не записать, — для подсказки. */
export function безКурса(cur: КодВалюты, ...счета: ({ currency?: КодВалюты } | undefined)[]): КодВалюты[] {
  const нужны = new Set<КодВалюты>([cur, ...счета.map((с) => с?.currency ?? основная)])
  return [...нужны].filter((к) => курсОтОсновной(к) === undefined)
}

/**
 * Операция, записанная без валютных полей (быстрый ввод, регулярные платежи,
 * импорт), на валютный счёт: сумма в валюте счёта досчитывается по
 * сегодняшнему курсу, чтобы остаток счёта потом не плавал вместе с курсом.
 */
export function сСуммойСчёта<T extends { amount: Money; accountId: string; toAccountId?: string; kind: string; cur?: КодВалюты; accAmount?: Money; toAmount?: Money }>(
  t: T,
  счета: { id: string; currency?: КодВалюты }[],
): T {
  if (t.cur) return t
  const вСвоей = (id: string | undefined): Money | undefined => {
    const к = счета.find((a) => a.id === id)?.currency
    return к && к !== основная ? перевести(t.amount, основная, к) : undefined
  }
  const р = { ...t }
  if (р.accAmount === undefined) { const а = вСвоей(t.accountId); if (а !== undefined) р.accAmount = а }
  if (t.kind === 'transfer' && р.toAmount === undefined) { const б = вСвоей(t.toAccountId); if (б !== undefined) р.toAmount = б }
  return р
}
