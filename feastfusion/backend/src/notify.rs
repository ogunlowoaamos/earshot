use serde_json::json;

use crate::models::{CateringRequest, Order};

pub fn naira(kobo: i64) -> String {
    let naira = kobo / 100;
    let digits = naira.abs().to_string();
    let mut grouped = String::new();

    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(ch);
    }

    let sign = if naira < 0 { "-" } else { "" };
    format!("{sign}\u{20a6}{grouped}")
}

pub fn order_text(order: &Order) -> String {
    let mut lines = vec![
        format!("NEW ORDER {}", order.row.reference),
        String::new(),
        format!("Name: {}", order.row.customer_name),
        format!("Phone: {}", order.row.customer_phone),
    ];

    if !order.row.customer_email.is_empty() {
        lines.push(format!("Email: {}", order.row.customer_email));
    }

    lines.push(format!("Type: {}", order.row.order_type));

    if let Some(address) = &order.row.delivery_address {
        if !address.is_empty() {
            lines.push(format!("Address: {address}"));
        }
    }

    lines.push(String::new());
    lines.push("ITEMS".to_string());

    for line in &order.items {
        let line_total = line.unit_price_kobo * line.qty;
        lines.push(format!(
            "{} x {} = {}",
            line.qty,
            line.name,
            naira(line_total)
        ));
    }

    lines.push(String::new());
    lines.push(format!("Subtotal: {}", naira(order.row.subtotal_kobo)));
    lines.push(format!("Delivery: {}", naira(order.row.delivery_fee_kobo)));
    lines.push(format!("TOTAL: {}", naira(order.row.total_kobo)));
    lines.push(format!("Payment: {}", order.row.payment_method));

    if let Some(notes) = &order.row.notes {
        if !notes.is_empty() {
            lines.push(String::new());
            lines.push(format!("Notes: {notes}"));
        }
    }

    lines.join("\n")
}

pub fn catering_text(request: &CateringRequest) -> String {
    let mut lines = vec![
        format!("NEW CATERING REQUEST {}", request.reference),
        String::new(),
        format!("Name: {}", request.name),
        format!("Phone: {}", request.phone),
        format!(
            "Prefers: {} ({})",
            request.contact_channel, request.contact_handle
        ),
        format!("Job: {}", request.job_kind),
        format!("Event: {}", request.event_type),
        format!("Date: {}", request.event_date),
        format!("Guests: {}", request.guest_count),
        format!("Location: {}", request.location),
    ];

    if !request.dishes.is_empty() {
        lines.push(format!("Dishes: {}", request.dishes));
    }
    if !request.other_dishes.is_empty() {
        lines.push(format!("Also wants: {}", request.other_dishes));
    }
    if !request.allergies.is_empty() {
        lines.push(format!("Allergies: {}", request.allergies));
    }
    if !request.picked_dishes.is_empty() {
        lines.push(format!("Dishes picked: {}", request.picked_dishes));
    }

    lines.push(format!("Deposit: {}", naira(request.deposit_kobo)));
    if !request.deposit_reason.is_empty() {
        lines.push(format!("Why: {}", request.deposit_reason));
    }

    if let Some(budget) = request.budget_kobo {
        lines.push(format!("Budget: {}", naira(budget)));
    }

    if let Some(details) = &request.details {
        if !details.is_empty() {
            lines.push(String::new());
            lines.push(format!("Details: {details}"));
        }
    }

    lines.join("\n")
}

/// Fire-and-forget delivery. Every channel is optional; anything not
/// configured in the environment is simply skipped.
pub fn dispatch(subject: String, body: String) {
    let text = format!("{subject}\n\n{body}");

    tokio::spawn(async move {
        let client = reqwest::Client::new();

        if let (Ok(token), Ok(chat_id)) = (
            std::env::var("TELEGRAM_BOT_TOKEN"),
            std::env::var("TELEGRAM_CHAT_ID"),
        ) {
            let url = format!("https://api.telegram.org/bot{token}/sendMessage");
            match client
                .post(&url)
                .json(&json!({ "chat_id": chat_id, "text": text }))
                .send()
                .await
            {
                Ok(res) if res.status().is_success() => tracing::info!("telegram delivered"),
                Ok(res) => tracing::warn!("telegram rejected: {}", res.status()),
                Err(e) => tracing::warn!("telegram failed: {e}"),
            }
        }

        if let (Ok(phone_id), Ok(token), Ok(to)) = (
            std::env::var("WHATSAPP_PHONE_ID"),
            std::env::var("WHATSAPP_TOKEN"),
            std::env::var("WHATSAPP_TO"),
        ) {
            let url = format!("https://graph.facebook.com/v20.0/{phone_id}/messages");
            match client
                .post(&url)
                .bearer_auth(token)
                .json(&json!({
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "text",
                    "text": { "body": text }
                }))
                .send()
                .await
            {
                Ok(res) if res.status().is_success() => tracing::info!("whatsapp delivered"),
                Ok(res) => tracing::warn!("whatsapp rejected: {}", res.status()),
                Err(e) => tracing::warn!("whatsapp failed: {e}"),
            }
        }

        if let (Ok(api_key), Ok(to)) = (std::env::var("RESEND_API_KEY"), std::env::var("MAIL_TO")) {
            let from = std::env::var("MAIL_FROM")
                .unwrap_or_else(|_| "FeastFusion <onboarding@resend.dev>".to_string());

            match client
                .post("https://api.resend.com/emails")
                .bearer_auth(api_key)
                .json(&json!({
                    "from": from,
                    "to": [to],
                    "subject": subject,
                    "text": text
                }))
                .send()
                .await
            {
                Ok(res) if res.status().is_success() => tracing::info!("email delivered"),
                Ok(res) => tracing::warn!("email rejected: {}", res.status()),
                Err(e) => tracing::warn!("email failed: {e}"),
            }
        }
    });
}
