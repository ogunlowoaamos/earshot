//! Works out the starting deposit for a catering job.
//!
//! The caterer owns every number here. Nothing is hard-coded: the rates come
//! from three tables the dashboard writes to, so the chef can change what a
//! guest costs for a naming ceremony without anyone touching code.
//!
//! Three kinds of job are priced differently:
//!
//! * `event`     a party or ceremony. Priced per guest, then adjusted by the
//!               dishes chosen (a grill costs more per head than rice).
//! * `cook_only` someone wants a cook to make a dish for them to eat over
//!               several days. There are no guests, so it is priced per dish.
//! * `custom`    the caterer quotes by hand. We show a zero deposit and say so
//!               plainly rather than inventing a number.

use sqlx::SqlitePool;

use crate::{
    error::AppResult,
    models::{CookRate, CateringPricing, CateringRate, DishRate, Quote, QuoteLine},
};

/// Used when the caterer has not set a rate for the chosen event type yet.
/// Zero is honest: the customer is told the caterer will confirm the figure.
const NO_RATE: i64 = 0;

pub async fn load_pricing(pool: &SqlitePool) -> AppResult<CateringPricing> {
    let rates = sqlx::query_as::<_, CateringRate>(
        "SELECT id, event_type, rate_kobo, note, is_active, sort_order
         FROM catering_rates ORDER BY sort_order, event_type",
    )
    .fetch_all(pool)
    .await?;

    let dish_rates = sqlx::query_as::<_, DishRate>(
        "SELECT id, category_slug, uplift_kobo, note FROM catering_dish_rates
         ORDER BY category_slug",
    )
    .fetch_all(pool)
    .await?;

    let cook_rates = sqlx::query_as::<_, CookRate>(
        "SELECT id, category_slug, rate_kobo, note FROM catering_cook_rates
         ORDER BY category_slug",
    )
    .fetch_all(pool)
    .await?;

    Ok(CateringPricing {
        rates,
        dish_rates,
        cook_rates,
    })
}

/// Turns a request into a deposit figure and a reason the customer can read.
///
/// Pure apart from the pricing it is handed, so it can be unit tested without
/// a database.
pub fn quote(
    pricing: &CateringPricing,
    job_kind: &str,
    event_type: &str,
    guest_count: i64,
    dishes: &[String],
) -> Quote {
    match job_kind {
        "cook_only" => quote_cook_only(pricing, dishes),
        "custom" => Quote {
            deposit_kobo: NO_RATE,
            reason: "Your caterer will confirm the deposit for this job and send it to you.".into(),
            lines: Vec::new(),
        },
        _ => quote_event(pricing, event_type, guest_count, dishes),
    }
}

fn quote_event(
    pricing: &CateringPricing,
    event_type: &str,
    guest_count: i64,
    dishes: &[String],
) -> Quote {
    let guests = guest_count.max(0);
    let rate = pricing
        .rates
        .iter()
        .find(|r| r.event_type.eq_ignore_ascii_case(event_type) && r.is_active);

    let Some(rate) = rate else {
        return Quote {
            deposit_kobo: NO_RATE,
            reason: format!(
                "We do not have a set rate for {event_type} yet. Your caterer will confirm the deposit."
            ),
            lines: Vec::new(),
        };
    };

    let mut lines = vec![QuoteLine {
        label: format!("{} guests at {} each", guests, naira(rate.rate_kobo)),
        amount_kobo: guests * rate.rate_kobo,
    }];

    // Each chosen dish category nudges the per-guest rate. The uplift is per
    // guest, so it scales with headcount the same way the base rate does.
    let mut uplift_per_guest = 0i64;
    for slug in dishes {
        if let Some(dish) = pricing.dish_rates.iter().find(|d| &d.category_slug == slug) {
            if dish.uplift_kobo == 0 {
                continue;
            }
            uplift_per_guest += dish.uplift_kobo;
            lines.push(QuoteLine {
                label: format!("{} adds {} per guest", pretty_slug(slug), naira(dish.uplift_kobo)),
                amount_kobo: guests * dish.uplift_kobo,
            });
        }
    }

    let total = lines.iter().map(|l| l.amount_kobo).sum::<i64>().max(0);

    let mut reason = if rate.note.trim().is_empty() {
        format!(
            "{} guests at {} per guest for {}.",
            guests,
            naira(rate.rate_kobo),
            pretty_slug(event_type)
        )
    } else {
        rate.note.trim().to_string()
    };

    if uplift_per_guest > 0 {
        reason.push_str(&format!(
            " The dishes you picked add {} per guest.",
            naira(uplift_per_guest)
        ));
    }

    Quote {
        deposit_kobo: total,
        reason,
        lines,
    }
}

