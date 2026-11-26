/*
 * Курсы валют: карточка на «Сводке» и настройка курсов.
 *
 * Курс идёт от основной валюты ко всем остальным: «1 KM = 0,51 €». Курсы
 * сами скачиваются раз в 12 часов (App), а любой можно поправить вручную —
 * ручной главнее скачанного, пока его не сбросить.
 */
import { useState } from 'react'
import { useStore } from '../state/store'
import { основнаяИзНастроек } from '../state/defaults'
import { ВАЛЮТЫ, курсОтОсновной, подписьКурса, скачатьКурсы, знакВалюты, type КодВалюты } from '../lib/valyuty'
import { Icon } from '../lib/icons'
import { Field, Toggle, useToast } from './ui'
import { т } from '../i18n'
import { раскладкаСводки, сохранениеРаскладки } from './SetkaSvodki'

/** Когда обновлены курсы — по-человечески. */
function когдаОбновлены(iso: string | undefined): string {
  if (!iso) return т('ещё не скачаны')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return т('ещё не скачаны')
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function useОбновитьКурсы() {
  const store = useStore()
  const toast = useToast()
  const [идёт, setИдёт] = useState(false)
  const обновить = () => {
    const основная = основнаяИзНастроек(store.data.settings)
    setИдёт(true)
    скачатьКурсы(основная)
      .then((к) => {
        store.patchSettings({ rates: к })
        toast(т('Курсы обновлены'))
      })
      .catch((e: unknown) => toast(т('Не удалось скачать курсы: {0}', e instanceof Error ? e.message : String(e))))
      .finally(() => setИдёт(false))
  }
  return { идёт, обновить }
}

/** Блок «Сводки»: курс основной валюты ко всем остальным. */
export function КурсыСводка() {
  const { data } = useStore()
  const основная = основнаяИзНастроек(data.settings)
  const { идёт, обновить } = useОбновитьКурсы()
  const ручные = data.settings.ratesManual ?? {}
  const прочие = ВАЛЮТЫ.filter((в) => в.код !== основная)
  return (
    <div className="card kursy-card">
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>
          <Icon name="chart" size={14} /> {т(' Курсы валют')}</div>
        <span className="spacer" />
        <span className="faint small">{когдаОбновлены(data.settings.rates?.base === основная ? data.settings.rates.updatedAt : undefined)}</span>
        <button className="btn sm ghost icon" title={т('Обновить курсы')} disabled={идёт} onClick={обновить}>
          <Icon name="repeat" size={13} />
        </button>
      </div>
      <div className="kursy-list">
        {прочие.map((в) => {
          const к = курсОтОсновной(в.код)
          return (
            <div key={в.код} className="kursy-item" title={в.имя}>
              <span className="kursy-kod">{в.код}</span>
              <span className="num">{к ? подписьКурса(в.код, к) : т('1 {0} = ? {1}', знакВалюты(основная), в.знак)}</span>
              {ручные[в.код] ? <span className="faint small">{т('вручную')}</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Карточка настроек: курсы, ручная правка, показ на «Сводке». */
export function КурсыНастройки() {
  const store = useStore()
  const { data, patchSettings } = store
  const основная = основнаяИзНастроек(data.settings)
  const { идёт, обновить } = useОбновитьКурсы()
  const ручные = data.settings.ratesManual ?? {}
  const скачанные = data.settings.rates?.base === основная ? data.settings.rates : undefined
  const раскладка = раскладкаСводки(data.settings)
  const наСводке = раскладка.some((e) => e.block === 'rates')
  const поставитьРучной = (к: КодВалюты, текст: string) => {
    const n = Number(текст.replace(',', '.'))
    const след = { ...ручные }
    if (текст.trim() === '' || !Number.isFinite(n) || n <= 0) delete след[к]
    else след[к] = n
    patchSettings({ ratesManual: след })
  }
  const переключитьСводку = (вкл: boolean) =>
    patchSettings(
      сохранениеРаскладки(
        вкл ? [{ id: 'b:rates', block: 'rates', span: 12 }, ...раскладка] : раскладка.filter((e) => e.block !== 'rates'),
      ),
    )
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>
          <Icon name="chart" size={14} /> {т(' Курсы валют')}</div>
        <span className="spacer" />
        <button className="btn sm" disabled={идёт} onClick={обновить}>
          <Icon name="repeat" size={13} /> {т('Обновить')}
        </button>
      </div>
      <div className="faint small" style={{ marginBottom: 10 }}>
        {т('Курсы скачиваются сами раз в 12 часов с open.er-api.com (уходит только код основной валюты). Свой курс главнее скачанного — сотрите его, чтобы вернуть скачанный. Скачано: {0}.', когдаОбновлены(скачанные?.updatedAt))}
      </div>
      <div className="grid c2">
        {ВАЛЮТЫ.filter((в) => в.код !== основная).map((в) => {
          const скачан = скачанные?.rates[в.код]
          return (
            <Field
              key={в.код}
              label={т('1 {0} = … {1}', знакВалюты(основная), в.знак)}
              hint={скачан ? т('Скачанный: {0}', String(скачан)) : т('Скачанного курса пока нет')}
            >
              <input
                type="text"
                inputMode="decimal"
                placeholder={скачан ? String(скачан) : ''}
                defaultValue={ручные[в.код] ? String(ручные[в.код]) : ''}
                key={основная + в.код + (ручные[в.код] ?? '')}
                onBlur={(e) => поставитьРучной(в.код, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            </Field>
          )
        })}
      </div>
      <div style={{ marginTop: 10 }}>
        <Toggle checked={наСводке} onChange={переключитьСводку} label={т('Показывать курсы на «Сводке»')} />
      </div>
    </div>
  )
}
