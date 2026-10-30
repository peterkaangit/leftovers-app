# Leftovers

Type what's in your fridge, get recipes that use up as much of it as possible.
Recipes and ingredient photos come from [TheMealDB](https://www.themealdb.com/api.php), a free recipe API.
Background photos are from [Unsplash](https://unsplash.com).

## Run it on your computer

Double-click `index.html`. That's it: no install, no build step.
(If your browser blocks anything, open the folder in VS Code and use the "Live Server" extension.)

## Files

```
index.html       the page itself
css/style.css    how it looks
js/mealdb.js     ALL the API calls live here
js/units.js      metric / US amounts, scaling and converting recipe measures
js/kitchen.js    the menu maths: what's left in your kitchen, the grocery list
js/backdrops.js  the list of background photos (swap in your own here)
js/app.js        reads your ingredients and draws the results
```

## How the API calls work

An API is a website made for programs instead of people. You visit a URL and
instead of a web page you get back data, usually as JSON.

Try these in your browser's address bar:

- https://www.themealdb.com/api/json/v1/1/filter.php?i=chicken
  "Which meals contain chicken?" Returns a short list: id, name and photo for each meal.
- https://www.themealdb.com/api/json/v1/1/lookup.php?i=52795
  "Give me everything about meal 52795." Returns the full recipe.

Parts of that URL:

| Part | Meaning |
| --- | --- |
| `https://www.themealdb.com/api/json/v1/` | the API's base address (version 1, JSON format) |
| `1` | the API key. `1` is the free public test key |
| `filter.php` / `lookup.php` | the endpoint: which question you're asking |
| `?i=chicken` | the query parameter: the details of the question |

What the site does when you press **Find recipes**:

1. `filter.php` only accepts one ingredient, so it sends one request per item,
   all at the same time (`Promise.allSettled` in `mealdb.js`).
2. It counts how many of your items each meal appeared for, and sorts by that.
3. It calls `lookup.php` for the top 20 to get ingredients, instructions,
   cuisine (`strArea`), meal type (`strCategory`) and tags (`strTags`).
4. The Cuisine / Meal type / Tag dropdowns are built from those 20 recipes.
   Filtering happens in the browser, with no extra API calls.
5. `app.js` draws a "cookbook page" for each one, 6 at a time.

Ingredient cut-out photos are plain image URLs, not API calls:
`https://www.themealdb.com/images/ingredients/Garlic-Small.png`

To see the requests happen, press F12 in your browser, open the **Network** tab
and search for something.

## Servings, menu and grocery list

TheMealDB doesn't say how many people a recipe serves, so the site assumes 4
(`DEFAULT_SERVES` in `js/kitchen.js`); you can change it per recipe. Amounts are
multiplied by *people eating ÷ recipe serves*.

When you add a dish to your menu, `Kitchen.plan()` goes through the menu in
order, takes each dish's ingredients out of your kitchen, and puts whatever
your kitchen can't cover on the grocery list. The remaining dishes are then
re-ranked by how many of your ingredients are still left. None of this calls
the API: it all works on the recipes already fetched.

## Deploying to Netlify

This folder is the whole site. Push it to a GitHub repo and connect the repo in
Netlify, leaving the build command empty and the publish directory as the repo root.

## What's next

Step 2 moves the API calls into a Cloudflare Worker. Only `js/mealdb.js` will need
to change, because the rest of the site only ever calls `MealDB.findRecipes(items)`.
