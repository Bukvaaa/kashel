/* Порядок досок канваса в списке: как расставил человек. */
/** Доски в порядке, который расставил человек; нерасставленные — в конце, как были. */
export function упорядочитьДоски(files: string[], порядок: string[] | undefined): string[] {
  if (!порядок?.length) return files
  const место = new Map(порядок.map((f, i) => [f, i]))
  return [...files].sort((a, b) => (место.get(a) ?? порядок.length) - (место.get(b) ?? порядок.length))
}

/** Доска «что» встаёт на место доски «куда»: тянем вниз — после неё, вверх — перед ней. */
export function переставитьДоску(доски: string[], что: string, куда: string): string[] {
  const откуда = доски.indexOf(что)
  const сюда = доски.indexOf(куда)
  if (откуда < 0 || сюда < 0 || откуда === сюда) return доски
  const out = доски.filter((x) => x !== что)
  out.splice(сюда, 0, что)
  return out
}
