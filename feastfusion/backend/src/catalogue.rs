//! The full Nigerian catalogue the caterer curates from.
//!
//! Nothing here is on sale the moment it lands. Every dish arrives switched off
//! and unpriced, and the caterer turns on what they actually cook and sets a
//! price. Until they do, the shop never shows it. That is what keeps a 200 dish
//! catalogue from bloating the customer menu.

use sqlx::SqlitePool;

/// name, slug, description, sort order
///
/// The order is the order a Nigerian customer actually eats in: breakfast
/// first, then the rice and soup plates that carry most orders, then the party
/// food, then the extras and sweets. The menu chips and the catering dish list
/// both read this order, so it is the single place to change it.
pub const CATEGORIES: &[(&str, &str, &str, i64)] = &[
    (
        "Breakfast",
        "breakfast",
        "Slow mornings, warm from the pot.",
        1,
    ),
    (
        "Rice Dishes",
        "rice-grains",
        "Smoky party pots, one pot rice and grain bowls.",
        2,
    ),
    (
        "Soups & Stews",
        "soups-swallow",
        "Rich Nigerian soups, slow cooked and thick.",
        3,
    ),
    (
        "Swallows",
        "swallows",
        "Pounded yam, eba, fufu, amala and the rest of the plate.",
        4,
    ),
    (
        "Grills",
        "grills",
        "Charcoal fired chicken, fish, suya and offal.",
        5,
    ),
    (
        "Small Chops",
        "small-chops",
        "The things everyone reaches for first.",
        6,
    ),
    (
        "Pasta & Noodles",
        "pasta-noodles",
        "Jollof spaghetti, creamy pasta, Indomie and stir fried noodles.",
        7,
    ),
    (
        "Fast Food",
        "fast-food",
        "Pizza, burgers, shawarma, chips and wraps.",
        8,
    ),
    (
        "Proteins",
        "proteins",
        "Ponmo, shaki, bokoto, nkwobi, tofu and more.",
        9,
    ),
    (
        "Sides & Extras",
        "sides",
        "Plantain, dips, creams and add-ons.",
        10,
    ),
    (
        "Sauces & Dips",
        "sauces",
        "Stews and sauces that carry the plate.",
        11,
    ),
    (
        "Salads",
        "salads",
        "Abacha, coleslaw, party salad and dressings.",
        12,
    ),
    (
        "Pastries",
        "pastries",
        "Meat pie, sausage roll and scotch egg, warm from the oven.",
        13,
    ),
    (
        "Puddings & Porridges",
        "puddings",
        "Pap, moi moi, asaro and other soft bowls.",
        14,
    ),
    (
        "Desserts & Sweets",
        "desserts",
        "Chin chin, pancakes and small sweets.",
        15,
    ),
    (
        "Cakes",
        "cakes",
        "Celebration cakes, icing and cupcake trays.",
        16,
    ),
    (
        "Drinks",
        "drinks",
        "Zobo, kunu, chapman, palm wine and fresh juice.",
        17,
    ),
];

/// What goes with what, as a starting point.
///
/// Each pair reads "when the customer picks the first category, offer them the
/// second as a companion". These are only defaults. The caterer edits them from
/// the admin page and their version wins, because the seeder only tops the list
/// up once per catalogue revision and never touches it again after that.
///
/// The logic is how a Nigerian plate is actually built: soup wants a swallow
/// first and then something to drink, a swallow wants the soup back, rice wants
/// a grill and a side, small chops want a drink, and a drink is the end of the
/// chain rather than the start of one.
pub const PAIRINGS: &[(&str, &str)] = &[
    ("soups-swallow", "swallows"),
    ("breakfast", "drinks"),
    ("breakfast", "pastries"),
    ("breakfast", "puddings"),
    ("rice-grains", "grills"),
    ("rice-grains", "proteins"),
    ("rice-grains", "sides"),
    ("rice-grains", "salads"),
    ("rice-grains", "drinks"),
    ("soups-swallow", "proteins"),
    ("soups-swallow", "sides"),
    ("soups-swallow", "drinks"),
    ("swallows", "soups-swallow"),
    ("swallows", "proteins"),
    ("swallows", "sides"),
    ("swallows", "drinks"),
    ("grills", "sides"),
    ("grills", "sauces"),
    ("grills", "salads"),
    ("grills", "drinks"),
    ("small-chops", "sauces"),
    ("small-chops", "salads"),
    ("small-chops", "drinks"),
    ("pasta-noodles", "proteins"),
    ("pasta-noodles", "sides"),
    ("pasta-noodles", "drinks"),
    ("fast-food", "sides"),
    ("fast-food", "sauces"),
    ("fast-food", "drinks"),
    ("proteins", "sides"),
    ("proteins", "sauces"),
    ("proteins", "drinks"),
    ("sides", "sauces"),
    ("sides", "drinks"),
    ("sauces", "sides"),
    ("salads", "grills"),
    ("salads", "drinks"),
    ("pastries", "drinks"),
    ("pastries", "breakfast"),
    ("puddings", "breakfast"),
    ("puddings", "drinks"),
    ("desserts", "drinks"),
    ("desserts", "cakes"),
    ("cakes", "drinks"),
    ("cakes", "desserts"),
];

/// One group of choices on a dish, as a template rather than a one off.
pub struct GroupSpec {
    pub name: &'static str,
    /// "single" means pick exactly one, "multi" means pick any number.
    pub kind: &'static str,
    pub help: &'static str,
    pub required: bool,
    /// True when each choice gets its own how-many stepper.
    pub allows_quantity: bool,
    /// When set, the choices are the switched-on dishes of this category rather
    /// than the list below. The caterer keeps one chop list, in the catalogue,
    /// and every dish that offers chops reads it.
    pub source_category: &'static str,
    /// True when the group also asks the customer to type their own answer, for
    /// example "Custom" on a portion.
    pub free_text: bool,
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
        allows_quantity: false,
        source_category: "",
        free_text: false,
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
        allows_quantity: false,
        source_category: "",
        free_text: false,
        options,
    }
}

/// A counted group whose choices are whatever the caterer has switched on in
/// one category. Nothing is typed twice, so the platter can never fall behind
/// the chop list in the catalogue.
const fn counted_from(
    name: &'static str,
    help: &'static str,
    required: bool,
    category: &'static str,
) -> GroupSpec {
    GroupSpec {
        name,
        kind: "multi",
        help,
        required,
        allows_quantity: true,
        source_category: category,
        free_text: false,
        options: &[],
    }
}

