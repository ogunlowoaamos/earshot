//! The full Nigerian catalogue the caterer curates from.
//!
//! Nothing here is on sale the moment it lands. Every dish arrives switched off
//! and unpriced, and the caterer turns on what they actually cook and sets a
//! price. Until they do, the shop never shows it. That is what keeps a 200 dish
//! catalogue from bloating the customer menu.

use sqlx::SqlitePool;

/// name, slug, description, sort order
pub const CATEGORIES: &[(&str, &str, &str, i64)] = &[
    (
        "Rice Dishes",
        "rice-grains",
        "Smoky party pots, one pot rice and grain bowls.",
        1,
    ),
    (
        "Soups & Stews",
        "soups-swallow",
        "Rich Nigerian soups, from egusi to pepper soup.",
        2,
    ),
    (
        "Swallows",
        "swallows",
        "Pounded yam, amala, eba, semo, tuwo and fufu.",
        3,
    ),
    (
        "Grills",
        "grills",
        "Charcoal fired chicken, fish, suya and offal.",
        4,
    ),
    (
        "Small Chops",
        "small-chops",
        "The things everyone reaches for first.",
        5,
    ),
    (
        "Protein Dishes",
        "proteins",
        "Ponmo, shaki, bokoto, nkwobi, tofu and more.",
        6,
    ),
    (
        "Sauces & Dips",
        "sauces",
        "Stews and sauces that carry the plate.",
        7,
    ),
    (
        "Fast Food",
        "fast-food",
        "Pizza, burgers, shawarma, chips and wraps.",
        8,
    ),
    (
        "Pastries",
        "pastries",
        "Meat pie, sausage roll and scotch egg, warm from the oven.",
        9,
    ),
    (
        "Breakfast",
        "breakfast",
        "Slow mornings, warm from the pot.",
        10,
    ),
    (
        "Puddings & Porridges",
        "puddings",
        "Pap, moi moi, asaro and other soft bowls.",
        11,
    ),
    (
        "Salads",
        "salads",
        "Abacha, coleslaw, party salad and dressings.",
        12,
    ),
    (
        "Sides & Extras",
        "sides",
        "Plantain, dips, creams and add-ons.",
        13,
    ),
    (
        "Desserts & Sweets",
        "desserts",
        "Chin chin, pancakes and small sweets.",
        14,
    ),
    (
        "Cakes",
        "cakes",
        "Celebration cakes, icing and cupcake trays.",
        15,
    ),
    (
        "Drinks",
        "drinks",
        "Zobo, kunu, chapman, palm wine and fresh juice.",
        16,
    ),
];

/// One group of choices on a dish, as a template rather than a one off.
pub struct GroupSpec {
    pub name: &'static str,
    /// "single" means pick exactly one, "multi" means pick any number.
    pub kind: &'static str,
    pub help: &'static str,
    pub required: bool,
    pub options: &'static [&'static str],
}

const fn one(
    name: &'static str,
    help: &'static str,
    required: bool,
    options: &'static [&'static str],
) -> GroupSpec {
    GroupSpec {
        name,
        kind: "single",
        help,
        required,
        options,
    }
}

const fn many(
    name: &'static str,
    help: &'static str,
    options: &'static [&'static str],
) -> GroupSpec {
    GroupSpec {
        name,
        kind: "multi",
        help,
        required: false,
        options,
    }
}

/* ---------------- the choice templates ---------------- */

const PLATE: &[GroupSpec] = &[
    one(
        "Portion",
        "How much goes in the pack",
        true,
        &["Regular", "Large", "Family tray"],
    ),
    many(
        "Add-ons",
        "Pick as many as you want",
        &[
            "Extra chicken",
            "Extra beef",
            "Extra fish",
            "Extra ponmo",
            "Extra egg",
            "Extra stew",
        ],
    ),
];

const RICE: &[GroupSpec] = &[
    one(
        "Portion",
        "How much goes in the pack",
        true,
        &["Regular", "Large", "Family tray"],
    ),
    one(
        "Protein",
        "What comes on top",
        true,
        &["Chicken", "Beef", "Fish", "Assorted meat", "No protein"],
    ),
    many(
        "Add-ons",
        "Pick as many as you want",
        &["Extra protein", "Fried plantain", "Extra stew", "Extra egg", "Moi moi"],
    ),
];

