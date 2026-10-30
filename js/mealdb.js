/*
 * mealdb.js — everything that talks to the API lives in this one file.
 *
 * The rest of the site never calls fetch() itself. It only calls
 * MealDB.findRecipes(items). That way, when we later move the API calls
 * into a Cloudflare Worker (step 2), this is the only file that changes.
 *
 * About TheMealDB:
 *   - Base URL: https://www.themealdb.com/api/json/v1/1/
 *     The "1" at the end is the free test API key. It's public, so it's
 *     fine to have it in browser code. A *secret* key (like the Claude key
 *     in step 3) must never be put here, because anyone can read this file.
 *   - Every endpoint returns JSON shaped like { "meals": [...] },
 *     or { "meals": null } when nothing matched.
 *
 * The two endpoints we use:
 *   filter.php?i=chicken   -> short list of meals containing that ingredient
 *                             (only idMeal, strMeal, strMealThumb)
 *   lookup.php?i=52772     -> the full recipe for one meal id
 *                             (instructions, ingredients, measures, ...)
 */

const MealDB = (() => {
  const BASE_URL = "https://www.themealdb.com/api/json/v1/1/";

  // How many full recipes to fetch. Each one is an extra request, but we
  // need the full details (cuisine, category, tags) to offer filters.
  const MAX_RECIPES = 20;

  /**
   * Small helper around fetch(). It builds the URL, sends a GET request,
   * checks the HTTP status and turns the response body into a JS object.
   */
  async function getJson(endpoint, params) {
    // URLSearchParams turns { i: "sweet potato" } into "i=sweet+potato",
    // escaping spaces and special characters for us.
    const url = BASE_URL + endpoint + "?" + new URLSearchParams(params);

    const response = await fetch(url);

    // fetch() only throws on network failures (offline, DNS, CORS...).
    // A 404 or 500 still "succeeds", so we have to check the status ourselves.
    if (!response.ok) {
      throw new Error(`TheMealDB answered ${response.status} for ${endpoint}`);
    }
    return response.json();
  }

  /**
   * Search meals for ONE ingredient. Returns an array (maybe empty).
   * If "eggs" finds nothing we also try "egg", because TheMealDB
   * matches ingredient names exactly.
   */
  async function searchByIngredient(ingredient) {
    const data = await getJson("filter.php", { i: ingredient });
    if (data.meals) return data.meals;

    if (ingredient.length > 3 && ingredient.endsWith("s")) {
      const singular = await getJson("filter.php", { i: ingredient.slice(0, -1) });
      if (singular.meals) return singular.meals;
    }
    return [];
  }

  /** Fetch the full recipe for one meal id. */
  async function getMealDetails(id) {
    const data = await getJson("lookup.php", { i: id });
    return data.meals ? data.meals[0] : null;
  }

  /**
   * The full recipe stores ingredients in 20 numbered fields
   * (strIngredient1..20 and strMeasure1..20), with blanks for unused ones.
   * This turns them into a tidy array: [{ name: "Garlic", measure: "2 cloves" }, ...]
   */
  function extractIngredients(meal) {
    const list = [];
    for (let n = 1; n <= 20; n++) {
      const name = (meal["strIngredient" + n] || "").trim();
      const measure = (meal["strMeasure" + n] || "").trim();
      if (name) list.push({ name, measure });
    }
    return list;
  }

  /**
   * strTags is a loose, comma-separated text field like "Meat,Casserole",
   * or null. This turns it into a clean array: ["Meat", "Casserole"].
   */
  function extractTags(meal) {
    const tags = (meal.strTags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag[0].toUpperCase() + tag.slice(1));
    return [...new Set(tags)];
  }

  /**
   * The main function the website calls.
   *
   * 1. Run one filter.php search per item, all at the same time.
   * 2. Count, for every meal, how many of your items it showed up for.
   * 3. Sort by that count, best first.
   * 4. Fetch lookup.php for the top few to get the full recipes.
   *
   * Returns:
   *   {
   *     recipes:    [{ meal, ingredients, tags, matchedItems }],
   *     notFound:   items that matched no meal at all,
   *     failed:     items whose request failed (network/server error)
   *   }
   */
  async function findRecipes(items) {
    // Promise.allSettled waits for every search, even if some fail,
    // so one bad request doesn't throw away all the other results.
    const searches = await Promise.allSettled(items.map(searchByIngredient));

    const byId = new Map(); // idMeal -> { summary, matchedItems: [] }
    const notFound = [];
    const failed = [];

    searches.forEach((result, index) => {
      const item = items[index];
      if (result.status === "rejected") {
        failed.push(item);
        return;
      }
      if (result.value.length === 0) {
        notFound.push(item);
        return;
      }
      for (const meal of result.value) {
        if (!byId.has(meal.idMeal)) {
          byId.set(meal.idMeal, { summary: meal, matchedItems: [] });
        }
        byId.get(meal.idMeal).matchedItems.push(item);
      }
    });

    // If every single request failed, that's an error, not "no results".
    if (failed.length === items.length) {
      throw new Error("Couldn't reach TheMealDB. Check your internet connection and try again.");
    }

    // Most matched items first. Ties keep alphabetical order so results are stable.
    const ranked = [...byId.values()]
      .sort((a, b) =>
        b.matchedItems.length - a.matchedItems.length ||
        a.summary.strMeal.localeCompare(b.summary.strMeal))
      .slice(0, MAX_RECIPES);

    // Fetch the full recipes in parallel.
    const details = await Promise.allSettled(
      ranked.map((entry) => getMealDetails(entry.summary.idMeal))
    );

    const recipes = [];
    details.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        recipes.push({
          meal: result.value,
          ingredients: extractIngredients(result.value),
          tags: extractTags(result.value),
          matchedItems: ranked[index].matchedItems,
        });
      }
    });

    return { recipes, notFound, failed };
  }

  /**
   * TheMealDB also hosts a cut-out photo of every ingredient, e.g.
   * https://www.themealdb.com/images/ingredients/Lime-Small.png
   * This isn't a JSON endpoint, just an image URL we can put in an <img>.
   */
  function ingredientImage(name, size = "Small") {
    const title = name.trim().replace(/\b\w/g, (c) => c.toUpperCase()); // "red onion" -> "Red Onion"
    const suffix = size ? "-" + size : "";
    return "https://www.themealdb.com/images/ingredients/" + encodeURIComponent(title) + suffix + ".png";
  }

  // Only these are visible to the rest of the site.
  return { findRecipes, searchByIngredient, getMealDetails, ingredientImage };
})();
