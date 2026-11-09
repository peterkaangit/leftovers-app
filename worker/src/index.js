/*
 * index.js — the Leftovers API, running on a Cloudflare Worker.
 *
 * This is YOUR API. The website asks it one question:
 *
 *   GET /recipes?items=chicken,rice,onion
 *
 * and the Worker does the hard work on Cloudflare's servers:
 *   1. one TheMealDB search per fridge item (filter.php)
 *   2. count how many of your items each meal uses, best first
 *   3. fetch the full recipe for the top meals (lookup.php)
 *   4. send back one tidy JSON answer
 *
 * The answer has the same shape the website already knows:
 *   { recipes: [{ meal, ingredients, tags, matchedItems }], notFound: [], failed: [] }
 *
 * Later, secret keys (Spoonacular, Claude) will arrive here through `env`,
 * which is why this code lives on a server and not in the browser.
 */

const MEALDB_URL = "https://www.themealdb.com/api/json/v1/1/";

// How many full recipes to fetch.
const MAX_RECIPES = 20;

// The free Cloudflare plan allows 50 outgoing requests per visitor request.
// Each item can take 2 searches (e.g. "eggs", then "egg"), plus 20 lookups:
// 12 items * 2 + 20 = 44, which stays safely under 50.
const MAX_ITEMS = 12;

// Websites that are allowed to call this API from a browser (see CORS below).
const ALLOWED_ORIGINS = [
  "https://finishthefridge.netlify.app", // the live site
  "null", // index.html opened by double-clicking (file://) sends "null"
  "http://localhost:8787", // wrangler dev
];

/* ------------------------------------------------------------------ */
/* Caching                                                             */
/* ------------------------------------------------------------------ */

// A simple memory: TheMealDB URL -> { data, expires }.
// A Worker stays "warm" for a while between visitors, so repeat searches
// skip TheMealDB entirely. It's forgotten whenever Cloudflare restarts the
// Worker, which is fine: it only makes things faster, never different.
const memory = new Map();
const CACHE_MS = 60 * 60 * 1000; // 1 hour

/** fetch() a TheMealDB endpoint and return its JSON, using the memory first. */
async function getJson(endpoint, params) {
  const url = MEALDB_URL + endpoint + "?" + new URLSearchParams(params);

  const remembered = memory.get(url);
  if (remembered && remembered.expires > Date.now()) return remembered.data;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheMealDB answered ${response.status} for ${endpoint}`);
  }
  const data = await response.json();

  memory.set(url, { data, expires: Date.now() + CACHE_MS });
  return data;
}

/* ------------------------------------------------------------------ */
/* Talking to TheMealDB (moved here from the website's mealdb.js)      */
/* ------------------------------------------------------------------ */

/** Meals for ONE ingredient. Tries "egg" if "eggs" finds nothing. */
async function searchByIngredient(ingredient) {
  const data = await getJson("filter.php", { i: ingredient });
  if (data.meals) return data.meals;

  if (ingredient.length > 3 && ingredient.endsWith("s")) {
    const singular = await getJson("filter.php", { i: ingredient.slice(0, -1) });
    if (singular.meals) return singular.meals;
  }
  return [];
}

/** The full recipe for one meal id. */
async function getMealDetails(id) {
  const data = await getJson("lookup.php", { i: id });
  return data.meals ? data.meals[0] : null;
}

/** strIngredient1..20 + strMeasure1..20 -> [{ name, measure }] */
function extractIngredients(meal) {
  const list = [];
  for (let n = 1; n <= 20; n++) {
    const name = (meal["strIngredient" + n] || "").trim();
    const measure = (meal["strMeasure" + n] || "").trim();
    if (name) list.push({ name, measure });
  }
  return list;
}

/** "Meat,casserole" -> ["Meat", "Casserole"] */
function extractTags(meal) {
  const tags = (meal.strTags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag[0].toUpperCase() + tag.slice(1));
  return [...new Set(tags)];
}

/** Search, count, rank and fetch the full recipes. */
async function findRecipes(items) {
  // Run every search at the same time; one failure doesn't sink the rest.
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

  if (failed.length === items.length) {
    throw new Error("Couldn't reach TheMealDB. Try again in a moment.");
  }

  // Most matched items first; ties in alphabetical order.
  const ranked = [...byId.values()]
    .sort((a, b) =>
      b.matchedItems.length - a.matchedItems.length ||
      a.summary.strMeal.localeCompare(b.summary.strMeal))
    .slice(0, MAX_RECIPES);

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

/* ------------------------------------------------------------------ */
/* Answering requests                                                  */
/* ------------------------------------------------------------------ */

/**
 * CORS ("Cross-Origin Resource Sharing"): a browser only lets a website
 * read an answer from ANOTHER address if that address says it's allowed.
 * These headers are how the Worker says "yes, your site may read this".
 */
function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

/** Turn a JS object into a JSON response with the right headers. */
function json(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

export default {
  // Cloudflare calls this for every request that reaches the Worker.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Browsers sometimes ask "may I?" first with an OPTIONS request.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === "/recipes" && request.method === "GET") {
      // "chicken, Rice,,onion" -> ["chicken", "rice", "onion"]
      const items = [...new Set(
        (url.searchParams.get("items") || "")
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )];

      if (items.length === 0) {
        return json(request, { error: "Add ?items=... with at least one ingredient." }, 400);
      }
      if (items.length > MAX_ITEMS) {
        return json(request, { error: `Please search for at most ${MAX_ITEMS} items at once.` }, 400);
      }

      try {
        const result = await findRecipes(items);
        // Let the browser reuse this answer for 10 minutes.
        return json(request, result, 200, { "Cache-Control": "public, max-age=600" });
      } catch (error) {
        return json(request, { error: error.message }, 502);
      }
    }

    // A small welcome page, so the bare address explains itself.
    if (url.pathname === "/") {
      return json(request, {
        name: "Leftovers API",
        try: "/recipes?items=chicken,rice,onion",
      });
    }

    return json(request, { error: "Not found. Try /recipes?items=chicken,rice" }, 404);
  },
};