const SOUP: &[GroupSpec] = &[
    one(
        "Portion",
        "How much goes in the pack",
        true,
        &["Small bowl", "Large bowl", "Family pot"],
    ),
    one(
        "Swallow",
        "Add a swallow on the side",
        true,
        &[
            "No swallow",
            "Pounded yam",
            "Eba",
            "Amala",
            "Semo",
            "Fufu",
            "Wheat",
        ],
    ),
    many(
        "Extras",
        "Pick as many as you want",
        &[
            "Extra meat",
            "Extra fish",
            "Extra ponmo",
            "Extra shaki",
            "Extra stockfish",
            "Extra pepper",
        ],
    ),
];

const SWALLOW: &[GroupSpec] = &[
    one(
        "Wraps",
        "How many wraps you want",
        true,
        &["2 wraps", "4 wraps", "6 wraps", "Party pack"],
    ),
    many(
        "Add-ons",
        "Pick as many as you want",
        &["Extra wrap", "Soup on the side", "Extra size"],
    ),
];

const TUB: &[GroupSpec] = &[one(
    "Portion",
    "How much goes in the tub",
    true,
    &["Small tub", "Medium tub", "Large tub"],
)];

const PASTRY: &[GroupSpec] = &[
    one(
        "Size",
        "Full size or the small party size",
        true,
        &["Full size", "Mini"],
    ),
    one(
        "Count",
        "How many in the pack",
        true,
        &["1", "6", "12", "20", "30"],
    ),
];

const SAUSAGE_ROLL: &[GroupSpec] = &[
    one(
        "Size",
        "Full size or the small party size",
        true,
        &["Full size", "Mini"],
    ),
    one(
        "Sausage roll count",
        "Number of sausage rolls in the pack",
        true,
        &["1", "2", "3", "6", "12", "20", "30"],
    ),
];

const COUNTED: &[GroupSpec] = &[
    one(
        "Pieces",
        "How many pieces in the pack",
        true,
        &["6", "12", "20", "30", "50"],
    ),
    many(
        "Dip",
        "Pick as many as you want",
        &["Pepper sauce", "Ketchup", "Mayonnaise", "No dip"],
    ),
];

const GRILL: &[GroupSpec] = &[
    one(
        "Portion",
        "How much of it you want",
        true,
        &["Quarter", "Half", "Full"],
    ),
    one(
        "Pieces",
        "Number of pieces in the pack",
        true,
        &["1", "2", "3", "6"],
    ),
    many(
        "Sides",
        "Pick as many as you want",
        &[
            "Pepper sauce",
            "Extra pepper",
            "Ketchup",
            "Onion rings",
            "Fried plantain",
        ],
    ),
];

const DRINK: &[GroupSpec] = &[
    one(
        "Size",
        "How much you want",
        true,
        &["50cl bottle", "1 litre bottle", "5 litre dispenser"],
    ),
    one(
        "Serve",
        "How it should arrive",
        true,
        &["Chilled", "Room temperature", "Hot"],
    ),
];

const SALAD: &[GroupSpec] = &[
    one(
        "Size",
        "How much you want",
        true,
        &["Small", "Medium", "Large", "Party tray"],
    ),
    one(
        "Dressing",
        "What goes on top",
        true,
        &[
            "Nigerian salad cream blend",
            "Mayonnaise",
            "Salad cream",
            "Vinaigrette",
            "No dressing",
        ],
    ),
];

const CAKE: &[GroupSpec] = &[
    one(
        "Size",
        "Pick the cake size",
        true,
        &[
            "6 inch",
            "8 inch",
            "10 inch",
            "12 inch",
            "2 tier",
            "3 tier",
        ],
    ),
    one(
        "Icing",
        "The finish on the outside",
        true,
        &[
            "Buttercream",
            "Fondant",
            "Whipped cream",
            "Ganache",
            "Cream cheese",
            "Royal icing",
        ],
    ),
    one(
        "Flavour",
        "What the sponge is baked with",
        true,
        &[
            "Vanilla",
            "Chocolate",
            "Red velvet",
            "Fruit",
            "Marble",
            "Coconut",
            "Lemon",
        ],
    ),
    many(
        "Finish",
        "Pick as many as you want",
        &[
            "Name on cake",
            "Edible photo print",
            "Fresh fruit",
            "Chocolate drip",
            "Cake topper",
            "Candles",
            "Cake board and box",
        ],
    ),
];

