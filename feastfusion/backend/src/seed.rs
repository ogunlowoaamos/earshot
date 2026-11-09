use sqlx::SqlitePool;

use crate::auth::hash_password;

/// state, delivery fee in naira, lat, lng, radius km, active
const ZONES: &[(&str, i64, f64, f64, f64, bool)] = &[
    ("FCT Abuja", 2000, 9.0765, 7.3986, 30.0, true),
    ("Nasarawa", 3500, 8.4906, 7.7125, 55.0, true),
    ("Niger", 3500, 9.6139, 6.5569, 55.0, true),
    ("Kogi", 4000, 7.8023, 6.7333, 60.0, false),
    ("Kaduna", 4500, 10.5264, 7.4388, 75.0, false),
    ("Benue", 4500, 7.3369, 8.7404, 75.0, false),
    ("Plateau", 5000, 9.2182, 9.5179, 80.0, false),
];

const IMG: &str = "https://images.unsplash.com/photo-";

const CATEGORIES: &[(&str, &str, &str, i64)] = &[
    (
        "Rice & Grains",
        "rice-grains",
        "Smoky party pots, one-pot rice and grain bowls.",
        1,
    ),
    (
        "Soups & Swallow",
        "soups-swallow",
        "Rich Nigerian soups with fresh pounded swallow.",
        2,
    ),
    (
        "Grills & Proteins",
        "grills",
        "Charcoal-fired chicken, fish and beef.",
        3,
    ),
    (
        "Small Chops & Sides",
        "small-chops",
        "The things everyone reaches for first.",
        4,
    ),
    (
        "Breakfast & Pastries",
        "breakfast",
        "Slow mornings, warm from the oven.",
        5,
    ),
    (
        "Desserts",
        "desserts",
        "Chin chin, cakes and cold sweet things.",
        6,
    ),
    (
        "Drinks",
        "drinks",
        "Chilled zobo, chapman and fresh juice.",
        7,
    ),
];

