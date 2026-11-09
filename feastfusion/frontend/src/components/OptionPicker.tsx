import type { OptionGroup, OptionPick } from '../lib/api'
import { naira } from '../lib/api'
import { pickText, pickedQty, setPickQty, setPickText, togglePick } from '../lib/options'
import './OptionPicker.css'

/**
 * The choices on a dish. A group that counts pieces gets a how-many stepper on
 * every choice; anything else is a plain chip, so "pick one" reads like a radio
 * button and "pick many" like a tick box.
 */
export function OptionPicker({
  groups,
  picks,
  onChange,
  dark = false,
  idPrefix = 'opt',
}: {
  groups: OptionGroup[]
  picks: OptionPick[]
  /**
   * Takes a function rather than the new list, so a fast double-click counts
   * twice instead of both clicks landing on the same stale list.
   */
  onChange: (update: (prev: OptionPick[]) => OptionPick[]) => void
  /** Sit on the always-dark catering card instead of the cream page. */
  dark?: boolean
  idPrefix?: string
}) {
  if (groups.length === 0) return null

  return (
    <div className={'opts' + (dark ? ' opts--dark' : '')}>
      {groups.map((group) => {
        const options = group.options.filter((o) => o.is_available)
        if (options.length === 0) return null

        return (
          <section className="opts__group" key={group.id}>
            <div className="opts__head">
              <h3 className="opts__name" id={`${idPrefix}-${group.id}`}>
                {group.name}
              </h3>
              <span className="opts__rule">
                {group.allows_quantity
                  ? 'Say how many of each'
                  : group.kind === 'single'
                    ? 'Pick one'
                    : 'Pick any'}
                {group.is_required && <em> · needed</em>}
              </span>
            </div>

            {group.help.trim() && <p className="opts__help">{group.help}</p>}

            <ul
              className={'opts__list' + (group.allows_quantity ? ' opts__list--count' : '')}
              role="group"
              aria-labelledby={`${idPrefix}-${group.id}`}
            >
              {options.map((option) => {
                const qty = pickedQty(picks, option.id)
                const on = qty > 0
                const cost = option.price_delta_kobo

                if (!group.allows_quantity) {
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        className={'opt-chip' + (on ? ' is-on' : '')}
                        aria-pressed={on}
                        onClick={() => onChange((prev) => togglePick(prev, group, option.id))}
                      >
                        <span className="opt-chip__tick" aria-hidden="true">
                          {on ? '✓' : ''}
                        </span>
                        <span className="opt-chip__label">{option.label}</span>
                        <span className="opt-chip__cost">
                          {cost === 0 ? 'Included' : `+${naira(cost)}`}
                        </span>
                      </button>
                    </li>
                  )
                }

                return (
                  <li key={option.id}>
                    <div className={'opt-row' + (on ? ' is-on' : '')}>
                      <span className="opt-row__label">{option.label}</span>
                      <span className="opt-row__cost">
                        {cost === 0 ? 'Included' : `+${naira(cost)}`}
                      </span>
                      <div className="opt-row__qty">
                        <button
                          type="button"
                                                  onClick={() =>
                                                    onChange((prev) =>
                                                      setPickQty(prev, group, option.id, pickedQty(prev, option.id) - 1),
                                                    )
                                                  }
                                                  disabled={qty === 0}
                                                  aria-label={`One less ${option.label}`}
                                                >
                                                  −
                                                </button>
                                                <span aria-live="polite" aria-label={`${option.label} count`}>
                                                  {qty}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    onChange((prev) =>
                                                      setPickQty(prev, group, option.id, pickedQty(prev, option.id) + 1),
                                                    )
                                                  }
                                                  disabled={qty >= 99}
                                                  aria-label={`One more ${option.label}`}
                                                >
                                                  +
                                                </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {group.free_text && <FreeTextBox group={group} picks={picks} onChange={onChange} />}
          </section>
        )
      })}
    </div>
  )
}

/**
 * The box a "type it yourself" group opens. It only appears once the customer
 * has picked something other than the first choice, because the first choice is
 * the house standard and needs no explaining.
 */
function FreeTextBox({
  group,
  picks,
  onChange,
}: {
  group: OptionGroup
  picks: OptionPick[]
  onChange: (update: (prev: OptionPick[]) => OptionPick[]) => void
}) {
  const first = group.options.find((o) => o.is_available)
  const picked = picks.find(
    (p) => p.qty > 0 && group.options.some((o) => o.id === p.option_id),
  )
  if (!first || !picked || picked.option_id === first.id) return null

  const label = group.options.find((o) => o.id === picked.option_id)?.label ?? 'Custom'
  const fieldId = `opt-text-${group.id}`

  return (
    <div className="opts__text">
      <label className="opts__text-label" htmlFor={fieldId}>
        Tell us the {label.toLowerCase()} size and how much you want
      </label>
      <input
        id={fieldId}
        className="opts__text-input"
        type="text"
        maxLength={120}
        placeholder="e.g. a big bowl that feeds four"
        value={pickText(picks, picked.option_id)}
        onChange={(e) => {
          const words = e.target.value
          onChange((prev) => setPickText(prev, picked.option_id, words))
        }}
      />
    </div>
  )
}