const PIZZA: &[GroupSpec] = &[
    one(
        "Size",
        "Pick the pizza size",
        true,
        &[
            "6 inch personal",
            "9 inch small",
            "12 inch medium",
            "15 inch large",
            "18 inch family",
        ],
    ),
    one(
        "Crust",
        "How the base is baked",
        true,
        &["Classic", "Thin", "Stuffed crust"],
    ),
    one(
        "Sausage",
        "Sausage on top",
        true,
        &["No sausage", "Regular sausage", "Extra sausage"],
    ),
    many(
        "Toppings",
        "Pick as many as you want",
        &[
            "Extra cheese",
            "Chicken",
            "Beef",
            "Pepperoni",
            "Sweetcorn",
            "Onions",
            "Mushroom",
            "Pineapple",
            "Extra pepper",
        ],
    ),
];

const BURGER: &[GroupSpec] = &[
    one(
        "Patty",
        "How many patties",
        true,
        &["Single", "Double", "Triple"],
    ),
    one(
        "Size",
        "On its own or as a combo",
        true,
        &["Regular", "Large combo"],
    ),
    many(
        "Extras",
        "Pick as many as you want",
        &[
            "Extra sausage",
            "Cheese",
            "Bacon",
            "Fried egg",
            "Extra patty",
            "Extra sauce",
        ],
    ),
];

const WRAP: &[GroupSpec] = &[
    one(
        "Size",
        "Pick the size",
        true,
        &["Regular", "Large"],
    ),
    one(
        "Protein",
        "What goes inside",
        true,
        &["Chicken", "Beef", "Mixed", "Vegetable only"],
    ),
    many(
        "Extras",
        "Pick as many as you want",
        &[
            "Extra sausage",
            "Extra cheese",
            "Extra sauce",
            "Extra vegetables",
            "Extra pepper",
        ],
    ),
];

const HOT_DOG: &[GroupSpec] = &[
    one("Size", "Pick the size", true, &["Regular", "Large"]),
    one(
        "Sausages",
        "How many sausages",
        true,
        &["1 sausage", "2 sausages", "3 sausages"],
    ),
    one(
        "Combo",
        "On its own or a combo",
        true,
        &["On its own", "Combo with chips and drink"],
    ),
];

const SANDWICH: &[GroupSpec] = &[
    one("Size", "Pick the size", true, &["Half", "Full"]),
    many(
        "Extras",
        "Pick as many as you want",
        &["Extra sausage", "Extra cheese", "Extra egg", "Extra vegetables"],
    ),
];

const FRIES: &[GroupSpec] = &[
    one(
        "Size",
        "Pick the size",
        true,
        &["Small", "Medium", "Large"],
    ),
    one(
        "Type",
        "How they are served",
        true,
        &["Regular", "Loaded", "Wedges"],
    ),
    many(
        "Dips",
        "Pick as many as you want",
        &["Ketchup", "Mayonnaise", "Pepper sauce", "Cheese sauce"],
    ),
];

const NUGGETS: &[GroupSpec] = &[
    one(
        "Pieces",
        "How many pieces in the pack",
        true,
        &["6", "9", "12", "20"],
    ),
    many(
        "Dips",
        "Pick as many as you want",
        &["Ketchup", "Mayonnaise", "Pepper sauce", "Cheese sauce"],
    ),
];