/// name, category slug, price in naira, description, tags, featured, unsplash id
const ITEMS: &[(&str, &str, i64, &str, &str, bool, &str)] = &[
    (
        "Smoky Party Jollof",
        "rice-grains",
        4500,
        "Long-grain rice cooked down in a peppery tomato base over open flame, with that unmistakable party-pot smoke.",
        "bestseller, spicy",
        true,
        "1631515243349-e0cb75fb8d3a",
    ),
    (
        "Ofada Rice & Ayamase",
        "rice-grains",
        5200,
        "Local ofada rice with a fiery green pepper stew, assorted meat and boiled egg.",
        "spicy, local",
        false,
        "1604329760661-e71dc83f8f26",
    ),
    (
        "Coconut Fried Rice",
        "rice-grains",
        4800,
        "Fragrant rice toasted with coconut milk, sweetcorn, carrot and prawns.",
        "mild",
        false,
        "1606491956689-2ea866880c84",
    ),
    (
        "Native Jollof (Iwuk Edesi)",
        "rice-grains",
        5000,
        "Palm-oil rice simmered with dried fish, crayfish and scent leaf.",
        "local",
        false,
        "1512058564366-18510be2db19",
    ),
    (
        "Egusi Soup",
        "soups-swallow",
        5500,
        "Melon-seed soup with assorted meat, stockfish and bitter leaf, thick enough to hold.",
        "bestseller",
        true,
        "1547592180-85f173990554",
    ),
    (
        "Ogbono Soup",
        "soups-swallow",
        5300,
        "Drawy, rich ogbono with beef tripe and dried fish.",
        "local",
        false,
        "1504754524776-8f4f37790ca0",
    ),
    (
        "Efo Riro",
        "soups-swallow",
        5400,
        "Spinach stewed with locust bean, palm oil, assorted meat and smoked fish.",
        "spicy",
        false,
        "1476718406336-bb5a9690ee2a",
    ),
    (
        "Catfish Pepper Soup",
        "soups-swallow",
        6000,
        "Clear, hot catfish pepper soup with uziza and utazi leaves.",
        "spicy, hot",
        false,
        "1547592180-85f173990554",
    ),
    (
        "Pounded Yam",
        "soups-swallow",
        1500,
        "Smooth, stretchy pounded yam. Serves one.",
        "side",
        false,
        "1509440159596-0249088772ff",
    ),
    (
        "Eba (Garri)",
        "soups-swallow",
        1000,
        "Freshly turned garri swallow, wrapped warm.",
        "side",
        false,
        "1484723091739-30a097e8f929",
    ),
    (
        "Charcoal Grilled Chicken",
        "grills",
        7000,
        "Half chicken marinated overnight, grilled over charcoal until the skin blisters.",
        "bestseller, grill",
        true,
        "1519708227418-c8fd9a32b7a2",
    ),
    (
        "Suya Skewers",
        "grills",
        3500,
        "Yaji-spiced beef skewers with raw onion and tomato.",
        "spicy, street",
        true,
        "1544025162-d76694265947",
    ),
    (
        "Peppered Goat Meat",
        "grills",
        6500,
        "Goat meat tossed in a thick scotch bonnet and onion pepper sauce.",
        "spicy",
        false,
        "1504674900247-0877df9cc836",
    ),
    (
        "Grilled Tilapia",
        "grills",
        6200,
        "Whole tilapia scored, marinated and grilled, served with pepper dip.",
        "grill",
        false,
        "1467003909585-2f8a72700288",
    ),
    (
        "Small Chops Platter",
        "small-chops",
        4000,
        "Puff-puff, samosa, spring rolls, peppered gizzard and chin chin. Feeds two.",
        "sharing, bestseller",
        true,
        "1601050690597-df0568f70950",
    ),
    (
        "Dodo (Fried Plantain)",
        "small-chops",
        1200,
        "Sweet ripe plantain fried dark at the edges.",
        "side",
        false,
        "1565299624946-b28f40a0ae38",
    ),
    (
        "Moi Moi",
        "small-chops",
        1800,
        "Steamed bean pudding with egg and smoked fish in the middle.",
        "side",
        false,
        "1546069901-ba9599a7e63c",
    ),
    (
        "Akara & Pap",
        "breakfast",
        2200,
        "Crisp bean fritters with warm, slightly sour pap.",
        "breakfast",
        false,
        "1481931098730-318b6f776db0",
    ),
    (
        "Meat Pie",
        "breakfast",
        1300,
        "Flaky shortcrust filled with minced beef, potato and carrot.",
        "snack",
        false,
        "1555507036-ab1f4038808a",
    ),
    (
        "Chin Chin",
        "desserts",
        1500,
        "Crunchy fried dough cubes with a hint of nutmeg.",
        "snack, sharing",
        false,
        "1516684732162-798a0062be99",
    ),
    (
        "Coconut Candy",
        "desserts",
        1200,
        "Chewy caramelised coconut squares.",
        "snack",
        false,
        "1551024506-0bccd828d307",
    ),
    (
        "Zobo",
        "drinks",
        1000,
        "Hibiscus steeped with ginger and pineapple, served chilled.",
        "cold",
        false,
        "1544145945-f90425340c7e",
    ),
    (
        "Chapman",
        "drinks",
        1500,
        "The Nigerian classic: blackcurrant, orange, lemon and bitters over ice.",
        "cold, bestseller",
        true,
        "1497534446932-c925b458314e",
    ),
    (
        "Fresh Ginger Juice",
        "drinks",
        1200,
        "Pineapple, ginger and lime, blended and strained.",
        "cold",
        false,
        "1541783245831-57d6fb0926d3",
    ),
];