fn quote_cook_only(pricing: &CateringPricing, dishes: &[String]) -> Quote {
    if dishes.is_empty() {
        return Quote {
            deposit_kobo: NO_RATE,
            reason: "Pick the dishes you want cooked and we will show the deposit.".into(),
            lines: Vec::new(),
        };
    }

    let mut lines = Vec::new();
    for slug in dishes {
        let rate = pricing
            .cook_rates
            .iter()
            .find(|c| &c.category_slug == slug)
            .map(|c| c.rate_kobo)
            .unwrap_or(NO_RATE);
        lines.push(QuoteLine {
            label: format!("{} cooked for you", pretty_slug(slug)),
            amount_kobo: rate,
        });
    }

    let total = lines.iter().map(|l| l.amount_kobo).sum::<i64>().max(0);
    let reason = if total == 0 {
        "Your caterer will confirm the deposit for these dishes.".to_string()
    } else {
        format!(
            "A cook making {} for you, priced per dish rather than per guest.",
            lines.len()
        )
    };

    Quote {
        deposit_kobo: total,
        reason,
        lines,
    }
}

/// `soups-swallow` reads badly to a customer, so turn slugs into words.
fn pretty_slug(slug: &str) -> String {
    let words: Vec<String> = slug
        .split(['-', '_'])
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect();
    words.join(" ")
}

fn naira(kobo: i64) -> String {
    let naira = kobo / 100;
    let mut digits = naira.to_string();
    let mut out = String::new();
    while digits.len() > 3 {
        let split = digits.len() - 3;
        out = format!(",{}{}", &digits[split..], out);
        digits.truncate(split);
    }
    format!("N{}{}", digits, out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pricing() -> CateringPricing {
        CateringPricing {
            rates: vec![
                CateringRate {
                    id: 1,
                    event_type: "birthday".into(),
                    rate_kobo: 150_000,
                    note: "Birthdays need serving staff and a cake table.".into(),
                    is_active: true,
                    sort_order: 1,
                },
                CateringRate {
                    id: 2,
                    event_type: "wedding".into(),
                    rate_kobo: 400_000,
                    note: String::new(),
                    is_active: true,
                    sort_order: 2,
                },
            ],
            dish_rates: vec![DishRate {
                id: 1,
                category_slug: "grills".into(),
                uplift_kobo: 50_000,
                note: String::new(),
            }],
            cook_rates: vec![CookRate {
                id: 1,
                category_slug: "soups-swallow".into(),
                rate_kobo: 1_200_000,
                note: String::new(),
            }],
        }
    }

    #[test]
    fn event_is_guests_times_rate() {
        let q = quote(&pricing(), "event", "birthday", 50, &[]);
        assert_eq!(q.deposit_kobo, 50 * 150_000);
        assert!(q.reason.contains("Birthdays need serving staff"));
    }

    #[test]
    fn dishes_raise_the_per_guest_rate() {
        let q = quote(&pricing(), "event", "birthday", 50, &["grills".into()]);
        assert_eq!(q.deposit_kobo, 50 * 150_000 + 50 * 50_000);
        assert!(q.reason.contains("add"));
    }

    #[test]
    fn unknown_event_quotes_zero_rather_than_guessing() {
        let q = quote(&pricing(), "event", "burial", 50, &[]);
        assert_eq!(q.deposit_kobo, 0);
        assert!(q.reason.contains("will confirm"));
    }

    #[test]
    fn cook_only_is_priced_per_dish_not_per_guest() {
        let q = quote(&pricing(), "cook_only", "", 0, &["soups-swallow".into()]);
        assert_eq!(q.deposit_kobo, 1_200_000);
    }

    #[test]
    fn cook_only_with_no_dishes_asks_for_dishes() {
        let q = quote(&pricing(), "cook_only", "", 0, &[]);
        assert_eq!(q.deposit_kobo, 0);
        assert!(q.reason.contains("Pick the dishes"));
    }

    #[test]
    fn custom_job_defers_to_the_caterer() {
        let q = quote(&pricing(), "custom", "", 0, &[]);
        assert_eq!(q.deposit_kobo, 0);
        assert!(q.reason.contains("confirm"));
    }

    #[test]
    fn slugs_become_readable_words() {
        assert_eq!(pretty_slug("soups-swallow"), "Soups Swallow");
        assert_eq!(pretty_slug("rice-grains"), "Rice Grains");
    }

    #[test]
    fn naira_groups_thousands() {
        assert_eq!(naira(150_000), "N1,500");
        assert_eq!(naira(1_200_000), "N12,000");
        assert_eq!(naira(0), "N0");
    }
}
