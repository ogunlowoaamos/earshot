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
    .map((p) => `${p.option_id}x${p.qty}${p.text ? `~${p.text}` : ''}`)
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
  // Keep any words already typed for this choice, so tapping the chip again
  // does not wipe what the customer wrote.
  const kept = picks.find((p) => p.option_id === optionId)?.text
  const next = drop(picks, optionId)
  const wanted = Math.max(0, Math.min(99, qty))
  const withText = (pick: OptionPick): OptionPick => (kept ? { ...pick, text: kept } : pick)

  if (wanted === 0) {
    return next
  }
  if (group.kind === 'single' && !group.allows_quantity) {
    const others = group.options.map((o) => o.id)
    return [
      ...next.filter((p) => !others.includes(p.option_id)),
      withText({ option_id: optionId, qty: 1 }),
    ]
  }
  if (group.kind === 'single') {
    const others = group.options.map((o) => o.id)
    return [
      ...next.filter((p) => !others.includes(p.option_id)),
      withText({ option_id: optionId, qty: wanted }),
    ]
  }
  return [...next, withText({ option_id: optionId, qty: wanted })]
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
      const base = p.qty > 1 ? `${p.qty} × ${found.option.label}` : found.option.label
      // The customer's own words, when the group asked for them.
      return p.text ? `${base} (${p.text})` : base
    })
    .filter((label): label is string => label !== null)
}

/** Sets the words the customer typed for one choice. */
export function setPickText(picks: OptionPick[], optionId: number, text: string): OptionPick[] {
  return picks.map((p) => (p.option_id === optionId ? { ...p, text } : p))
}

/** The words the customer typed for one choice, or an empty string. */
export function pickText(picks: OptionPick[], optionId: number): string {
  return picks.find((p) => p.option_id === optionId)?.text ?? ''
}

/**
 * The name of a group the customer still has to answer, or null when done.
 *
 * A group that lets the customer type their own answer is only answered when
 * they have said something, unless they took the first choice — that is the
 * house standard, so there is nothing to explain.
 */
export function missingRequiredGroup(item: MenuItem, picks: OptionPick[]): string | null {
  for (const group of item.option_groups ?? []) {
    if (!group.is_required) continue
    const answered = group.options.some(
      (o) => o.is_available && pickedQty(picks, o.id) > 0,
    )
    if (!answered) return group.name
    if (group.free_text && needsWords(group, picks)) return group.name
  }
  return null
}

/** True when the customer picked something other than the house standard. */
function needsWords(group: OptionGroup, picks: OptionPick[]): boolean {
  const first = group.options.find((o) => o.is_available)
  if (!first) return false
  const picked = picks.find((p) => p.qty > 0 && group.options.some((o) => o.id === p.option_id))
  if (!picked || picked.option_id === first.id) return false
  return !picked.text?.trim()
}

/**
 * A card that adds in one tap cannot ask questions, so anything the dish
 * insists on is answered with its first available choice. A group that counts
 * pieces has no sensible default — one puff-puff is not an answer — so it is
 * left out and the dish has to be opened instead.
 */
export function defaultPicks(item: MenuItem): OptionPick[] {
  const picks: OptionPick[] = []
  for (const group of item.option_groups ?? []) {
    if (!group.is_required || group.allows_quantity) continue
    const first = group.options.find((o) => o.is_available)
    if (first) picks.push({ option_id: first.id, qty: 1 })
  }
  return picks
}

/**
 * True when a dish can go straight into the basket with its defaults. A dish
 * that counts pieces cannot, because the customer has to say how many.
 */
export function canQuickAdd(item: MenuItem): boolean {
  return (item.option_groups ?? []).every(
    (group) =>
      !group.is_required ||
      (!group.allows_quantity && group.options.some((o) => o.is_available)),
  )
}