/// Ingredients per dish, keyed by dish name. Kept separate from `ITEMS` so the
/// long lists do not drown the price table. One ingredient per line, exactly as
/// the caterer would type it in the dashboard.
const INGREDIENTS: &[(&str, &str)] = &[
    (
        "Smoky Party Jollof",
        "Long-grain parboiled rice\nPlum tomatoes\nRed bell peppers\nScotch bonnet\nOnion\nTomato paste\nBay leaves\nCurry powder\nThyme\nChicken stock\nVegetable oil\nSalt",
    ),
    (
        "Ofada Rice & Ayamase",
        "Ofada rice\nGreen bell peppers\nScotch bonnet\nOnion\nLocust bean (iru)\nPalm oil\nAssorted meat\nBoiled egg\nStockfish\nSalt",
    ),
    (
        "Coconut Fried Rice",
        "Long-grain rice\nCoconut milk\nPrawns\nSweetcorn\nCarrot\nGreen beans\nSpring onion\nCurry powder\nThyme\nVegetable oil\nSalt",
    ),
    (
        "Native Jollof (Iwuk Edesi)",
        "Local rice\nPalm oil\nDried fish\nCrayfish\nScent leaf\nOnion\nScotch bonnet\nSmoked prawns\nSalt",
    ),
    (
        "Egusi Soup",
        "Ground melon seeds (egusi)\nAssorted meat\nStockfish\nBitter leaf\nPalm oil\nOnion\nScotch bonnet\nCrayfish\nSeasoning cubes\nSalt",
    ),
    (
        "Ogbono Soup",
        "Ground ogbono seeds\nBeef tripe\nDried fish\nPalm oil\nOnion\nCrayfish\nScent leaf\nSeasoning cubes\nSalt",
    ),
    (
        "Efo Riro",
        "Spinach\nLocust bean (iru)\nPalm oil\nAssorted meat\nSmoked fish\nOnion\nScotch bonnet\nCrayfish\nSalt",
    ),
    (
        "Catfish Pepper Soup",
        "Fresh catfish\nUziza leaves\nUtazi leaves\nGinger\nGarlic\nScent leaf\nPepper soup spice\nOnion\nSalt",
    ),
    (
        "Pounded Yam",
        "Yam\nWater\nSalt",
    ),
    (
        "Eba (Garri)",
        "Cassava garri\nHot water",
    ),
    (
        "Charcoal Grilled Chicken",
        "Half chicken\nGinger\nGarlic\nYaji spice\nPaprika\nOnion\nVegetable oil\nSalt",
    ),
    (
        "Suya Skewers",
        "Beef sirloin\nYaji spice\nGroundnut powder\nGinger\nGarlic\nOnion\nTomato\nVegetable oil\nSalt",
    ),
    (
        "Peppered Goat Meat",
        "Goat meat\nScotch bonnet\nOnion\nGreen bell pepper\nGinger\nGarlic\nVegetable oil\nSeasoning cubes\nSalt",
    ),
    (
        "Grilled Tilapia",
        "Whole tilapia\nGinger\nGarlic\nLemon\nYaji spice\nOnion\nVegetable oil\nSalt",
    ),
    (
        "Small Chops Platter",
        "Puff-puff dough\nSamosa pastry\nSpring roll pastry\nPeppered gizzard\nChin chin\nVegetable oil\nSalt",
    ),
    (
        "Dodo (Fried Plantain)",
        "Ripe plantain\nVegetable oil\nSalt",
    ),
    (
        "Moi Moi",
        "Peeled beans\nRed bell pepper\nOnion\nBoiled egg\nSmoked fish\nVegetable oil\nSalt",
    ),
    (
        "Akara & Pap",
        "Peeled beans\nOnion\nScotch bonnet\nVegetable oil\nFermented corn (pap)\nSugar\nSalt",
    ),
    (
        "Meat Pie",
        "Plain flour\nButter\nMinced beef\nPotato\nCarrot\nOnion\nEgg wash\nSalt",
    ),
    (
        "Chin Chin",
        "Plain flour\nSugar\nButter\nEgg\nNutmeg\nMilk\nVegetable oil\nSalt",
    ),
    (
        "Coconut Candy",
        "Fresh coconut\nSugar\nWater\nVanilla",
    ),
    (
        "Zobo",
        "Dried hibiscus petals\nGinger\nPineapple\nCloves\nSugar\nWater",
    ),
    (
        "Chapman",
        "Blackcurrant cordial\nOrange\nLemon\nCucumber\nAngostura bitters\nIce\nWater",
    ),
    (
        "Fresh Ginger Juice",
        "Pineapple\nFresh ginger\nLime\nWater",
    ),
];

