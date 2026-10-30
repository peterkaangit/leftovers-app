/*
 * units.js — amounts and measurement systems.
 *
 * Nothing in here talks to the API. It does two jobs:
 *   1. Convert your own amounts between metric (g, ml) and US (oz, cups).
 *   2. Read TheMealDB's free-text measures like "1 cup" or "500g" and
 *      rewrite them in the system you picked.
 *
 * Every unit is stored as a multiple of a base unit:
 *   mass   -> grams
 *   volume -> millilitres
 *   count  -> pieces (never converted)
 */

const Units = (() => {
  const DEFS = {
    g:       { kind: "mass",   base: 1,      system: "metric" },
    kg:      { kind: "mass",   base: 1000,   system: "metric" },
    oz:      { kind: "mass",   base: 28.35,  system: "us" },
    lb:      { kind: "mass",   base: 453.6,  system: "us" },
    ml:      { kind: "volume", base: 1,      system: "metric" },
    l:       { kind: "volume", base: 1000,   system: "metric" },
    cup:     { kind: "volume", base: 240,    system: "us" },
    "fl oz": { kind: "volume", base: 29.57,  system: "us" },
    // Spoons are used on both sides of the Atlantic, so we leave them alone
    // in metric mode and only use them as targets in US mode.
    tbsp:    { kind: "volume", base: 15,     system: "both" },
    tsp:     { kind: "volume", base: 5,      system: "both" },
    pcs:     { kind: "count",  base: 1,      system: "both" },
  };

  // The units offered in the amount dropdown for each system.
  const CHOICES = {
    metric: ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp"],
    us:     ["pcs", "oz", "lb", "cup", "fl oz", "tbsp", "tsp"],
  };

  // Different ways recipes write the same unit.
  const ALIASES = {
    g: "g", gr: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
    kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
    oz: "oz", ounce: "oz", ounces: "oz",
    lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
    ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
    l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
    cup: "cup", cups: "cup",
    "fl oz": "fl oz", "fluid ounce": "fl oz", "fluid ounces": "fl oz",
    tbsp: "tbsp", tbs: "tbsp", tblsp: "tbsp", tbls: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
    tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  };

  const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

  /** Best guess at the visitor's system: US English gets cups, everyone else grams. */
  function defaultSystem() {
    return (navigator.language || "").toLowerCase() === "en-us" ? "us" : "metric";
  }

  /** Express an amount in the nicest unit of the target system. */
  function toSystem(amount, unit, system) {
    const def = DEFS[unit];
    if (!def || def.system === system || def.kind === "count") return { amount, unit };
    // Spoons stay as spoons in metric mode.
    if (def.system === "both" && system === "metric") return { amount, unit };

    const base = amount * def.base;
    let target;
    if (def.kind === "mass") {
      target = system === "metric" ? (base >= 1000 ? "kg" : "g") : (base >= 453.6 ? "lb" : "oz");
    } else if (system === "metric") {
      target = base >= 1000 ? "l" : "ml";
    } else {
      target = base < 15 ? "tsp" : base < 60 ? "tbsp" : "cup";
    }
    return { amount: base / DEFS[target].base, unit: target };
  }

  /** Round to something a cook would write: ¼ cups, whole grams, 1 decimal oz. */
  function formatNumber(amount, unit) {
    if (unit === "cup" || unit === "tsp" || unit === "tbsp" || unit === "pcs") {
      const quarters = Math.round(amount * 4) / 4;
      const whole = Math.floor(quarters);
      const part = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[quarters - whole] || "";
      return (whole || !part ? String(whole) : "") + part;
    }
    if (unit === "g" || unit === "ml") return String(Math.round(amount / 5) * 5 || Math.round(amount));
    return String(Math.round(amount * 10) / 10);
  }

  function format(amount, unit) {
    if (unit === "pcs") return `${formatNumber(amount, unit)} ${amount > 1 ? "pieces" : "piece"}`;
    const label = unit === "cup" && amount > 1.125 ? "cups" : unit;
    return `${formatNumber(amount, unit)} ${label}`;
  }

  /** Turn "1 ½", "1/2", "1.5" or "1,5" into a number. */
  function parseNumber(text) {
    text = text.trim().replace(",", ".");
    let total = 0;
    for (const [symbol, value] of Object.entries(FRACTIONS)) {
      if (text.includes(symbol)) { total += value; text = text.replace(symbol, ""); }
    }
    for (const part of text.split(/\s+/).filter(Boolean)) {
      if (part.includes("/")) {
        const [top, bottom] = part.split("/").map(Number);
        total += top / bottom;
      } else {
        total += Number(part);
      }
    }
    return total;
  }

  /**
   * Read a recipe measure like "500g", "1 1/2 cups", "2 tbs chopped" or "3 cloves".
   * Returns { amount, unit, word, rest }, or null when there's no number
   * to work with (e.g. "to taste", "pinch").
   * Measures without a known unit ("3 cloves", "1 large", "4") are treated
   * as a count: unit "pcs", and word keeps the original word ("cloves").
   */
  function parseMeasure(text) {
    const match = /^\s*((?:\d+(?:[.,]\d+)?\s*)?(?:\d+\/\d+|[½¼¾⅓⅔⅛])?)(?![\d/.,])\s*(fl\.?\s?oz|fluid ounces?|[a-zA-Z]+)?\b\.?(.*)$/.exec(text || "");
    if (!match || !match[1].trim()) return null;
    const amount = parseNumber(match[1]);
    if (!(amount > 0)) return null;
    const word = match[2] || "";
    const unit = ALIASES[word.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").replace("floz", "fl oz")];
    if (unit) return { amount, unit, word: "", rest: match[3] };
    return { amount, unit: "pcs", word, rest: match[3] };
  }

  /**
   * Rewrite a recipe measure for a different number of people (factor 0.5 =
   * half the amounts) in the chosen system. "to taste" and friends are
   * returned unchanged.
   */
  function scaleMeasure(text, factor, system) {
    const parsed = parseMeasure(text);
    if (!parsed) return (text || "").trim();
    const amount = parsed.amount * factor;
    if (parsed.unit === "pcs") {
      return `${formatNumber(amount, "pcs")} ${parsed.word}${parsed.rest}`.trim();
    }
    if (DEFS[parsed.unit].system === "both") {
      // Spoons: stay spoons in metric, and toSystem leaves them alone in US too.
      return (format(amount, parsed.unit) + parsed.rest).trim();
    }
    const base = toBase(amount, parsed.unit);
    return (formatBase(base.kind, base.value, system) + parsed.rest).trim();
  }

  /**
   * Turn any amount into its base unit so different units can be added up
   * and compared: { kind: "mass", value: grams }, { kind: "volume", value: ml }
   * or { kind: "count", value: pieces }.
   */
  function toBase(amount, unit) {
    const def = DEFS[unit];
    return def ? { kind: def.kind, value: amount * def.base } : null;
  }

  /** The reverse of toBase, written nicely in the chosen system. */
  function formatBase(kind, value, system) {
    if (kind === "count") return format(value, "pcs");
    // Small volumes read better as spoons in both systems: 15 ml -> 1 tbsp.
    if (kind === "volume" && value < 50) return value < 15 ? format(value / 5, "tsp") : format(value / 15, "tbsp");
    const unit = kind === "mass" ? "g" : "ml";
    const shown = toSystem(value, unit, system === "us" ? "us" : "metric");
    // In metric mode toSystem keeps ml/g, so pick kg / l for big amounts here.
    if (system === "metric" && value >= 1000) return format(value / 1000, unit === "g" ? "kg" : "l");
    return format(shown.amount, shown.unit);
  }

  return { CHOICES, defaultSystem, toSystem, format, formatNumber, parseMeasure, scaleMeasure, toBase, formatBase };
})();
