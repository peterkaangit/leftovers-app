/*
 * mealdb.js — everything that talks to the API lives in this one file.
 *
 * The rest of the site never calls fetch() itself. It only calls
 * MealDB.findRecipes(items).
 *
 * Step 2 change: the site no longer calls TheMealDB itself. It asks YOUR
 * API, the Cloudflare Worker, which does the searching and ranking on
 * Cloudflare's servers and answers with one JSON object:
 *
 *   GET https://worker.kaan-peter.workers.dev/recipes?items=chicken,rice
 *   -> { recipes: [{ meal, ingredients, tags, matchedItems }], notFound, failed }
 *
 * The Worker's code is in worker/src/index.js.
 */

const MealDB = (() => {
  // The address of your Worker (your own API).
  const API_URL = "https://worker.kaan-peter.workers.dev";

  /**
   * The main function the website calls. One request to the Worker,
   * which returns { recipes, notFound, failed }.
   */
  async function findRecipes(items) {
    // URLSearchParams escapes spaces and commas inside names for us.
    const url = API_URL + "/recipes?" + new URLSearchParams({ items: items.join(",") });

    let response;
    try {
      response = await fetch(url);
    } catch (networkError) {
      // fetch() only throws when no answer arrived at all (offline, blocked by CORS...).
      throw new Error("Couldn't reach the recipe service. Check your internet connection and try again.");
    }

    // If the answer isn't JSON (rare: e.g. a Cloudflare error page), use an empty object.
    const data = await response.json().catch(() => ({}));

    // A 400 or 502 still "succeeds" in fetch(), so check the status ourselves.
    // The Worker puts a readable message in data.error.
    if (!response.ok) {
      throw new Error(data.error || `The recipe service answered ${response.status}.`);
    }
    return data;
  }

  /**
   * TheMealDB also hosts a cut-out photo of every ingredient, e.g.
   * https://www.themealdb.com/images/ingredients/Lime-Small.png
   * This isn't an API call, just an image URL we can put in an <img>,
   * so it can stay in the browser.
   */
  function ingredientImage(name, size = "Small") {
    const title = name.trim().replace(/\b\w/g, (c) => c.toUpperCase()); // "red onion" -> "Red Onion"
    const suffix = size ? "-" + size : "";
    return "https://www.themealdb.com/images/ingredients/" + encodeURIComponent(title) + suffix + ".png";
  }

  // Only these are visible to the rest of the site.
  return { findRecipes, ingredientImage };
})();