/// Starting per-guest rates. The caterer edits these in the dashboard, so these
/// are only a sensible opening position, not a fixed price.
/// event type, naira per guest, reason shown to the customer
const EVENT_RATES: &[(&str, i64, &str)] = &[
    (
        "birthday",
        1500,
        "Birthdays need serving staff, a cake table and extra small chops, so the deposit is set per guest.",
    ),
    (
        "naming",
        1200,
        "Naming ceremonies are usually shorter and lighter on staff, so the per-guest rate is lower.",
    ),
    (
        "wedding",
        4000,
        "Weddings need a full service team, warmers and a tasting session, which is why the per-guest rate is highest.",
    ),
    (
        "corporate",
        2500,
        "Corporate jobs need timed delivery, branded packaging and an invoice, so they carry a mid per-guest rate.",
    ),
    (
        "burial",
        1800,
        "Burials are large and often outdoors, so we allow for extra warmers and transport.",
    ),
    (
        "anniversary",
        2000,
        "Anniversaries sit between a birthday and a wedding in staffing, so the rate reflects that.",
    ),
    (
        "cook_only",
        0,
        "A cook making dishes for you is priced per dish, not per guest.",
    ),
];

/// How much a dish category adds to the per-guest rate.
/// category slug, naira per guest
const DISH_UPLIFTS: &[(&str, i64)] = &[
    ("rice-grains", 0),
    ("soups-swallow", 200),
    ("grills", 500),
    ("small-chops", 300),
    ("breakfast", 100),
    ("desserts", 150),
    ("drinks", 100),
];

/// What a cook-only job costs for one dish of this category.
/// category slug, naira per dish
const COOK_RATES: &[(&str, i64)] = &[
    ("rice-grains", 12000),
    ("soups-swallow", 15000),
    ("grills", 18000),
    ("small-chops", 8000),
    ("breakfast", 6000),
    ("desserts", 7000),
    ("drinks", 5000),
];