const PANCAKE: &[GroupSpec] = &[
    one(
        "Portion",
        "How many pancakes",
        true,
        &["Stack of 3", "Stack of 5", "Party tray"],
    ),
    many(
        "Toppings",
        "Pick as many as you want",
        &[
            "Syrup",
            "Honey",
            "Butter",
            "Peanut butter",
            "Chocolate",
            "Jam",
            "Condensed milk",
            "Fresh fruit",
            "Zobo syrup",
        ],
    ),
    many(
        "Fillings",
        "Pick as many as you want",
        &[
            "Fried egg",
            "Sausage",
            "Bacon",
            "Shredded beef",
            "Chicken",
            "Cheese",
            "Baked beans",
        ],
    ),
];

/// Which template of choices a dish gets.
#[derive(Clone, Copy)]
pub enum Shape {
    Plain,
    Plate,
    Rice,
    Soup,
    Swallow,
    Tub,
    Pastry,
    SausageRoll,
    Counted,
    Grill,
    Drink,
    Salad,
    Cake,
    Pizza,
    Burger,
    Wrap,
    HotDog,
    Sandwich,
    Fries,
    Nuggets,
    Pancake,
}

impl Shape {
    pub fn groups(self) -> &'static [GroupSpec] {
        match self {
            Shape::Plain => &[],
            Shape::Plate => PLATE,
            Shape::Rice => RICE,
            Shape::Soup => SOUP,
            Shape::Swallow => SWALLOW,
            Shape::Tub => TUB,
            Shape::Pastry => PASTRY,
            Shape::SausageRoll => SAUSAGE_ROLL,
            Shape::Counted => COUNTED,
            Shape::Grill => GRILL,
            Shape::Drink => DRINK,
            Shape::Salad => SALAD,
            Shape::Cake => CAKE,
            Shape::Pizza => PIZZA,
            Shape::Burger => BURGER,
            Shape::Wrap => WRAP,
            Shape::HotDog => HOT_DOG,
            Shape::Sandwich => SANDWICH,
            Shape::Fries => FRIES,
            Shape::Nuggets => NUGGETS,
            Shape::Pancake => PANCAKE,
        }
    }
}

