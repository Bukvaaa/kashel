// Демо-хранилище для дизайн-аудита: все ключи localStorage одним JSON.
// Запуск: npx esbuild scripts/audit-seed.ts --bundle --platform=node --format=cjs
//   --loader:.png=dataurl --loader:.jpg=dataurl --outfile=node_modules/.cache/audit-seed.cjs
//   && node node_modules/.cache/audit-seed.cjs > seed.json
import { buildSeed, seedCanvas, seedNotes } from './fixture'

const data = buildSeed()
const { transactions, ...core } = data
const out: Record<string, string> = {}
out['kashel:data.json'] = JSON.stringify({ ...core, settings: { ...core.settings, whatsNewSeen: '99.0.0', quotes: { popup: 'off' } } })
const byMonth = new Map<string, typeof transactions>()
for (const t of transactions) {
  const mk = t.date.slice(0, 7)
  byMonth.set(mk, [...(byMonth.get(mk) || []), t])
}
for (const [mk, list] of byMonth) out[`kashel:transactions/${mk}.json`] = JSON.stringify(list)
for (const [title, body] of Object.entries(seedNotes())) out[`kashel:notes/${title}.md`] = body
out['kashel:canvas/Схема финансов.canvas'] = JSON.stringify(seedCanvas(data))
process.stdout.write(JSON.stringify(out))