pub async fn run(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    for (key, value) in [
        ("delivery_fee_kobo", "200000"),
        ("catering_deposit_kobo", "10000000"),
        ("whatsapp_number", "2348012345678"),
        ("bank_name", "Guaranty Trust Bank"),
        ("bank_account_name", "FeastFusion Kitchen Ltd"),
        ("bank_account_number", "0123456789"),
    ] {
        sqlx::query("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(value)
            .execute(pool)
            .await?;
    }

    let category_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM categories")
        .fetch_one(pool)
        .await?;

    if category_count == 0 {
        for (name, slug, description, sort_order) in CATEGORIES {
            sqlx::query(
                "INSERT OR IGNORE INTO categories (name, slug, description, sort_order)
                 VALUES (?, ?, ?, ?)",
            )
            .bind(name)
            .bind(slug)
            .bind(description)
            .bind(sort_order)
            .execute(pool)
            .await?;
        }
    }

    let item_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM menu_items")
        .fetch_one(pool)
        .await?;

    if item_count == 0 {
        for (name, category_slug, price_naira, description, tags, featured, photo) in ITEMS {
            let category_id: Option<i64> =
                sqlx::query_scalar("SELECT id FROM categories WHERE slug = ?")
                    .bind(category_slug)
                    .fetch_optional(pool)
                    .await?;

            let Some(category_id) = category_id else {
                continue;
            };

            sqlx::query(
                "INSERT INTO menu_items
                    (category_id, name, description, price_kobo, image_url, tags,
                     ingredients, is_available, is_featured)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
            )
            .bind(category_id)
            .bind(name)
            .bind(description)
            .bind(price_naira * 100)
            .bind(format!("{IMG}{photo}?auto=format&fit=crop&w=900&q=70"))
            .bind(tags)
            .bind(
                INGREDIENTS
                    .iter()
                    .find(|(dish, _)| dish == name)
                    .map(|(_, list)| *list)
                    .unwrap_or(""),
            )
            .bind(if *featured { 1 } else { 0 })
            .execute(pool)
            .await?;
        }
    }

    // Ingredients were added after the first dishes were seeded, so fill in any
    // dish that is still blank. This is what makes the feature appear on an
    // existing database without wiping it.
    for (dish, list) in INGREDIENTS {
        sqlx::query("UPDATE menu_items SET ingredients = ? WHERE name = ? AND ingredients = ''")
            .bind(list)
            .bind(dish)
            .execute(pool)
            .await?;
    }

    // A small chops platter is a pile of separate chops, so the customer picks
    // which ones and how many of each. This runs once: after that the caterer
    // owns the setting and a restart must not put it back.
    let chops_done: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM settings WHERE key = 'chops_count_once'")
            .fetch_one(pool)
            .await?;

    if chops_done == 0 {
        sqlx::query(
            "UPDATE item_option_groups SET allows_quantity = 1
             WHERE kind = 'multi'
               AND menu_item_id IN
                   (SELECT id FROM menu_items WHERE name = 'Small Chops Platter')",
        )
        .execute(pool)
        .await?;

        sqlx::query("INSERT OR IGNORE INTO settings (key, value) VALUES ('chops_count_once', '1')")
            .execute(pool)
            .await?;
    }

    for (index, (event_type, naira, note)) in EVENT_RATES.iter().enumerate() {
        sqlx::query(
            "INSERT OR IGNORE INTO catering_rates (event_type, rate_kobo, note, sort_order)
             VALUES (?, ?, ?, ?)",
        )
        .bind(event_type)
        .bind(naira * 100)
        .bind(note)
        .bind(index as i64)
        .execute(pool)
        .await?;
    }

    for (slug, naira) in DISH_UPLIFTS {
        sqlx::query(
            "INSERT OR IGNORE INTO catering_dish_rates (category_slug, uplift_kobo)
             VALUES (?, ?)",
        )
        .bind(slug)
        .bind(naira * 100)
        .execute(pool)
        .await?;
    }

    for (slug, naira) in COOK_RATES {
        sqlx::query(
            "INSERT OR IGNORE INTO catering_cook_rates (category_slug, rate_kobo)
             VALUES (?, ?)",
        )
        .bind(slug)
        .bind(naira * 100)
        .execute(pool)
        .await?;
    }

    let zone_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM delivery_zones")
        .fetch_one(pool)
        .await?;

    if zone_count == 0 {
        for (index, (state, fee_naira, lat, lng, radius_km, active)) in ZONES.iter().enumerate() {
            sqlx::query(
                "INSERT OR IGNORE INTO delivery_zones
                    (state, fee_kobo, lat, lng, radius_km, is_active, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(state)
            .bind(fee_naira * 100)
            .bind(lat)
            .bind(lng)
            .bind(radius_km)
            .bind(if *active { 1 } else { 0 })
            .bind(index as i64)
            .execute(pool)
            .await?;
        }
    }

    let admin_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM admin_users")
        .fetch_one(pool)
        .await?;

    if admin_count == 0 {
        let username = std::env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string());
        let password =
            std::env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "feastfusion123".to_string());

        sqlx::query("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)")
            .bind(&username)
            .bind(hash_password(&password)?)
            .execute(pool)
            .await?;

        tracing::info!("seeded admin account '{username}'");
    }

    crate::catalogue::seed_catalogue(pool).await?;

    Ok(())
}