/// name, category slug, shape, description, tags
///
/// Descriptions are the caterer's starting point. They read like menu copy and
/// stay short, so they hold up on a phone card.
pub const DISHES: &[(&str, &str, Shape, &str, &str)] = &[
    /* ---------------- rice dishes ---------------- */
    (
        "Fried Rice",
        "rice-grains",
        Shape::Rice,
        "Rice stir fried with sweetcorn, carrot, green peas and liver.",
        "party, mild",
    ),
    (
        "White Rice & Obe Ata",
        "rice-grains",
        Shape::Rice,
        "Plain steamed rice with a deep tomato and pepper stew.",
        "classic",
    ),
    (
        "Palm Oil Rice",
        "rice-grains",
        Shape::Rice,
        "One pot rice cooked in palm oil with crayfish and dried fish.",
        "local, spicy",
    ),
    (
        "Banga Rice",
        "rice-grains",
        Shape::Rice,
        "Rice simmered in fresh palm nut extract and native spices.",
        "local",
    ),
    (
        "Masa",
        "rice-grains",
        Shape::Rice,
        "Fermented rice cakes, soft in the middle, eaten with soup or sugar.",
        "northern, snack",
    ),
    (
        "Sinasir",
        "rice-grains",
        Shape::Rice,
        "Thin fermented rice pancake with a lacy crisp edge.",
        "northern",
    ),
    (
        "Pate",
        "rice-grains",
        Shape::Rice,
        "Ground corn and rice cooked soft with pepper and green leaves.",
        "northern",
    ),
    (
        "Danbu Rice",
        "rice-grains",
        Shape::Rice,
        "Ground rice and pepper dish from the north, served warm.",
        "northern",
    ),
    (
        "Curried Rice",
        "rice-grains",
        Shape::Rice,
        "Rice cooked with curry, turmeric and a little heat.",
        "mild",
    ),
    (
        "Groundnut Oil Rice",
        "rice-grains",
        Shape::Rice,
        "Rice cooked in groundnut oil with dried fish and pepper.",
        "local",
    ),
    /* ---------------- soups and stews ---------------- */
    (
        "Okra Soup",
        "soups-swallow",
        Shape::Soup,
        "Fresh okra cooked down with palm oil, fish and assorted meat.",
        "draw, spicy",
    ),
    (
        "Banga Soup",
        "soups-swallow",
        Shape::Soup,
        "Palm nut soup with catfish and native delta spices.",
        "delta",
    ),
    (
        "Atama Soup",
        "soups-swallow",
        Shape::Soup,
        "Palm kernel soup with waterleaf, periwinkle and smoked fish.",
        "delta",
    ),
    (
        "Edikang Ikong",
        "soups-swallow",
        Shape::Soup,
        "Waterleaf and ugu cooked with beef, stockfish and periwinkle.",
        "calabar",
    ),
    (
        "Afang Soup",
        "soups-swallow",
        Shape::Soup,
        "Afang leaves and waterleaf with assorted meat and dried fish.",
        "calabar",
    ),
    (
        "Oha Soup",
        "soups-swallow",
        Shape::Soup,
        "Oha leaves in a thick cocoyam base with assorted meat.",
        "igbo",
    ),
    (
        "Bitterleaf Soup",
        "soups-swallow",
        Shape::Soup,
        "Bitterleaf washed and cooked with cocoyam, beef and stockfish.",
        "igbo",
    ),
    (
        "Nsala (White Soup)",
        "soups-swallow",
        Shape::Soup,
        "Pale, peppery soup with catfish and utazi leaves.",
        "igbo",
    ),
    (
        "Ofe Owerri",
        "soups-swallow",
        Shape::Soup,
        "Rich Owerri soup with assorted meat, snail and stockfish.",
        "igbo, premium",
    ),
    (
        "Goat Meat Pepper Soup",
        "soups-swallow",
        Shape::Soup,
        "Light peppery broth with goat meat and native spices.",
        "hot",
    ),
    (
        "Chicken Pepper Soup",
        "soups-swallow",
        Shape::Soup,
        "Clear peppery broth with chicken and scent leaf.",
        "hot",
    ),
    (
        "Groundnut Soup",
        "soups-swallow",
        Shape::Soup,
        "Groundnut soup with beef and a warm northern spice mix.",
        "northern",
    ),
    (
        "Miyan Kuka",
        "soups-swallow",
        Shape::Soup,
        "Baobab leaf soup with beef and daddawa.",
        "northern",
    ),
    (
        "Miyan Taushe",
        "soups-swallow",
        Shape::Soup,
        "Pumpkin and groundnut soup cooked with beef.",
        "northern",
    ),
    (
        "Miyan Zogale",
        "soups-swallow",
        Shape::Soup,
        "Moringa leaf soup cooked with beef and spices.",
        "northern",
    ),
    (
        "Black Soup",
        "soups-swallow",
        Shape::Soup,
        "Dark Edo soup with beef, smoked fish and native herbs.",
        "edo",
    ),
    (
        "Owo Soup",
        "soups-swallow",
        Shape::Soup,
        "Edo soup thickened with potash and smoked fish.",
        "edo",
    ),
    (
        "Ukodo",
        "soups-swallow",
        Shape::Soup,
        "Yam and plantain pepper soup pottage with dried fish.",
        "delta",
    ),
    (
        "Ewedu",
        "soups-swallow",
        Shape::Soup,
        "Jute leaf soup blended smooth, served with gbegiri.",
        "yoruba",
    ),
    (
        "Gbegiri",
        "soups-swallow",
        Shape::Soup,
        "Bean soup cooked soft, the partner to ewedu.",
        "yoruba",
    ),
    (
        "Okoho Soup",
        "soups-swallow",
        Shape::Soup,
        "Draw soup from Idoma land, cooked with beef and dried fish.",
        "benue",
    ),
    (
        "Esa Soup",
        "soups-swallow",
        Shape::Soup,
        "Beniseed soup with beef and scent leaf.",
        "middle belt",
    ),
    (
        "Abula",
        "soups-swallow",
        Shape::Soup,
        "Gbegiri and ewedu together, the classic amala pairing.",
        "yoruba",
    ),
    /* ---------------- swallows ---------------- */
    (
        "Amala",
        "swallows",
        Shape::Swallow,
        "Dark yam flour swallow, smooth and soft.",
        "yoruba",
    ),
    (
        "Poundo Yam",
        "swallows",
        Shape::Swallow,
        "Instant pounded yam, smooth and stretchy.",
        "quick",
    ),
    (
        "Fufu (Akpu)",
        "swallows",
        Shape::Swallow,
        "Fermented cassava swallow, soft with a faint sour note.",
        "igbo",
    ),
    (
        "Lafun",
        "swallows",
        Shape::Swallow,
        "Cassava flour swallow, plain and light.",
        "yoruba",
    ),
    (
        "Pupuru",
        "swallows",
        Shape::Swallow,
        "Smoked cassava swallow from the Niger Delta.",
        "delta",
    ),
    (
        "Sakoro (Tuwon Sakoro)",
        "swallows",
        Shape::Swallow,
        "Golden cassava tuwo, smooth and firm.",
        "northern",
    ),
    (
        "Semo (Semolina)",
        "swallows",
        Shape::Swallow,
        "Wheat semolina swallow, smooth and filling.",
        "classic",
    ),
    (
        "Semovita",
        "swallows",
        Shape::Swallow,
        "Semolina blend swallow, soft and easy to roll.",
        "classic",
    ),
    (
        "Wheat Swallow (Tuwon Alkama)",
        "swallows",
        Shape::Swallow,
        "Whole wheat swallow, nutty and firm.",
        "healthy",
    ),
    (
        "Oat Swallow",
        "swallows",
        Shape::Swallow,
        "Oat flour swallow for a lighter plate.",
        "healthy",
    ),
    (
        "Tuwo Shinkafa",
        "swallows",
        Shape::Swallow,
        "Rice tuwo, soft and mild, served with miyan kuka.",
        "northern",
    ),
    (
        "Tuwo Masara",
        "swallows",
        Shape::Swallow,
        "Corn tuwo from the north, firm and filling.",
        "northern",
    ),
    (
        "Tuwo Dawa",
        "swallows",
        Shape::Swallow,
        "Sorghum tuwo, deep in colour with a nutty taste.",
        "northern",
    ),
    (
        "Tuwo Gero",
        "swallows",
        Shape::Swallow,
        "Millet tuwo, light and mild.",
        "northern",
    ),
    (
        "Plantain Fufu",
        "swallows",
        Shape::Swallow,
        "Ripe plantain swallow with a faint sweetness.",
        "modern",
    ),
    (
        "Plantain Amala",
        "swallows",
        Shape::Swallow,
        "Amala blended with plantain for a softer taste.",
        "modern",
    ),
    (
        "Cocoyam Fufu",
        "swallows",
        Shape::Swallow,
        "Cocoyam swallow, smooth with a gentle nutty note.",
        "modern",
    ),
    (
        "Potato Fufu",
        "swallows",
        Shape::Swallow,
        "Irish potato swallow, pale and soft.",
        "modern",
    ),
    (
        "Coconut Fufu",
        "swallows",
        Shape::Swallow,
        "Cassava swallow with coconut milk folded in.",
        "modern",
    ),
    (
        "Banana Fufu",
        "swallows",
        Shape::Swallow,
        "Banana swallow with a soft sweet finish.",
        "modern",
    ),
    (
        "Breadfruit Fufu",
        "swallows",
        Shape::Swallow,
        "Breadfruit swallow, starchy and smooth.",
        "modern",
    ),
    (
        "Starch (Usi)",
        "swallows",
        Shape::Swallow,
        "Delta starch, pale and stretchy, served with banga.",
        "delta",
    ),
    (
        "Nni Oka",
        "swallows",
        Shape::Swallow,
        "Corn swallow from the east, firm and mild.",
        "igbo",
    ),
    (
        "Carrot Fufu",
        "swallows",
        Shape::Swallow,
        "Cassava swallow with carrot for colour and sweetness.",
        "modern",
    ),
    (
        "Rice Fufu",
        "swallows",
        Shape::Swallow,
        "Rice flour swallow, very light on the plate.",
        "modern",
    ),
    (
        "Broccoli Swallow",
        "swallows",
        Shape::Swallow,
        "Cassava swallow with broccoli blended in.",
        "modern",
    ),
];