/// A portion that is either the house standard or whatever the customer asks
/// for. "Custom" opens a box so they can say the size and the amount in their
/// own words, which is the only way a portion can fit every dish.
const fn portion_custom(help: &'static str) -> GroupSpec {
    GroupSpec {
        name: "Portion",
        kind: "single",
        help,
        required: true,
        allows_quantity: false,
        source_category: "",
        free_text: true,
        options: &["Standard", "Custom"],
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
        &[
            "Extra protein",
            "Fried plantain",
            "Extra stew",
            "Extra egg",
            "Moi moi",
        ],
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

const TUB: &[GroupSpec] = &[portion_custom("The house tub, or tell us the size you want")];

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
    portion_custom("The house cut, or tell us how much you want"),
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
        &["6 inch", "8 inch", "10 inch", "12 inch", "2 tier", "3 tier"],
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
    one("Size", "Pick the size", true, &["Regular", "Large"]),
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
        &[
            "Extra sausage",
            "Extra cheese",
            "Extra egg",
            "Extra vegetables",
        ],
    ),
];

const FRIES: &[GroupSpec] = &[
    one("Size", "Pick the size", true, &["Small", "Medium", "Large"]),
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

const PASTA: &[GroupSpec] = &[
    one(
        "Portion",
        "How much goes in the pack",
        true,
        &["Regular", "Large", "Family tray"],
    ),
    one(
        "Protein",
        "What goes in with the pasta",
        true,
        &[
            "Chicken",
            "Beef",
            "Turkey",
            "Fish",
            "Sausage",
            "Corned beef",
            "Minced meat",
            "Meatballs",
            "Shrimp",
            "Egg",
            "Gizzard",
            "Liver",
            "No protein",
        ],
    ),
    one(
        "Sausage count",
        "How many sausages to add",
        true,
        &["0", "1", "2", "3", "4"],
    ),
    many(
        "Add-ons",
        "Pick as many as you want",
        &[
            "Extra cheese",
            "Extra egg",
            "Extra chicken",
            "Extra beef",
            "Extra pepper",
            "Extra sauce",
        ],
    ),
];

const NOODLES: &[GroupSpec] = &[
    one(
        "Portion",
        "How much goes in the pack",
        true,
        &["Regular", "Large", "Family pack"],
    ),
    one(
        "Style",
        "How the noodles are cooked",
        true,
        &[
            "Plain",
            "Jollof",
            "Fried",
            "Stir fry",
            "Stew",
            "Egg sauce",
            "Pepper sauce",
            "Soup",
        ],
    ),
    one(
        "Sausage count",
        "How many sausages to add",
        true,
        &["0", "1", "2", "3", "4"],
    ),
    many(
        "Add-ons",
        "Pick as many as you want",
        &[
            "Egg",
            "Chicken",
            "Beef",
            "Turkey",
            "Fish",
            "Corned beef",
            "Vegetables",
            "Beans",
            "Plantain",
            "Moi moi",
            "Akara",
            "Liver",
            "Gizzard",
            "Shrimp",
            "Cheese",
        ],
    ),
];

const NOODLE_BOWL: &[GroupSpec] = &[
    one(
        "Portion",
        "How much goes in the bowl",
        true,
        &["Regular", "Large", "Family pot"],
    ),
    one(
        "Protein",
        "What goes in with the noodles",
        true,
        &["Chicken", "Beef", "Shrimp", "Vegetables", "No protein"],
    ),
    many(
        "Add-ons",
        "Pick as many as you want",
        &[
            "Extra egg",
            "Extra protein",
            "Extra vegetables",
            "Chilli oil",
            "Extra broth",
        ],
    ),
];

/// A platter is a pile of separate chops, not one portion, so the customer
/// builds it: how many puff-puff, how many samosa, and so on. The chop list is
/// the caterer's own Small Chops category, so adding a chop there is enough.
/// There is no Portion group: the chop counts already say how big it is.
const CHOPS: &[GroupSpec] = &[counted_from(
    "Chops",
    "Say how many of each chop you want",
    true,
    "small-chops",
)];

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
    Pasta,
    Noodles,
    NoodleBowl,
    Chops,
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
            Shape::Pasta => PASTA,
            Shape::Noodles => NOODLES,
            Shape::NoodleBowl => NOODLE_BOWL,
            Shape::Chops => CHOPS,
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
        "Smoky Party Jollof",
        "rice-grains",
        Shape::Rice,
        "Long grain rice cooked down in a smoky tomato and pepper base.",
        "party, classic",
    ),
    (
        "Ofada Rice & Ayamase",
        "rice-grains",
        Shape::Rice,
        "Unpolished local rice served with a green pepper designer stew.",
        "local, spicy",
    ),
    (
        "Coconut Fried Rice",
        "rice-grains",
        Shape::Rice,
        "Fragrant rice toasted with coconut milk, sweetcorn, carrot and prawns.",
        "mild",
    ),
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
        "Native Jollof (Iwuk Edesi)",
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
        "Egusi Soup",
        "soups-swallow",
        Shape::Soup,
        "Melon seed soup cooked with palm oil, spinach and assorted meat.",
        "classic",
    ),
    (
        "Ogbono Soup",
        "soups-swallow",
        Shape::Soup,
        "Draw soup from ground ogbono seeds with beef and dried fish.",
        "draw",
    ),
    (
        "Efo Riro",
        "soups-swallow",
        Shape::Soup,
        "Rich Yoruba spinach stew with pepper, locust bean and assorted meat.",
        "yoruba, spicy",
    ),
    (
        "Catfish Pepper Soup",
        "soups-swallow",
        Shape::Soup,
        "Light peppery broth with fresh catfish and scent leaf.",
        "light, spicy",
    ),
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
        "Pounded Yam",
        "swallows",
        Shape::Swallow,
        "Smooth, stretchy pounded yam, the classic soup partner.",
        "classic",
    ),
    (
        "Eba (Garri)",
        "swallows",
        Shape::Swallow,
        "Garri turned in hot water, firm and slightly tangy.",
        "classic, quick",
    ),
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
    /* ---------------- grills ---------------- */
    (
        "Suya Skewers",
        "grills",
        Shape::Grill,
        "Beef skewers rubbed with yaji spice and grilled over charcoal.",
        "street, spicy",
    ),
    (
        "Asun",
        "grills",
        Shape::Tub,
        "Smoked goat meat tossed in a hot pepper and onion mix.",
        "spicy",
    ),
    (
        "Peppered Goat Meat",
        "grills",
        Shape::Tub,
        "Goat meat boiled soft then fried and tossed in pepper sauce.",
        "spicy",
    ),
    (
        "Grilled Tilapia",
        "grills",
        Shape::Grill,
        "Whole tilapia or croaker grilled with pepper and onion.",
        "seafood",
    ),
    (
        "Charcoal Grilled Chicken",
        "grills",
        Shape::Grill,
        "Chicken marinated overnight and grilled until the skin crisps.",
        "party",
    ),
    (
        "Bole",
        "grills",
        Shape::Counted,
        "Roasted plantain served with groundnut and pepper sauce.",
        "street",
    ),
    (
        "Peppered Snail",
        "grills",
        Shape::Counted,
        "Snail grilled then tossed in a thick pepper sauce.",
        "spicy",
    ),
    (
        "Peppered Turkey",
        "grills",
        Shape::Tub,
        "Turkey roasted and finished in a hot pepper stew.",
        "party",
    ),
    (
        "BBQ Rack of Ribs",
        "grills",
        Shape::Grill,
        "Pork ribs glazed and grilled until sticky.",
        "western",
    ),
    (
        "Mixed Grill Platter",
        "grills",
        Shape::Plate,
        "Chicken, beef, fish and gizzard on one sharing platter.",
        "party, sharing",
    ),
    /* ---------------- small chops ---------------- */
    (
        "Dodo (Fried Plantain)",
        "small-chops",
        Shape::Tub,
        "Sweet ripe plantain fried until the edges caramelise.",
        "side, sweet",
    ),
    (
        "Samosa",
        "small-chops",
        Shape::Counted,
        "Crisp pastry triangles filled with spiced mince and peas.",
        "party",
    ),
    (
        "Spring Rolls",
        "small-chops",
        Shape::Counted,
        "Thin rolls packed with cabbage and carrot, fried golden.",
        "party",
    ),
    (
        "Gizdodo",
        "small-chops",
        Shape::Tub,
        "Fried gizzard and ripe plantain in a pepper sauce.",
        "spicy, party",
    ),
    (
        "Peppered Gizzard",
        "small-chops",
        Shape::Tub,
        "Gizzard fried then tossed in a thick pepper sauce.",
        "spicy",
    ),
    (
        "Mini Meat Pie",
        "small-chops",
        Shape::Pastry,
        "Bite sized meat pies with a soft buttery crust.",
        "party",
    ),
    (
        "Mini Sausage Roll",
        "small-chops",
        Shape::SausageRoll,
        "Small sausage rolls, the party tray favourite.",
        "party",
    ),
    (
        "Mini Fish Roll",
        "small-chops",
        Shape::Pastry,
        "Small rolls filled with seasoned shredded fish.",
        "party",
    ),
    (
        "Peppered Chicken",
        "small-chops",
        Shape::Counted,
        "Chicken pieces fried and coated in pepper sauce.",
        "spicy",
    ),
    (
        "Kebab Sticks",
        "small-chops",
        Shape::Counted,
        "Skewers of beef and onion, grilled to order.",
        "street",
    ),
    (
        "Battered Fish",
        "small-chops",
        Shape::Counted,
        "Fish fillets in a light batter, fried until crisp.",
        "seafood",
    ),
    (
        "Moneybag",
        "small-chops",
        Shape::Counted,
        "Pastry pouches tied at the top and filled with mince.",
        "party",
    ),
    (
        "Corndog",
        "small-chops",
        Shape::Counted,
        "Sausage on a stick in a soft fried batter.",
        "street",
    ),
    (
        "Plantain Mosa",
        "small-chops",
        Shape::Counted,
        "Ripe plantain fritters, sweet and soft inside.",
        "street",
    ),
    (
        "Small Chops Platter",
        "small-chops",
        Shape::Chops,
        "Puff-puff, samosa, spring rolls, peppered gizzard and chin chin. Feeds two.",
        "party, sharing",
    ),
    /* ---------------- protein dishes ---------------- */
    (
        "Ponmo",
        "proteins",
        Shape::Tub,
        "Cow skin, cooked soft so it drinks up the stew.",
        "local",
    ),
    (
        "Bokoto",
        "proteins",
        Shape::Tub,
        "Cow leg, rich and gelatinous, best in pepper soup.",
        "local",
    ),
    (
        "Shaki",
        "proteins",
        Shape::Tub,
        "Cow tripe, cleaned and cooked until tender.",
        "local",
    ),
    (
        "Roundabout",
        "proteins",
        Shape::Tub,
        "Cow small intestine, a fixture of assorted meat plates.",
        "local",
    ),
    (
        "Abodi",
        "proteins",
        Shape::Tub,
        "Cow rectum, an offal delicacy for the seasoned eater.",
        "local",
    ),
    (
        "Ifun",
        "proteins",
        Shape::Tub,
        "Cow intestine, cooked down and seasoned.",
        "local",
    ),
    (
        "Cow Tail",
        "proteins",
        Shape::Tub,
        "Cow tail, slow cooked until the meat falls off.",
        "local",
    ),
    (
        "Assorted Meat",
        "proteins",
        Shape::Tub,
        "A mix of ponmo, shaki, bokoto and liver in one pack.",
        "local",
    ),
    (
        "Isi Ewu",
        "proteins",
        Shape::Plate,
        "Goat head in a palm oil and utazi leaf sauce.",
        "delicacy, spicy",
    ),
    (
        "Nkwobi",
        "proteins",
        Shape::Plate,
        "Cow foot in a thick palm oil sauce with utazi and onion.",
        "delicacy, spicy",
    ),
    (
        "Rabbit Meat",
        "proteins",
        Shape::Tub,
        "Lean rabbit, peppered or stewed.",
        "lean",
    ),
    (
        "Akara",
        "proteins",
        Shape::Counted,
        "Fried bean cakes, crisp outside and fluffy inside.",
        "breakfast",
    ),
    (
        "Wara",
        "proteins",
        Shape::Tub,
        "Local cheese, soft and mild, eaten with pap or on its own.",
        "dairy",
    ),
    (
        "Tofu",
        "proteins",
        Shape::Tub,
        "Soybean curd, ready for stew or a stir fry.",
        "vegetarian",
    ),
    (
        "Cooked Egg",
        "proteins",
        Shape::Counted,
        "Boiled or fried egg, ready to add to any plate.",
        "add-on",
    ),
    /* ---------------- sauces and dips ---------------- */
    (
        "Obe Ata",
        "sauces",
        Shape::Tub,
        "The base tomato and pepper stew every Nigerian kitchen starts with.",
        "classic",
    ),
    (
        "Ata Dindin",
        "sauces",
        Shape::Tub,
        "Concentrated fried pepper sauce, deep red and hot.",
        "spicy",
    ),
    (
        "Ayamase",
        "sauces",
        Shape::Tub,
        "Green pepper and palm oil stew, the ofada rice partner.",
        "spicy",
    ),
    (
        "Garden Egg Sauce",
        "sauces",
        Shape::Tub,
        "Stew built on African eggplant, mild and silky.",
        "mild",
    ),
    (
        "Egg Sauce",
        "sauces",
        Shape::Tub,
        "Scrambled egg in a light tomato sauce for bread or yam.",
        "breakfast",
    ),
    (
        "Agoyin Sauce",
        "sauces",
        Shape::Tub,
        "Palm oil pepper sauce cooked down with beans water.",
        "street, spicy",
    ),
    (
        "Buka Stew",
        "sauces",
        Shape::Tub,
        "Hearty local eatery stew with assorted meat.",
        "local",
    ),
    (
        "Ncha na Ugba Sauce",
        "sauces",
        Shape::Tub,
        "Potash and oil bean seed sauce, sharp and rich.",
        "eastern",
    ),
    (
        "Corned Beef Sauce",
        "sauces",
        Shape::Tub,
        "Tomato stew with flaked corned beef stirred through.",
        "quick",
    ),
    (
        "Pepper Sauce Dip",
        "sauces",
        Shape::Tub,
        "A small fiery dip for grilled meat and fish.",
        "spicy, side",
    ),
    /* ---------------- fast food ---------------- */
    (
        "Pizza",
        "fast-food",
        Shape::Pizza,
        "Hand stretched base, rich tomato sauce and a full cheese pull.",
        "western",
    ),
    (
        "Burger",
        "fast-food",
        Shape::Burger,
        "Beef patty in a soft bun with lettuce, cheese and house sauce.",
        "western",
    ),
    (
        "Shawarma",
        "fast-food",
        Shape::Wrap,
        "Shaved meat rolled in flatbread with cabbage and garlic sauce.",
        "street",
    ),
    (
        "Hot Dog",
        "fast-food",
        Shape::HotDog,
        "Sausage in a soft roll with ketchup and mustard.",
        "street",
    ),
    (
        "Sandwich",
        "fast-food",
        Shape::Sandwich,
        "Layered bread with chicken, egg or corned beef.",
        "quick",
    ),
    (
        "Chicken Wrap",
        "fast-food",
        Shape::Wrap,
        "Grilled chicken, vegetables and sauce rolled in a soft wrap.",
        "quick",
    ),
    (
        "French Fries",
        "fast-food",
        Shape::Fries,
        "Chips fried to order, salted while hot.",
        "side",
    ),
    (
        "Chicken Nuggets",
        "fast-food",
        Shape::Nuggets,
        "Breaded chicken pieces with a dipping sauce.",
        "western",
    ),
    (
        "Fried Chicken",
        "fast-food",
        Shape::Counted,
        "Chicken pieces in a seasoned crumb, fried until golden.",
        "western",
    ),
    (
        "Chicken Wings",
        "fast-food",
        Shape::Counted,
        "Wings glazed and grilled, or fried and peppered.",
        "party",
    ),
    (
        "Onion Rings",
        "fast-food",
        Shape::Counted,
        "Onion rings in a light batter, crisp and sweet.",
        "side",
    ),
    (
        "Mozzarella Sticks",
        "fast-food",
        Shape::Counted,
        "Breaded cheese sticks that pull apart hot.",
        "side",
    ),
    (
        "Nachos",
        "fast-food",
        Shape::Plate,
        "Corn chips with cheese sauce and a tomato salsa.",
        "sharing",
    ),
    (
        "Tacos",
        "fast-food",
        Shape::Counted,
        "Folded shells with spiced mince, lettuce and salsa.",
        "western",
    ),
    (
        "Burrito",
        "fast-food",
        Shape::Wrap,
        "A full wrap of rice, beans, meat and salsa.",
        "filling",
    ),
    (
        "Quesadilla",
        "fast-food",
        Shape::Sandwich,
        "Griddled tortilla folded around melted cheese and chicken.",
        "western",
    ),
    (
        "Sub",
        "fast-food",
        Shape::Sandwich,
        "A long roll filled with meat, cheese and salad.",
        "western",
    ),
    (
        "Sliders",
        "fast-food",
        Shape::Counted,
        "Small burgers, easy to pass around at a party.",
        "party",
    ),
    (
        "Rice Bowl",
        "fast-food",
        Shape::Plate,
        "Rice with a protein and vegetables in one bowl.",
        "quick",
    ),
    /* ---------------- pastries ---------------- */
    (
        "Meat Pie",
        "pastries",
        Shape::Pastry,
        "Shortcrust pie packed with mince, potato and carrot.",
        "classic",
    ),
    (
        "Chicken Pie",
        "pastries",
        Shape::Pastry,
        "Pie filled with shredded chicken and potato.",
        "classic",
    ),
    (
        "Sausage Roll",
        "pastries",
        Shape::SausageRoll,
        "Seasoned sausage wrapped in soft pastry and baked.",
        "classic",
    ),
    (
        "Fish Roll",
        "pastries",
        Shape::Pastry,
        "Soft roll filled with seasoned fish.",
        "classic",
    ),
    (
        "Egg Roll",
        "pastries",
        Shape::Counted,
        "Whole boiled egg wrapped in dough and fried.",
        "classic",
    ),
    (
        "Scotch Egg",
        "pastries",
        Shape::Counted,
        "Boiled egg wrapped in sausage meat and crumbed.",
        "classic",
    ),
    (
        "Empanada",
        "pastries",
        Shape::Pastry,
        "Turned over pastry with a savoury mince filling.",
        "western",
    ),
    (
        "Savoury Croissant",
        "pastries",
        Shape::Counted,
        "Flaky croissant with a savoury filling.",
        "western",
    ),
    /* ---------------- breakfast ---------------- */
    (
        "Akara & Pap",
        "breakfast",
        Shape::Plate,
        "Warm pap with fresh fried akara.",
        "breakfast",
    ),
    (
        "Bread and Egg Sauce",
        "breakfast",
        Shape::Plate,
        "Sliced bread with a soft scrambled egg sauce.",
        "breakfast",
    ),
    (
        "Yam and Egg",
        "breakfast",
        Shape::Plate,
        "Boiled yam with fried egg and onion.",
        "breakfast",
    ),
    (
        "Tea and Bread",
        "breakfast",
        Shape::Plain,
        "Hot tea with buttered bread.",
        "breakfast",
    ),
    (
        "Ogi and Moi Moi",
        "breakfast",
        Shape::Plate,
        "Fermented corn pudding with steamed bean pudding.",
        "breakfast",
    ),
    /* ---------------- puddings and porridges ---------------- */
    (
        "Pap",
        "puddings",
        Shape::Tub,
        "Fermented corn pudding, served warm or chilled.",
        "breakfast",
    ),
    (
        "Agidi",
        "puddings",
        Shape::Tub,
        "Firm corn starch pudding, sliced and eaten with soup.",
        "local",
    ),
    (
        "Moi Moi",
        "puddings",
        Shape::Counted,
        "Steamed bean pudding with pepper and egg.",
        "protein",
    ),
    (
        "Okpa",
        "puddings",
        Shape::Counted,
        "Steamed bambara bean pudding from the east.",
        "eastern",
    ),
    (
        "Ekuru",
        "puddings",
        Shape::Counted,
        "Plain steamed bean pudding, mild and soft.",
        "mild",
    ),
    (
        "Fonio Porridge",
        "puddings",
        Shape::Tub,
        "Creamy acha grain porridge, light and nutty.",
        "healthy",
    ),
    (
        "Rice Pudding",
        "puddings",
        Shape::Tub,
        "Rice simmered in milk until creamy.",
        "dessert",
    ),
    (
        "Tapioca Pudding",
        "puddings",
        Shape::Tub,
        "Cassava starch pearls cooked soft with coconut.",
        "dessert",
    ),
    (
        "Egbo",
        "puddings",
        Shape::Tub,
        "Corn porridge cooked with beans water and pepper.",
        "local",
    ),
    (
        "Yam Pottage",
        "puddings",
        Shape::Plate,
        "Asaro, yam simmered down with palm oil and pepper.",
        "local",
    ),
    (
        "Plantain Pottage",
        "puddings",
        Shape::Plate,
        "Ripe plantain cooked down into a soft sweet porridge.",
        "local",
    ),
    (
        "Ukwa Porridge",
        "puddings",
        Shape::Tub,
        "African breadfruit porridge with potash and palm oil.",
        "eastern",
    ),
    /* ---------------- salads ---------------- */
    (
        "Abacha",
        "salads",
        Shape::Salad,
        "Shredded cassava in palm oil with ugba, fish and spice.",
        "eastern, spicy",
    ),
    (
        "Ugba Salad",
        "salads",
        Shape::Salad,
        "Fermented oil bean seeds with vegetables and palm oil.",
        "eastern",
    ),
    (
        "Fruit Salad",
        "salads",
        Shape::Salad,
        "Seasonal fruit cut fresh and served chilled.",
        "fresh",
    ),
    (
        "Nigerian Vegetable Salad",
        "salads",
        Shape::Salad,
        "Cabbage, carrot, sweetcorn, baked beans and salad cream.",
        "party",
    ),
    (
        "Coleslaw",
        "salads",
        Shape::Salad,
        "Shredded cabbage and carrot in a creamy dressing.",
        "side",
    ),
    (
        "Beetroot Coleslaw",
        "salads",
        Shape::Salad,
        "Coleslaw with shredded beetroot stirred through.",
        "side",
    ),
    (
        "Garden Egg Salad",
        "salads",
        Shape::Salad,
        "African eggplant with onion, tomato and pepper.",
        "local",
    ),
    (
        "Moringa Local Salad",
        "salads",
        Shape::Salad,
        "Steamed moringa leaves with tomato and kuli kuli dressing.",
        "northern, healthy",
    ),
    (
        "Okazi Salad",
        "salads",
        Shape::Salad,
        "Shredded okazi leaves with stockfish and a spicy dressing.",
        "eastern",
    ),
    (
        "Green Pawpaw Salad",
        "salads",
        Shape::Salad,
        "Unripe pawpaw shredded slaw style.",
        "fresh",
    ),
    (
        "Olive Salad",
        "salads",
        Shape::Salad,
        "Olives with vegetables in a tangy dressing.",
        "side",
    ),
    (
        "Chicken Salad",
        "salads",
        Shape::Salad,
        "Diced chicken over crisp vegetables.",
        "protein",
    ),
    (
        "Shrimp Salad",
        "salads",
        Shape::Salad,
        "Shrimp with vegetables and a light dressing.",
        "seafood",
    ),
    (
        "Tuna Salad",
        "salads",
        Shape::Salad,
        "Flaked tuna mixed through a vegetable base.",
        "protein",
    ),
    (
        "Corned Beef Salad",
        "salads",
        Shape::Salad,
        "Corned beef with cabbage, carrot and salad cream.",
        "protein",
    ),
    (
        "Egg Salad",
        "salads",
        Shape::Salad,
        "Chopped boiled egg in a creamy dressing.",
        "protein",
    ),
    (
        "Pasta Salad",
        "salads",
        Shape::Salad,
        "Cold macaroni with vegetables and creamy dressing.",
        "party",
    ),
    (
        "Potato Salad",
        "salads",
        Shape::Salad,
        "Boiled potato with egg, mayonnaise and vegetables.",
        "party",
    ),
    (
        "Rice Salad",
        "salads",
        Shape::Salad,
        "Cooked rice with vegetables, protein and dressing.",
        "filling",
    ),
    (
        "Sweet Corn Salad",
        "salads",
        Shape::Salad,
        "Sweetcorn with vegetables in a light dressing.",
        "fresh",
    ),
    (
        "Mixed Beans Salad",
        "salads",
        Shape::Salad,
        "Cooked beans with onion and a simple dressing.",
        "protein",
    ),
    (
        "Tapioca and Coconut Salad",
        "salads",
        Shape::Salad,
        "Tapioca pearls with coconut, often with smoked fish.",
        "local",
    ),
    (
        "Papaya Salad",
        "salads",
        Shape::Salad,
        "Ripe pawpaw in a soft fruit salad.",
        "fresh",
    ),
    (
        "Herbed Mango Salad",
        "salads",
        Shape::Salad,
        "Mango with a scent leaf sauce.",
        "fresh",
    ),
    (
        "Tarragon Orange Salad",
        "salads",
        Shape::Salad,
        "Orange segments with tarragon and a light syrup.",
        "fresh",
    ),
    /* ---------------- sides and extras ---------------- */
    (
        "Fried Plantain",
        "sides",
        Shape::Tub,
        "Dodo, ripe plantain fried until the edges caramelise.",
        "side",
    ),
    (
        "Classic Salad Cream Blend",
        "sides",
        Shape::Tub,
        "Salad cream, mayonnaise and ketchup whisked together.",
        "dressing",
    ),
    (
        "Evaporated Milk Dressing",
        "sides",
        Shape::Tub,
        "Mayonnaise, ketchup, chilli and evaporated milk.",
        "dressing",
    ),
    (
        "Mayonnaise",
        "sides",
        Shape::Tub,
        "Thick mayonnaise, ready for the salad bowl.",
        "dressing",
    ),
    (
        "Salad Cream",
        "sides",
        Shape::Tub,
        "Tangy salad cream, the vinegar forward classic.",
        "dressing",
    ),
    (
        "Ketchup",
        "sides",
        Shape::Tub,
        "Tomato ketchup for chips and pastries.",
        "dressing",
    ),
    (
        "Sweet Chilli Dip",
        "sides",
        Shape::Tub,
        "Sweet and hot chilli dip for anything fried.",
        "dressing",
    ),
    (
        "Extra Sausage",
        "sides",
        Shape::Counted,
        "Loose sausages to add to any order.",
        "add-on",
    ),
    /* ---------------- desserts and sweets ---------------- */
    (
        "Puff Puff",
        "desserts",
        Shape::Counted,
        "Fried dough balls, light and sweet.",
        "party",
    ),
    (
        "Chin Chin",
        "desserts",
        Shape::Tub,
        "Crunchy fried dough cubes, the party bag classic.",
        "party",
    ),
    (
        "Pancakes",
        "desserts",
        Shape::Pancake,
        "Thin pancakes with a soft centre, sweet or savoury.",
        "breakfast",
    ),
    (
        "Banana Pancake",
        "desserts",
        Shape::Pancake,
        "Mashed ripe banana folded into the batter.",
        "sweet",
    ),
    (
        "Plantain Pancake",
        "desserts",
        Shape::Pancake,
        "Ripe plantain blended into a sweet pancake batter.",
        "sweet",
    ),
    (
        "Savoury Oatcake",
        "desserts",
        Shape::Pancake,
        "Ground oats with carrot, peas and sausage.",
        "savoury",
    ),
    (
        "Shuku Shuku",
        "desserts",
        Shape::Counted,
        "Coconut balls rolled and fried.",
        "sweet",
    ),
    (
        "Coconut Candy",
        "desserts",
        Shape::Tub,
        "Caramelised coconut cut into soft sweets.",
        "sweet",
    ),
    (
        "Baba Dudu",
        "desserts",
        Shape::Tub,
        "Dark coconut candy, deep caramel colour.",
        "sweet",
    ),
    (
        "Gurudi",
        "desserts",
        Shape::Tub,
        "Coconut and cassava starch cookie.",
        "sweet",
    ),
    (
        "Kuli Kuli",
        "desserts",
        Shape::Counted,
        "Crunchy groundnut snack, best with warm pap.",
        "northern",
    ),
    (
        "Donkwa",
        "desserts",
        Shape::Tub,
        "Groundnut and cornmeal sweet from the north.",
        "northern",
    ),
    (
        "Kokoro",
        "desserts",
        Shape::Counted,
        "Crunchy maize flour sticks.",
        "northern",
    ),
    (
        "Alkaki",
        "desserts",
        Shape::Counted,
        "Doughnut like sweets soaked in honey syrup.",
        "northern",
    ),
    (
        "Balewa",
        "desserts",
        Shape::Tub,
        "Hard sugar candy, slow to finish.",
        "sweet",
    ),
    /* ---------------- cakes ---------------- */
    (
        "Buttercream Celebration Cake",
        "cakes",
        Shape::Cake,
        "A celebration cake finished in smooth buttercream.",
        "celebration",
    ),
    (
        "Fondant Celebration Cake",
        "cakes",
        Shape::Cake,
        "A celebration cake covered and shaped in fondant.",
        "celebration",
    ),
    (
        "Wedding Tiered Cake",
        "cakes",
        Shape::Cake,
        "A tiered wedding cake, iced and finished to order.",
        "wedding",
    ),
    (
        "Birthday Cake",
        "cakes",
        Shape::Cake,
        "A birthday cake with a name and candles on top.",
        "birthday",
    ),
    (
        "Cupcake Tray",
        "cakes",
        Shape::Counted,
        "A tray of small cakes, iced and ready to pass around.",
        "party",
    ),
    (
        "Chocolate Fudge Cake",
        "cakes",
        Shape::Cake,
        "Deep cocoa sponge with a fudge finish.",
        "chocolate",
    ),
    (
        "Red Velvet Cake",
        "cakes",
        Shape::Cake,
        "Red velvet sponge with cream cheese icing.",
        "celebration",
    ),
    (
        "Fruit Cake",
        "cakes",
        Shape::Cake,
        "Dark fruit cake, soaked and slow baked.",
        "classic",
    ),
    (
        "Marble Cake",
        "cakes",
        Shape::Cake,
        "Vanilla and chocolate sponge baked in one loaf.",
        "classic",
    ),
    (
        "Coconut Cake",
        "cakes",
        Shape::Cake,
        "Coconut sponge with a soft coconut icing.",
        "coconut",
    ),
    (
        "Lemon Drizzle Cake",
        "cakes",
        Shape::Cake,
        "Lemon sponge with a sharp syrup drizzle.",
        "citrus",
    ),
    /* ---------------- drinks ---------------- */
    (
        "Fresh Ginger Juice",
        "drinks",
        Shape::Drink,
        "Blended ginger, pineapple and lime, served cold.",
        "spicy, fresh",
    ),
    (
        "Zobo",
        "drinks",
        Shape::Drink,
        "Hibiscus drink brewed with ginger and pineapple.",
        "classic",
    ),
    (
        "Kunu",
        "drinks",
        Shape::Drink,
        "Fermented cereal drink, lightly sweet.",
        "northern",
    ),
    (
        "Kunun Aya",
        "drinks",
        Shape::Drink,
        "Tigernut milk, creamy and cold.",
        "northern, dairy free",
    ),
    (
        "Kunun Gyada",
        "drinks",
        Shape::Drink,
        "Groundnut and rice drink, thick and filling.",
        "northern",
    ),
    (
        "Fura da Nono",
        "drinks",
        Shape::Drink,
        "Millet dough balls in fermented milk.",
        "northern",
    ),
    (
        "Palm Wine",
        "drinks",
        Shape::Drink,
        "Fresh tapped palm sap, served chilled.",
        "local",
    ),
    (
        "Burukutu",
        "drinks",
        Shape::Drink,
        "Fermented sorghum drink with a sour finish.",
        "northern",
    ),
    (
        "Pito",
        "drinks",
        Shape::Drink,
        "Fermented millet and sorghum drink.",
        "northern",
    ),
    (
        "Ogogoro",
        "drinks",
        Shape::Drink,
        "Local palm spirit, served by the shot or bottle.",
        "local, spirit",
    ),
    (
        "Chapman",
        "drinks",
        Shape::Drink,
        "A red non alcoholic cocktail with citrus and bitters.",
        "classic",
    ),
    (
        "Malt Drink",
        "drinks",
        Shape::Drink,
        "Chilled non alcoholic malt, the party standard.",
        "classic",
    ),
    (
        "Adoyo",
        "drinks",
        Shape::Drink,
        "Pineapple blended with pap into a smooth drink.",
        "fresh",
    ),
    (
        "Omi Wara",
        "drinks",
        Shape::Drink,
        "Cheese whey drink, light and slightly sour.",
        "local",
    ),
    (
        "Groundnut Milk",
        "drinks",
        Shape::Drink,
        "Plant based groundnut milk, smooth and nutty.",
        "dairy free",
    ),
    (
        "Soya Milk",
        "drinks",
        Shape::Drink,
        "Fresh soybean milk, lightly sweetened.",
        "dairy free",
    ),
    /* ---------------- pasta & noodles ---------------- */
    (
        "Jollof Spaghetti",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti simmered in the same smoky pepper base as party jollof.",
        "party, classic",
    ),
    (
        "Fried Spaghetti",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti tossed in a hot pan with pepper, onion and a little oil.",
        "quick, spicy",
    ),
    (
        "Spaghetti & Obe Ata",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti served under a generous ladle of red pepper stew.",
        "classic",
    ),
    (
        "Spaghetti & Egg Sauce",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti with a soft scramble of tomato, onion and egg.",
        "breakfast, quick",
    ),
    (
        "Spaghetti Bolognese",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti under a slow cooked minced meat and tomato sauce.",
        "continental",
    ),
    (
        "Spaghetti & Meatballs",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti with seasoned beef meatballs in tomato sauce.",
        "continental",
    ),
    (
        "Vegetable Spaghetti",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti stir fried with carrot, green beans, peas and sweet corn.",
        "vegetarian, quick",
    ),
    (
        "Macaroni Jollof",
        "pasta-noodles",
        Shape::Pasta,
        "Macaroni cooked down in a smoky pepper base until the sauce clings.",
        "party, classic",
    ),
    (
        "Fried Macaroni",
        "pasta-noodles",
        Shape::Pasta,
        "Macaroni fried with pepper, onion and a little butter.",
        "quick, spicy",
    ),
    (
        "Macaroni & Cheese",
        "pasta-noodles",
        Shape::Pasta,
        "Macaroni baked in a creamy cheese sauce with a golden top.",
        "comfort, continental",
    ),
    (
        "Creamy Macaroni",
        "pasta-noodles",
        Shape::Pasta,
        "Macaroni in a soft milk and butter sauce, mild and filling.",
        "comfort",
    ),
    (
        "Nigerian Party Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta cooked in a rich pepper base with sausage, liver and vegetables.",
        "party",
    ),
    (
        "Tuna Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta folded through tuna, onion and a light tomato sauce.",
        "quick",
    ),
    (
        "Baked Macaroni",
        "pasta-noodles",
        Shape::Pasta,
        "Macaroni layered with meat sauce and cheese, then baked.",
        "comfort, continental",
    ),
    (
        "Spaghetti Carbonara",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti with egg, cheese and smoked meat in a silky sauce.",
        "continental",
    ),
    (
        "Spaghetti Aglio e Olio",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti tossed in garlic, olive oil and chilli flakes.",
        "continental, vegetarian",
    ),
    (
        "Spaghetti Arrabbiata",
        "pasta-noodles",
        Shape::Pasta,
        "Spaghetti in a tomato sauce built on garlic and dried chilli.",
        "continental, spicy",
    ),
    (
        "Penne Arrabbiata",
        "pasta-noodles",
        Shape::Pasta,
        "Penne tubes in a hot garlic and tomato sauce.",
        "continental, spicy",
    ),
    (
        "Chicken Alfredo Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta with grilled chicken in a cream and parmesan sauce.",
        "continental, comfort",
    ),
    (
        "Fettuccine Alfredo",
        "pasta-noodles",
        Shape::Pasta,
        "Ribbon pasta in a butter, cream and parmesan sauce.",
        "continental, vegetarian",
    ),
    (
        "Creamy Chicken Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta and shredded chicken in a soft cream sauce.",
        "continental, comfort",
    ),
    (
        "Creamy Seafood Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta with prawns and fish in a light cream sauce.",
        "continental, seafood",
    ),
    (
        "Shrimp Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta tossed with prawns, garlic, butter and pepper.",
        "seafood",
    ),
    (
        "Pesto Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta coated in a basil, nut and parmesan pesto.",
        "continental, vegetarian",
    ),
    (
        "Lasagna",
        "pasta-noodles",
        Shape::Pasta,
        "Layers of pasta sheet, meat sauce and cheese baked until set.",
        "continental, comfort",
    ),
    (
        "Ravioli",
        "pasta-noodles",
        Shape::Pasta,
        "Filled pasta parcels served with a sauce of your choice.",
        "continental",
    ),
    (
        "Tortellini",
        "pasta-noodles",
        Shape::Pasta,
        "Ring shaped filled pasta in a light sauce.",
        "continental",
    ),
    (
        "Cannelloni",
        "pasta-noodles",
        Shape::Pasta,
        "Rolled pasta tubes stuffed with meat and baked under cheese.",
        "continental, comfort",
    ),
    (
        "Pasta Primavera",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta with seasonal vegetables in a light garlic sauce.",
        "continental, vegetarian",
    ),
    (
        "Stir-Fry Pasta",
        "pasta-noodles",
        Shape::Pasta,
        "Pasta thrown into a hot wok with vegetables and pepper.",
        "quick, spicy",
    ),
    (
        "Instant Noodles",
        "pasta-noodles",
        Shape::Noodles,
        "The everyday pack, cooked your way with whatever you add.",
        "quick, classic",
    ),
    (
        "Indomie Special",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles cooked with egg, sausage, vegetables and a little pepper.",
        "quick, popular",
    ),
    (
        "Jollof Indomie",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles cooked down in a smoky pepper base.",
        "quick, spicy",
    ),
    (
        "Fried Indomie",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles fried in a hot pan with onion and pepper.",
        "quick, spicy",
    ),
    (
        "Noodles & Beans",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles served with a scoop of soft cooked beans.",
        "filling",
    ),
    (
        "Noodles & Plantain",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles with sweet fried plantain on the side.",
        "filling, popular",
    ),
    (
        "Noodles & Moi Moi",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles with a wrap of steamed bean pudding.",
        "filling",
    ),
    (
        "Noodles & Akara",
        "pasta-noodles",
        Shape::Noodles,
        "Noodles with hot fried bean cakes.",
        "breakfast, filling",
    ),
    (
        "Chow Mein",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Egg noodles stir fried with vegetables and a savoury sauce.",
        "asian, quick",
    ),
    (
        "Lo Mein",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Soft egg noodles tossed through a thick savoury sauce.",
        "asian",
    ),
    (
        "Hakka Noodles",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Long noodles wok fried with shredded vegetables and soy.",
        "asian, vegetarian",
    ),
    (
        "Singapore Noodles",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Thin rice noodles in a curry and turmeric stir fry.",
        "asian, spicy",
    ),
    (
        "Pad Thai",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Rice noodles with tamarind, peanut, egg and lime.",
        "asian",
    ),
    (
        "Ramen",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Wheat noodles in a hot savoury broth with toppings.",
        "asian, soup",
    ),
    (
        "Udon",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Thick chewy wheat noodles in a light broth.",
        "asian, soup",
    ),
    (
        "Soba",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Buckwheat noodles served hot in broth or cold with dip.",
        "asian",
    ),
    (
        "Rice Noodles",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Flat rice noodles stir fried or served in broth.",
        "asian, gluten free",
    ),
    (
        "Glass Noodles",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Clear bean thread noodles that soak up whatever they cook in.",
        "asian, gluten free",
    ),
    (
        "Chicken Noodle Soup",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Noodles in a clear chicken broth with shredded chicken.",
        "asian, soup, comfort",
    ),
    (
        "Beef Noodle Soup",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Noodles in a deep beef broth with sliced beef.",
        "asian, soup",
    ),
    (
        "Seafood Noodle Soup",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Noodles in a light broth with prawns and fish.",
        "asian, soup, seafood",
    ),
    (
        "Nigerian Chinese Fried Noodles",
        "pasta-noodles",
        Shape::NoodleBowl,
        "Wok fried noodles with pepper, sausage and mixed vegetables.",
        "fusion, spicy",
    ),
];

