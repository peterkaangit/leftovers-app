/*
 * weights.js — a conversion table for "1 whole chicken", "3 cloves" or "1 cup".
 *
 * Recipes and your kitchen don't always use the same kind of unit. To
 * compare "1 chicken" with "800 g of chicken", we turn both into grams:
 *   - pieces  -> grams, using a typical weight per piece (PIECE)
 *   - volumes -> grams, using how heavy a millilitre of it is (DENSITY)
 *
 * These are typical averages, so the results are good estimates, not exact.
 * Names are written in the singular and matched anywhere in the ingredient
 * name; the longest match wins ("chicken breast" beats "chicken").
 * To add an ingredient, add a line to the right table.
 * tools/check-weights.html lists the recipe amounts that still can't be converted.
 */

const Weights = (() => {
  // Typical weight of one piece, in grams.
  const PIECE = {
    // Meat and poultry
    "chicken": 1500, "whole chicken": 1500, "chicken breast": 170, "chicken thigh": 110,
    "chicken leg": 250, "chicken drumstick": 100, "chicken wing": 90, "duck": 2000,
    "duck breast": 200, "duck leg": 250, "turkey": 5000, "turkey breast": 600,
    "sausage": 60, "chorizo": 225, "bacon": 25, "ham": 30, "prosciutto": 15, "salami": 5,
    "steak": 250, "beef fillet": 200, "sirloin": 250, "rib eye": 300, "ribeye": 300,
    "pork chop": 200, "pork loin": 1000, "pork belly": 1000, "pork tenderloin": 500,
    "pork shoulder": 2000, "lamb chop": 100, "lamb shank": 400, "lamb leg": 2000,
    "leg of lamb": 2000, "rack of lamb": 800, "veal": 150, "venison": 200, "meatball": 30,
    // Fish and seafood
    "salmon": 150, "salmon fillet": 150, "cod": 150, "haddock": 150, "tuna": 150,
    "mackerel": 300, "sardine": 50, "anchovy": 4, "anchovy fillet": 4, "trout": 300,
    "sea bass": 300, "monkfish": 200, "tilapia": 120, "halibut": 150, "white fish": 150,
    "fish": 150, "prawn": 15, "king prawn": 20, "tiger prawn": 20, "shrimp": 12,
    "scallop": 25, "mussel": 15, "clam": 15, "oyster": 15, "squid": 200, "crab": 500,
    "lobster": 700,
    // Eggs, dairy, tofu
    "egg": 50, "free-range egg": 50, "egg yolk": 18, "egg white": 32, "quail egg": 10,
    "tofu": 400, "mozzarella": 125, "burrata": 125, "camembert": 250, "brie": 200,
    // Vegetables
    "onion": 150, "red onion": 150, "white onion": 150, "brown onion": 150,
    "spring onion": 15, "green onion": 15, "scallion": 15, "shallot": 40, "garlic": 50,
    "leek": 200, "tomato": 120, "plum tomato": 70, "cherry tomato": 15, "potato": 200,
    "new potato": 50, "baby potato": 50, "sweet potato": 250, "carrot": 70, "parsnip": 150,
    "turnip": 200, "swede": 800, "beetroot": 150, "celery": 40, "celeriac": 700,
    "fennel": 250, "pepper": 160, "red pepper": 160, "green pepper": 160,
    "yellow pepper": 160, "bell pepper": 160, "chilli": 15, "chili": 15, "red chilli": 15,
    "green chilli": 15, "jalapeno": 20, "scotch bonnet": 10, "cucumber": 300,
    "courgette": 200, "zucchini": 200, "aubergine": 300, "eggplant": 300, "mushroom": 20,
    "portobello mushroom": 80, "cabbage": 900, "red cabbage": 900, "savoy cabbage": 900,
    "lettuce": 500, "little gem": 100, "iceberg": 500, "broccoli": 350, "cauliflower": 600,
    "corn on the cob": 250, "artichoke": 300, "asparagus": 20, "pak choi": 150,
    "bok choy": 150, "okra": 12, "radish": 10, "butternut squash": 1000, "pumpkin": 3000,
    "ginger": 30, "lemongrass": 30, "avocado": 170, "olive": 4,
    // Fruit
    "lemon": 100, "lime": 60, "orange": 180, "apple": 180, "pear": 180, "banana": 120,
    "mango": 300, "pineapple": 1500, "peach": 150, "nectarine": 150, "plum": 70,
    "apricot": 40, "fig": 50, "kiwi": 75, "date": 8, "prune": 8, "strawberry": 12,
    // Bread and the like
    "bread": 30, "bread roll": 60, "baguette": 250, "tortilla": 45, "flour tortilla": 45,
    "pitta": 60, "pita": 60, "naan": 90, "bun": 60, "burger bun": 60, "brioche bun": 60,
    "english muffin": 60, "croissant": 60, "puff pastry": 320, "shortcrust pastry": 320,
    "filo pastry": 15, "lasagne sheet": 20, "taco shell": 12,
    // Herbs, spices and small things counted one by one
    "bay leaf": 0.2, "kaffir lime leaf": 0.2, "lime leaf": 0.2, "curry leaf": 0.1,
    "cinnamon stick": 3, "star anise": 2, "cardamom": 0.2, "clove": 0.1,
    "stock cube": 10, "chicken stock cube": 10, "beef stock cube": 10,
    "vegetable stock cube": 10, "gelatine leaf": 2, "marshmallow": 7,
    "vanilla pod": 2, "vanilla bean": 2, "juniper berry": 0.1, "allspice berry": 0.1,
    "peppercorn": 0.05, "nutmeg": 7, "cinnamon": 3, "bouquet garni": 5, "sugar": 4,
    "thyme": 1, "rosemary": 1, "parsley": 1, "coriander": 1, "mint": 0.5,
    "tarragon": 0.5, "basil": 0.3,
    // Found by tools/check-weights.html
    "challot": 40, "chilly": 15, "birds-eye chilly": 5, "bird's eye chilli": 5,
    "cayenne pepper": 1, "beef brisket": 2000, "brisket": 2000, "breadfruit": 1000,
    "lamb loin chop": 100, "dill pickle": 60, "pickle": 60, "gherkin": 30,
    "plantain": 250, "pork": 200, "sweetcorn": 250, "coconut": 600,
    "rice paper sheet": 8, "rice paper": 8, "morcilla": 100, "black pudding": 40,
    "walnut": 5, "meringue nest": 15, "turkish delight": 10, "falafel": 20,
    "pig trotter": 300, "phyllo dough": 15, "filo": 15, "yuca": 400, "cassava": 400,
    "squash": 1000, "cheese": 20, "mar bar": 50, "mars bar": 50, "lemon juice": 30,
    "lime juice": 20, "orange juice": 80, "arepa": 120, "corn arepa": 120,
  };

  // Words in a measure that mean a particular amount for one ingredient.
  const HERB = { bunch: 30, handful: 10, handfull: 10, sprig: 1, leaf: 0.1, stalk: 5 };
  const PIECE_BY_WORD = {
    garlic: { clove: 5, bulb: 50, head: 50 },
    // Meat cut words: "5 boneless" chicken means pieces, not 5 whole chickens.
    chicken: { whole: 1500, boneless: 150, skinless: 150, fillet: 150, breast: 170,
               thigh: 110, leg: 250, drumstick: 100, wing: 90, piece: 150, joint: 200 },
    pork: { chop: 200, belly: 1000, shoulder: 2000, loin: 1000, fillet: 500,
            tenderloin: 500, boneless: 200, steak: 200, rib: 150 },
    lamb: { chop: 100, cutlet: 80, shank: 400, leg: 2000, shoulder: 1800, rack: 800,
            fillet: 200, boneless: 150, steak: 150 },
    beef: { steak: 250, fillet: 200, boneless: 200, rib: 500 },
    duck: { breast: 200, leg: 250, whole: 2000 },
    turkey: { breast: 600, leg: 700, whole: 5000 },
    ginger: { inch: 10, cm: 4, thumb: 15, piece: 30, knob: 15 },
    celery: { stick: 40, stalk: 40, rib: 40 },
    butter: { stick: 113, knob: 15, block: 250 },
    bread: { slice: 30, loaf: 800 },
    bacon: { slice: 25, rasher: 25, strip: 25 },
    ham: { slice: 30 },
    cheese: { slice: 20 },
    lemongrass: { stalk: 30, stick: 30 },
    cinnamon: { stick: 3 },
    chocolate: { square: 5, bar: 100 },
    spinach: { bunch: 250, bag: 250, handful: 30 },
    lemon: { slice: 10, wedge: 15 },
    lime: { slice: 8, wedge: 10 },
    parsley: HERB, coriander: HERB, cilantro: HERB, basil: HERB, mint: HERB, dill: HERB,
    thyme: HERB, rosemary: HERB, sage: HERB, tarragon: HERB, chive: HERB, oregano: HERB,
  };

  // Words that mean roughly the same amount whatever the ingredient.
  const GENERIC_WORD = {
    can: 400, tin: 400, jar: 350, carton: 500, bottle: 500, handful: 30, bunch: 40,
    slice: 30, fillet: 150, sprig: 1, pinch: 0.5, dash: 1, splash: 15, drizzle: 10,
    glug: 15, leaf: 0.5, leave: 0.5, packet: 250, pack: 250, block: 250, bag: 250,
    cube: 10, sheet: 30, stalk: 40, stick: 40, knob: 15, pot: 300, tub: 300,
    handfull: 30, shot: 30,
  };

  // Size words: a large onion weighs about 1.3 times a normal one.
  const SIZE = { large: 1.3, big: 1.3, medium: 1, small: 0.7, whole: 1, baby: 0.5, head: 1, piece: 1 };

  // How many grams one millilitre weighs (1 cup = 240 ml of rice ≈ 185 g).
  const DENSITY = {
    // Liquids and soft things
    "water": 1, "stock": 1, "chicken stock": 1, "beef stock": 1, "vegetable stock": 1,
    "fish stock": 1, "broth": 1, "wine": 1, "red wine": 1, "white wine": 1, "beer": 1,
    "juice": 1, "lemon juice": 1, "lime juice": 1, "vinegar": 1, "milk": 1.03,
    "cream": 1, "double cream": 1, "single cream": 1, "heavy cream": 1, "sour cream": 1,
    "creme fraiche": 1, "buttermilk": 1.03, "coconut milk": 1, "coconut cream": 1,
    "yogurt": 1.03, "yoghurt": 1.03, "greek yogurt": 1.05, "passata": 1.05,
    "tomato puree": 1.1, "tomato paste": 1.1, "ketchup": 1.15, "tomato ketchup": 1.15,
    "soy sauce": 1.1, "fish sauce": 1.2, "worcestershire sauce": 1.1, "oyster sauce": 1.2,
    "hoisin sauce": 1.2, "sauce": 1.1, "honey": 1.4, "maple syrup": 1.32,
    "golden syrup": 1.4, "syrup": 1.35, "molasse": 1.4, "treacle": 1.4, "oil": 0.92,
    "butter": 0.96, "lard": 0.9, "ghee": 0.9, "mayonnaise": 0.95, "mustard": 1.05,
    "peanut butter": 1.08, "tahini": 1, "jam": 1.3, "ricotta": 1, "cream cheese": 1,
    "mascarpone": 1, "paste": 1.1, "garlic paste": 1.1, "ginger paste": 1.1,
    "sherry": 1, "dry sherry": 1, "brandy": 0.95, "rum": 0.95, "dark rum": 0.95,
    "sake": 1, "mirin": 1.1, "marnier": 1, "liqueur": 1.05, "cider": 1, "stout": 1,
    "hotsauce": 1, "hot sauce": 1, "salsa": 1, "green salsa": 1, "sirop": 1.35,
    "almond milk": 1.03, "oat milk": 1.03, "soy milk": 1.03, "coffee": 1, "cafe": 1, "espresso": 1, "puree": 1, "pumpkin puree": 1,
    "fromage frai": 1, "fromage frais": 1, "lemon": 1, "lime": 1,
    "shortening": 0.9, "goose fat": 0.9, "duck fat": 0.9, "fat": 0.9,
    // Flours, sugars, grains, pulses
    "flour": 0.53, "plain flour": 0.53, "self-raising flour": 0.53, "bread flour": 0.55,
    "cornflour": 0.53, "cornstarch": 0.53, "sugar": 0.85, "caster sugar": 0.85,
    "brown sugar": 0.9, "icing sugar": 0.5, "powdered sugar": 0.5, "rice": 0.78,
    "basmati rice": 0.78, "arborio rice": 0.82, "oat": 0.38, "couscous": 0.73,
    "quinoa": 0.72, "bulgur": 0.6, "lentil": 0.8, "red lentil": 0.82, "split pea": 0.8,
    "chickpea": 0.7, "bean": 0.75, "kidney bean": 0.75, "black bean": 0.75, "pea": 0.6,
    "sweetcorn": 0.65, "corn": 0.65, "breadcrumb": 0.45, "panko": 0.25, "cocoa": 0.37,
    "pasta": 0.4, "macaroni": 0.45, "noodle": 0.3, "polenta": 0.65,
    "starch": 0.53, "cornmeal": 0.6, "tapioca": 0.6, "buckwheat": 0.7, "freekeh": 0.7,
    "farine": 0.6, "cassava": 0.6, "dal": 0.8, "toor dal": 0.8, "crumb": 0.4,
    "graham cracker crumb": 0.4, "cacao": 0.42, "coconut": 0.35, "coconut flake": 0.3,
    "sorrel": 0.2, "banana": 0.6, "date": 0.6, "pitted date": 0.6, "pistachio": 0.5,
    "queso fresco": 0.5, "scallion": 0.4, "spring onion": 0.4, "chilli": 0.5,
    "green chilli": 0.5,
    // Spices and baking
    "salt": 1.2, "sea salt": 1.2, "baking powder": 0.9, "bicarbonate of soda": 0.9,
    "baking soda": 0.9, "yeast": 0.6, "cinnamon": 0.55, "cumin": 0.45, "paprika": 0.45,
    "turmeric": 0.6, "garam masala": 0.45, "curry powder": 0.4, "chilli powder": 0.5,
    "chili powder": 0.5, "chilli flake": 0.35, "ground ginger": 0.45,
    "ground coriander": 0.4, "coriander seed": 0.35, "cumin seed": 0.4, "oregano": 0.2,
    "mixed herb": 0.2, "black pepper": 0.5, "pepper": 0.5, "nutmeg": 0.45,
    "garlic powder": 0.55, "onion powder": 0.5, "vanilla extract": 0.9, "vanilla": 0.9,
    "stock cube": 0.6, "allspice": 0.45, "thyme": 0.3, "rosemary": 0.3, "marjoram": 0.2,
    "dill": 0.05, "chive": 0.2, "cilantro": 0.07, "tarragon": 0.2, "sage": 0.2,
    "savoury": 0.2, "summer savoury": 0.2, "bay leaf": 0.1, "cardamom": 0.45,
    "cardomom": 0.45, "clove": 0.45, "caraway": 0.45, "fennel seed": 0.4, "seed": 0.5,
    "poppy seed": 0.6, "spice": 0.45, "mixed spice": 0.45, "five spice": 0.45,
    "seasoning": 0.5, "harissa": 0.5, "cajun": 0.5, "sumac": 0.5, "fenugreek": 0.5,
    "saffron": 0.2, "pul biber": 0.4, "sazon": 0.6, "achiote": 0.5, "peppercorn": 0.55,
    "zest": 0.4, "lemon zest": 0.4, "horseradish": 1, "food colouring": 1,
    // Cheese, nuts, dried fruit
    "cheese": 0.4, "parmesan": 0.4, "parmigiano": 0.4, "cheddar": 0.45,
    "mozzarella": 0.45, "feta": 0.6, "gruyere": 0.45, "nut": 0.6, "almond": 0.6,
    "ground almond": 0.4, "walnut": 0.5, "pecan": 0.45, "peanut": 0.6, "cashew": 0.55,
    "pine nut": 0.55, "sesame seed": 0.6, "raisin": 0.65, "sultana": 0.65,
    "dried apricot": 0.55, "desiccated coconut": 0.35, "chocolate chip": 0.7,
    "chocolate": 0.7, "olive": 0.55, "caper": 0.6,
    // Chopped fruit and vegetables, herbs
    "spinach": 0.13, "kale": 0.1, "rocket": 0.1, "lettuce": 0.2, "cabbage": 0.3,
    "tomato": 0.75, "cherry tomato": 0.6, "onion": 0.66, "carrot": 0.54, "celery": 0.5,
    "bell pepper": 0.6, "red pepper": 0.6, "mushroom": 0.3, "potato": 0.65,
    "sweet potato": 0.6, "broccoli": 0.4, "cauliflower": 0.45, "courgette": 0.55,
    "green bean": 0.5, "garlic": 0.6, "ginger": 0.6, "parsley": 0.25, "coriander": 0.07,
    "basil": 0.1, "mint": 0.2, "berry": 0.6, "blueberry": 0.6, "raspberry": 0.5,
    "strawberry": 0.6, "apple": 0.5,
    // Meat and fish, chopped or minced
    "chicken": 0.6, "beef": 0.9, "minced beef": 0.9, "ground beef": 0.9,
    "beef mince": 0.9, "pork": 0.9, "lamb": 0.9, "prawn": 0.6, "shrimp": 0.6,
  };

  // Ingredients that are never counted in pieces, even if a word like
  // "pepper" or "chicken" appears in the name.
  const NOT_PIECES = /powder|flake|ground|paste|sauce|stock(?! cube)|oil|zest|mince|black pepper|white pepper|extract|vinegar/;

  // "Chicken Breasts" -> "chicken breast", "Tomatoes" -> "tomato", "Berries" -> "berry"
  function normalise(name) {
    const IRREGULAR = { leaves: "leaf", loaves: "loaf", halves: "half" };
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // "gruyère" -> "gruyere"
      .split(/[\s,]+/).map((word) => {
      if (IRREGULAR[word]) return IRREGULAR[word];
      if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
      if (word.endsWith("oes")) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s") && !/(ss|us)$/.test(word)) return word.slice(0, -1);
      return word;
    }).join(" ");
  }

  // Find the entry whose name appears in the ingredient name; longest wins.
  function lookup(table, name) {
    const padded = " " + normalise(name) + " ";
    let best = null;
    for (const key of Object.keys(table)) {
      if (padded.includes(" " + key + " ") && (!best || key.length > best.length)) best = key;
    }
    return best ? table[best] : null;
  }

  // Measure words we know are units of something; any other word in a
  // measure ("2 chopped", "1 finely sliced") just describes whole pieces.
  function isUnitWord(word) {
    return word in GENERIC_WORD || Object.values(PIECE_BY_WORD).some((words) => word in words);
  }

  /** Grams in one "word" of this ingredient: one clove of garlic = 5 g. */
  function gramsPerPiece(name, word) {
    const w = normalise(word || "");
    const special = lookup(PIECE_BY_WORD, name);
    if (special && special[w]) return special[w];
    if (GENERIC_WORD[w]) return GENERIC_WORD[w];
    if (NOT_PIECES.test(name.toLowerCase())) return null;
    const piece = lookup(PIECE, name);
    if (piece == null) return null;
    if (SIZE[w]) return piece * SIZE[w]; // "1 large", "1 head"
    if (isUnitWord(w)) return null; // a unit we have no size for, like "1 bag" of fish
    return piece;
  }

  // Any oil weighs about 0.92 g per ml. Checked first, so "olive oil" isn't
  // mistaken for olives or "coconut oil" for coconut.
  function density(name) {
    if (/ oil$/.test(" " + normalise(name))) return 0.92;
    return lookup(DENSITY, name);
  }

  /** Turn { kind, value, word } into grams, or null if we can't tell. */
  function toGrams(amount, name) {
    if (amount.kind === "mass") return amount.value;
    if (amount.kind === "volume") {
      const perMl = density(name);
      return perMl ? amount.value * perMl : null;
    }
    const each = gramsPerPiece(name, amount.word);
    return each ? amount.value * each : null;
  }

  /** The reverse: grams into the kind of unit you used for this ingredient. */
  function fromGrams(grams, kind, name, word) {
    if (kind === "mass") return grams;
    if (kind === "volume") {
      const perMl = density(name);
      return perMl ? grams / perMl : null;
    }
    const each = gramsPerPiece(name, word);
    return each ? grams / each : null;
  }

  return { toGrams, fromGrams, isUnitWord, normalise };
})();
