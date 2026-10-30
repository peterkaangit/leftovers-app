/*
 * kitchen.js — the bookkeeping behind the menu and the grocery list.
 *
 * No API calls and no page drawing here, just maths:
 *   - which of your ingredients a recipe ingredient is,
 *   - what's left in your kitchen after the dishes on your menu,
 *   - what you still need to buy.
 *
 * Amounts are compared in base units (grams, millilitres, pieces) using
 * units.js. When the kinds differ, for example you entered grams and the
 * recipe says "1 whole chicken" or "2 cups", weights.js converts through
 * grams. Only when even that isn't possible do we assume you have enough.
 */

const Kitchen = (() => {
  // TheMealDB doesn't say how many people a recipe is for, so we assume this.
  const DEFAULT_SERVES = 4;

  // Words that turn an ingredient into a different product:
  // "chicken stock" is not your chicken, "garlic powder" is not your garlic.
  const PRODUCT_WORDS = /\b(stock|broth|sauce|oil|powder|paste|juice|cube|cubes|granules|extract|vinegar)$/;

  // Things you can only use whole. If you entered them in pieces and a recipe
  // asks for "3 tbsp beaten egg", that still takes a whole egg out of your stock.
  const WHOLE_ITEMS = /\b(egg|eggs|avocado|avocados|stock cube|stock cubes|vanilla pod|vanilla pods|tortilla|tortillas|pita|pitta|naan|bun|buns|bread roll|bread rolls|croissant|croissants|wrap|wraps|taco shell|taco shells|sausage|sausages|burger|burgers)$/;

  // Things nobody needs to buy.
  const NEVER_BUY = new Set(["water", "ice", "hot water", "cold water"]);

  /** Which of your items (if any) a recipe ingredient like "Chicken Breast" is. */
  function matchItem(ingredientName, items) {
    const lower = ingredientName.toLowerCase();
    return items.find((item) => {
      const word = item.name.replace(/s$/, "");
      if (!lower.includes(word)) return false;
      return !PRODUCT_WORDS.test(lower) || PRODUCT_WORDS.test(item.name);
    });
  }

  /**
   * Your starting stock: one entry per item.
   * value is null when you didn't give an amount ("I have some").
   */
  function startingStock(items) {
    const stock = new Map();
    for (const item of items) {
      const base = item.amount == null ? null : Units.toBase(item.amount, item.unit);
      stock.set(item.name, {
        item,
        kind: base ? base.kind : null,
        start: base ? base.value : null,
        value: base ? base.value : null,
      });
    }
    return stock;
  }

  /**
   * How much of one recipe ingredient is needed, scaled:
   * { kind, value, word } (word is e.g. "cloves" for counts), or null.
   */
  function need(measure, factor) {
    const parsed = Units.parseMeasure(measure);
    if (!parsed) {
      // "Juice of 2" (lemons) means 2 of them.
      const of = /\bof\s+(\d+)/i.exec(measure || "");
      if (of) return { kind: "count", value: Number(of[1]) * factor, word: "" };
      // "Whole" with no number, as in "Chicken: whole", means one.
      return /whole/i.test(measure || "") ? { kind: "count", value: factor, word: "" } : null;
    }
    const base = Units.toBase(parsed.amount * factor, parsed.unit);
    return { ...base, word: parsed.word };
  }

  /**
   * Express what a recipe needs in the same kind of unit as your stock, so
   * they can be subtracted. "1 whole chicken" against 800 g of chicken gives
   * 1500 (grams). Returns null when there's no sensible conversion.
   */
  function inStockUnits(needed, recipeName, entry) {
    // Plain counts ("2", "1 large", "3 chopped") compare directly with your pieces.
    const plainCount = needed.kind === "count" && !Weights.isUnitWord(Weights.normalise(needed.word));
    if (needed.kind === entry.kind && (needed.kind !== "count" || plainCount)) {
      return needed.value;
    }
    const grams = Weights.toGrams(needed, recipeName);
    if (grams == null) return null;
    const wanted = Weights.fromGrams(grams, entry.kind, entry.item.name, "");
    if (wanted != null && entry.kind === "count" && WHOLE_ITEMS.test(entry.item.name.toLowerCase().trim())) {
      return Math.ceil(wanted - 0.001);
    }
    return wanted;
  }

  /**
   * Walk through the menu in order, taking each dish's ingredients out of
   * your stock. Whatever your stock can't cover goes on the grocery list.
   *
   *   menu:      [{ recipe, factor }]   factor 0.5 = half the recipe
   *   returns:   { stock, grocery }
   */
  function plan(items, menu) {
    const stock = startingStock(items);
    const grocery = new Map(); // lower-case name -> line

    function addToGrocery(name, amount, measureText, dish) {
      const key = name.toLowerCase();
      if (NEVER_BUY.has(key)) return;
      if (!grocery.has(key)) {
        grocery.set(key, { name, mass: 0, volume: 0, counts: new Map(), notes: new Set(), dishes: new Set() });
      }
      const line = grocery.get(key);
      line.dishes.add(dish);
      if (!amount) {
        if (measureText && measureText.trim()) line.notes.add(measureText.trim().toLowerCase());
      } else if (amount.kind === "count") {
        // Keep "cloves" and "large" apart, so we never add 3 cloves to 1 large.
        const word = (Units.parseMeasure(measureText) || { word: "" }).word.toLowerCase();
        line.counts.set(word, (line.counts.get(word) || 0) + amount.value);
      } else {
        line[amount.kind] += amount.value;
      }
    }

    for (const { recipe, factor } of menu) {
      const dish = recipe.meal.strMeal;
      for (const { name, measure } of recipe.ingredients) {
        const needed = need(measure, factor);
        const item = matchItem(name, items);

        if (!item) {
          addToGrocery(name, needed, measure, dish);
          continue;
        }
        const entry = stock.get(item.name);
        // No amount given, or units we can't convert: assume you have enough.
        if (entry.value == null || !needed) continue;
        const wanted = inStockUnits(needed, name, entry);
        if (wanted == null) continue;

        const used = Math.min(entry.value, wanted);
        entry.value -= used;
        // Whatever's missing goes on the list, in the recipe's own units.
        const shortShare = (wanted - used) / wanted;
        if (shortShare > 0.0001) {
          let value = needed.value * shortShare;
          // You can't buy half a chicken: round whole things up.
          if (needed.kind === "count" && !Weights.isUnitWord(Weights.normalise(needed.word))) value = Math.ceil(value - 0.001);
          addToGrocery(name, { kind: needed.kind, value }, measure, dish);
        }
      }
    }
    return { stock, grocery: [...grocery.values()] };
  }

  /** "500 g + 2 cloves, to taste" — one grocery line's amounts in words. */
  function describeLine(line, system) {
    const parts = [];
    if (line.mass) parts.push(Units.formatBase("mass", line.mass, system));
    if (line.volume) parts.push(Units.formatBase("volume", line.volume, system));
    for (const [word, count] of line.counts) {
      parts.push(word ? `${Units.formatNumber(count, "pcs")} ${word}` : Units.format(count, "pcs"));
    }
    const amounts = parts.join(" + ");
    const notes = [...line.notes].join(", ");
    return [amounts, notes].filter(Boolean).join(", ");
  }

  /** Is this item still available after the menu? (No amount given = yes.) */
  function isAvailable(entry) {
    return entry && (entry.value == null || entry.value > 0.0001);
  }

  /**
   * For one ingredient of a recipe you're looking at, compare what's left
   * in your kitchen with what the recipe needs.
   * Returns { text, short } or null if it's not one of your items.
   */
  function check(ingredientName, measure, factor, items, stock, system) {
    const item = matchItem(ingredientName, items);
    if (!item) return null;
    const entry = stock.get(item.name);
    if (entry.value == null) return { text: "In your kitchen", short: false };
    const left = Units.formatBase(entry.kind, entry.value, system);
    if (entry.value <= 0.0001) return { text: "Used up by your menu", short: true };

    const needed = need(measure, factor);
    const wanted = needed && inStockUnits(needed, ingredientName, entry);
    if (wanted == null) return { text: `You have ${left}`, short: false };
    const missing = wanted - entry.value;
    if (missing <= 0.0001) return { text: `You have ${left}, that's enough`, short: false };
    return { text: `You have ${left}, need ${Units.formatBase(entry.kind, missing, system)} more`, short: true };
  }

  return { DEFAULT_SERVES, matchItem, plan, describeLine, isAvailable, check };
})();