/// Loads the catalogue into the database.
///
/// Safe to run on every start. Categories are upserted by slug. A dish is only
/// inserted when its name is not already there, so a caterer's price, photo and
/// switch survive a restart. Dishes that predate the catalogue keep their price
/// and availability and are simply moved to their proper category.
pub async fn seed_catalogue(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    for (name, slug, description, sort_order) in CATEGORIES {
        sqlx::query(
            "INSERT INTO categories (name, slug, description, sort_order)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                sort_order = excluded.sort_order",
        )
        .bind(*name)
        .bind(*slug)
        .bind(*description)
        .bind(*sort_order)
        .execute(pool)
        .await?;
    }

    for (index, (name, category_slug, shape, description, tags)) in DISHES.iter().enumerate() {
        let mut tx = pool.begin().await?;

        let category_id: Option<i64> =
            sqlx::query_scalar("SELECT id FROM categories WHERE slug = ?")
                .bind(*category_slug)
                .fetch_optional(&mut *tx)
                .await?;

        let Some(category_id) = category_id else {
            tx.rollback().await?;
            continue;
        };

        let existing: Option<i64> = sqlx::query_scalar("SELECT id FROM menu_items WHERE name = ?")
            .bind(*name)
            .fetch_optional(&mut *tx)
            .await?;

        let item_id = match existing {
            Some(id) => {
                sqlx::query("UPDATE menu_items SET category_id = ?, sort_order = ? WHERE id = ?")
                    .bind(category_id)
                    .bind(index as i64)
                    .bind(id)
                    .execute(&mut *tx)
                    .await?;
                id
            }
            None => {
                // Switched off and unpriced on purpose. The shop never shows it
                // until the caterer turns it on and sets a price.
                sqlx::query_scalar(
                    "INSERT INTO menu_items
                        (category_id, name, description, price_kobo, image_url, tags,
                         is_available, is_featured, sort_order)
                     VALUES (?, ?, ?, 0, ?, ?, 0, 0, ?)
                     RETURNING id",
                )
                .bind(category_id)
                .bind(*name)
                .bind(*description)
                .bind(format!(
                    "https://picsum.photos/seed/ff-{}/800/600",
                    slugify(name)
                ))
                .bind(*tags)
                .bind(index as i64)
                .fetch_one(&mut *tx)
                .await?
            }
        };

        // Choices are only filled in when the dish has none, so a caterer who
        // edits them never has the edit overwritten on the next start.
        let group_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM item_option_groups WHERE menu_item_id = ?")
                .bind(item_id)
                .fetch_one(&mut *tx)
                .await?;

        if group_count == 0 {
            for (group_index, group) in shape.groups().iter().enumerate() {
                let group_id: i64 = sqlx::query_scalar(
                    "INSERT INTO item_option_groups
                        (menu_item_id, name, kind, help, is_required, allows_quantity,
                         source_category_slug, free_text, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     RETURNING id",
                )
                .bind(item_id)
                .bind(group.name)
                .bind(group.kind)
                .bind(group.help)
                .bind(if group.required { 1 } else { 0 })
                .bind(if group.allows_quantity { 1 } else { 0 })
                .bind(group.source_category)
                .bind(if group.free_text { 1 } else { 0 })
                .bind(group_index as i64)
                .fetch_one(&mut *tx)
                .await?;

                for (option_index, label) in group.options.iter().enumerate() {
                    sqlx::query(
                        "INSERT INTO item_options
                            (group_id, label, price_delta_kobo, is_default, is_available, sort_order)
                         VALUES (?, ?, 0, 0, 1, ?)",
                    )
                    .bind(group_id)
                    .bind(*label)
                    .bind(option_index as i64)
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }

        tx.commit().await?;
    }

    // Pairings are a starting point, not a rule. The caterer's own version wins,
    // so defaults are only topped up once per catalogue revision. After that the
    // table is left alone and anything they delete stays deleted.
    const PAIRINGS_VERSION: &str = "2";

    let seeded: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'pairings_version'")
            .fetch_optional(pool)
            .await?;

    if seeded.as_deref() != Some(PAIRINGS_VERSION) {
        for (index, (slug, accompanies)) in PAIRINGS.iter().enumerate() {
            sqlx::query(
                "INSERT OR IGNORE INTO category_pairings
                    (category_id, accompanies_id, sort_order)
                 SELECT a.id, b.id, ?
                 FROM categories a, categories b
                 WHERE a.slug = ? AND b.slug = ?",
            )
            .bind(index as i64)
            .bind(*slug)
            .bind(*accompanies)
            .execute(pool)
            .await?;
        }

        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('pairings_version', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(PAIRINGS_VERSION)
        .execute(pool)
        .await?;
    }

    // Categories start hidden from customers. The first run approves whatever
    // already has a live dish, so upgrading does not blank the menu. After that
    // the caterer owns the switch and this block never runs again.
    const APPROVED_VERSION: &str = "1";

    let approved: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'categories_approved_version'")
            .fetch_optional(pool)
            .await?;

    if approved.as_deref() != Some(APPROVED_VERSION) {
        sqlx::query(
            "UPDATE categories SET is_approved = 1
             WHERE EXISTS (
                SELECT 1 FROM menu_items m
                WHERE m.category_id = categories.id
                  AND m.is_available = 1 AND m.price_kobo > 0
             )",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('categories_approved_version', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(APPROVED_VERSION)
        .execute(pool)
        .await?;
    }

    crate::ingredients::backfill(pool).await?;

    Ok(())
}

/// A stable photo seed, so a dish keeps the same placeholder picture.
fn slugify(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_dash = true;

    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }

    out.trim_end_matches('-').to_string()
}
