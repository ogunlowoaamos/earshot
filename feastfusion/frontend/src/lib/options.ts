import type { MenuItem, OptionGroup, OptionPick } from './api'

/**
 * Everything the three pages need to know about the choices on a dish. Kept in
 * one place so the menu page, the catering form and the basket all count chops
 * exactly the same way.
 */

/** How many of one choice the customer asked for. Zero means they did not. */
export function pickedQty(picks: OptionPick[], optionId: number): number {
  return picks.find((p) => p.option_id === optionId)?.qty ?? 0
}

/** A stable name for "this dish, with these choices", used to tell basket lines apart. */
export function picksKey(itemId: number, picks: OptionPick[]): string {
  const parts = [...picks]
    .filter((p) => p.qty > 0)
    .sort((a, b) => a.option_id - b.option_id)
    .map((p) => `${p.option_id}x${p.qty}`)
  return `${itemId}|${parts.join(',')}`
}

function drop(picks: OptionPick[], optionId: number): OptionPick[] {
  return picks.filter((p) => p.option_id !== optionId)
}

/**
 * Sets how many of one choice the customer wants. In a "pick one" group asking
 * for a second choice clears the first, so a single group can never hold two.
 */
export function setPickQty(
  picks: OptionPick[],
  group: OptionGroup,
  optionId: number,
  qty: number,
): OptionPick[] {
  const next = drop(picks, optionId)
  const wanted = Math.max(0, Math.min(99, qty))

  if (wanted === 0) {
    return next
  }
  if (group.kind === 'single' && !group.allows_quantity) {
    const others = group.options.map((o) => o.id)
    return [...next.filter((p) => !others.includes(p.option_id)), { option_id: optionId, qty: 1 }]
  }
  if (group.kind === 'single') {
    const others = group.options.map((o) => o.id)
    return [...next.filter((p) => !others.includes(p.option_id)), { option_id: optionId, qty: wanted }]
  }
  return [...next, { option_id: optionId, qty: wanted }]
}

/** Adds or removes one choice, for the tick-style groups. */
export function togglePick(picks: OptionPick[], group: OptionGroup, optionId: number): OptionPick[] {
  return pickedQty(picks, optionId) > 0
    ? drop(picks, optionId)
    : setPickQty(picks, group, optionId, 1)
}

/** The option behind an id, wherever it lives on the dish. */
export function findOption(item: MenuItem, optionId: number) {
  for (const group of item.option_groups ?? []) {
    const found = group.options.find((o) => o.id === optionId)
    if (found) return { group, option: found }
  }
  return null
}

/** What the choices add to the price, per one of the dish. */
export function picksExtraKobo(item: MenuItem, picks: OptionPick[]): number {
  return picks.reduce((sum, p) => {
    const found = findOption(item, p.option_id)
    return sum + (found ? found.option.price_delta_kobo * p.qty : 0)
  }, 0)
}

/** The choices written out for a person to read, e.g. "3 × Puff-puff". */
export function pickLabels(item: MenuItem, picks: OptionPick[]): string[] {
  return picks
    .filter((p) => p.qty > 0)
    .map((p) => {
      const found = findOption(item, p.option_id)
      if (!found) return null
      return p.qty > 1 ? `${p.qty} × ${found.option.label}` : found.option.label
    })
    .filter((label): label is string => label !== null)
}

/** The name of a group the customer still has to answer, or null when done. */
export function missingRequiredGroup(item: MenuItem, picks: OptionPick[]): string | null {
  for (const group of item.option_groups ?? []) {
    if (!group.is_required) continue
    const answered = group.options.some(
      (o) => o.is_available && pickedQty(picks, o.id) > 0,
    )
    if (!answered) return group.name
  }
  return null
}

/**
 * A card that adds in one tap cannot ask questions, so anything the dish
 * insists on is answered with its first available choice. Returns null when a
 * required group has nothing left to offer, which means no quick add.
 */
export function defaultPicks(item: MenuItem): OptionPick[] | null {
  const picks: OptionPick[] = []
  for (const group of item.option_groups ?? []) {
    if (!group.is_required) continue
    const first = group.options.find((o) => o.is_available)
    if (!first) return null
    picks.push({ option_id: first.id, qty: 1 })
  }
  return picks
}
