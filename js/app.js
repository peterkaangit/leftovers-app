/*
 * app.js — the page logic: reading your ingredients and amounts, the photo
 * background, and drawing the results. It never talks to the API directly;
 * it asks MealDB.findRecipes() (in mealdb.js) and draws whatever comes back.
 */

const form = document.getElementById("fridge-form");
const input = document.getElementById("item-input");
const amountInput = document.getElementById("amount-input");
const unitSelect = document.getElementById("unit-select");
const addButton = document.getElementById("add-button");
const systemButtons = document.querySelectorAll(".system-toggle button");
const chipList = document.getElementById("chips");
const findButton = document.getElementById("find-button");
const exampleButton = document.getElementById("example-button");
const statusBox = document.getElementById("status");
const results = document.getElementById("results");
const filtersBox = document.getElementById("filters");
const filterCount = document.getElementById("filter-count");
const clearButton = document.getElementById("clear-filters");
const moreButton = document.getElementById("more-button");

// The three filter dropdowns, and which recipe field each one looks at.
const FILTERS = {
  area:     { select: document.getElementById("filter-area"),     any: "Any cuisine",   values: (r) => [r.meal.strArea] },
  category: { select: document.getElementById("filter-category"), any: "Any meal type", values: (r) => [r.meal.strCategory] },
  tag:      { select: document.getElementById("filter-tag"),      any: "Any tag",       values: (r) => r.tags },
};

// How many dishes to show at a time.
const PAGE_SIZE = 6;
let shownCount = PAGE_SIZE;

// Your ingredients, e.g. [{ name: "chicken", amount: 300, unit: "g" }, ...].
// amount is null when you didn't give one. Amounts are kept in the unit you
// typed them in, and converted only when shown.
let items = [];

// "metric" or "us". Remembered between visits in the browser's localStorage.
let system = loadSystem();

// The last search, so switching units can redraw it without asking the API again.
let lastRecipes = [];

/* ---------- Small helpers ---------- */

// We build the page with createElement + textContent instead of pasting
// HTML strings. textContent can never run code hidden in API data,
// which is a good habit whenever you display data from an API.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function names() {
  return items.map((item) => item.name);
}

// Joins ["a", "b", "c"] into "a, b and c".
function sentenceList(words) {
  return words.length < 2 ? words.join("") : words.slice(0, -1).join(", ") + " and " + words.at(-1);
}

// "300 g", or "" when no amount was given, in the currently chosen system.
function amountText(item) {
  if (item.amount == null) return "";
  const shown = Units.toSystem(item.amount, item.unit, system);
  return Units.format(shown.amount, shown.unit);
}

/* ---------- Metric / US switch ---------- */

function loadSystem() {
  try {
    const saved = localStorage.getItem("leftovers-system");
    if (saved === "metric" || saved === "us") return saved;
  } catch (error) { /* storage blocked, e.g. private browsing */ }
  return Units.defaultSystem();
}

function setSystem(next) {
  system = next;
  try { localStorage.setItem("leftovers-system", next); } catch (error) { /* ignore */ }

  systemButtons.forEach((button) =>
    button.setAttribute("aria-checked", String(button.dataset.system === system)));

  // Fill the unit dropdown with this system's units.
  unitSelect.replaceChildren(...Units.CHOICES[system].map((unit) => {
    const option = el("option", null, unit === "pcs" ? "pieces" : unit);
    option.value = unit;
    return option;
  }));
  unitSelect.value = system === "metric" ? "g" : "oz";

  renderChips();
  renderResults();
}

systemButtons.forEach((button) =>
  button.addEventListener("click", () => setSystem(button.dataset.system)));

/* ---------- Managing your ingredients ---------- */

function addFromForm() {
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  const amount = Number(amountInput.value.replace(",", "."));
  const hasAmount = amountInput.value.trim() !== "" && amount > 0;

  // "chicken, rice, garlic" adds several at once (the amount goes on the last one).
  const parts = text.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  parts.forEach((name, index) => {
    const isLast = index === parts.length - 1;
    const entry = {
      name,
      amount: isLast && hasAmount ? amount : null,
      unit: unitSelect.value,
    };
    const existing = items.findIndex((item) => item.name === name);
    if (existing >= 0) items[existing] = entry; // adding again updates the amount
    else items.push(entry);
  });

  input.value = "";
  amountInput.value = "";
  input.focus();
  renderChips();
}

function removeItem(name) {
  items = items.filter((item) => item.name !== name);
  renderChips();
}

function renderChips() {
  // Remember what was already shown, so only new items animate in.
  const alreadyShown = new Set([...chipList.children].map((li) => li.dataset.item));
  chipList.replaceChildren();

  for (const item of items) {
    const chip = el("li", "chip");
    chip.dataset.item = item.name;
    if (!alreadyShown.has(item.name)) chip.classList.add("arrives");

    // A small cut-out photo of the ingredient, from TheMealDB.
    const photo = el("img", "chip-photo");
    photo.src = MealDB.ingredientImage(item.name);
    photo.alt = "";
    photo.addEventListener("error", () => photo.remove()); // no photo for this word

    const text = el("span", "chip-text");
    text.append(el("span", "chip-name", item.name));
    const amount = amountText(item);
    if (amount) text.append(el("span", "chip-amount", amount));

    const remove = el("button", "chip-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.addEventListener("click", () => removeItem(item.name));

    chip.append(photo, text, remove);
    chipList.append(chip);
  }
  findButton.disabled = items.length === 0;
}

addButton.addEventListener("click", addFromForm);
form.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the browser reloading the page
  addFromForm();
});

// Enter in either box adds the ingredient. Enter on an empty form searches.
[input, amountInput].forEach((box) =>
  box.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (input.value.trim()) addFromForm();
    else if (items.length) search();
  }));

exampleButton.addEventListener("click", () => {
  const g = system === "metric";
  items = [
    { name: "chicken", amount: g ? 400 : 14, unit: g ? "g" : "oz" },
    { name: "rice", amount: g ? 250 : 1, unit: g ? "g" : "cup" },
    { name: "garlic", amount: 4, unit: "pcs" },
    { name: "onion", amount: 1, unit: "pcs" },
    { name: "spinach", amount: null, unit: "g" },
  ];
  renderChips();
});

/* ---------- Searching ---------- */

findButton.addEventListener("click", search);

async function search() {
  if (items.length === 0) {
    showStatus("Add at least one ingredient first.", "info");
    return;
  }

  setLoading(true);
  lastRecipes = [];
  results.replaceChildren();
  filtersBox.hidden = true;
  moreButton.hidden = true;
  showStatus(`Looking for dishes with your ${items.length} ingredient${items.length > 1 ? "s" : ""}`, "loading");
  // On phones the results are below the fold, so bring them into view.
  statusBox.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const { recipes, notFound, failed } = await MealDB.findRecipes(names());

    if (recipes.length === 0) {
      showStatus("No dishes use those ingredients. Try simpler names, like \"chicken\" instead of \"leftover roast chicken\".", "info");
      return;
    }

    let message = `Found ${recipes.length} dish${recipes.length > 1 ? "es" : ""}, best match first.`;
    if (notFound.length) message += ` Nothing uses ${sentenceList(notFound)}.`;
    if (failed.length) message += ` Couldn't search for ${sentenceList(failed)}, try again.`;
    showStatus(message, "info");

    lastRecipes = recipes;
    buildFilters();
    shownCount = PAGE_SIZE;
    renderResults();
  } catch (error) {
    console.error(error); // full details in the browser's developer console (F12)
    showStatus(error.message || "Something went wrong. Try again.", "error");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  findButton.disabled = isLoading || items.length === 0;
  findButton.textContent = isLoading ? "Searching…" : "Find recipes";
}

function showStatus(text, kind) {
  statusBox.textContent = text;
  statusBox.className = "status status-" + kind;
}

/* ---------- Filters ---------- */

// Fill each dropdown with the values found in this search, with counts,
// e.g. "Italian (4)". This needs no extra API calls: the full recipes
// we already fetched carry their cuisine, category and tags.
function buildFilters() {
  for (const filter of Object.values(FILTERS)) {
    const counts = new Map();
    for (const recipe of lastRecipes) {
      for (const value of filter.values(recipe)) {
        if (value && value !== "Unknown") counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    const options = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const any = el("option", null, filter.any);
    any.value = "";
    filter.select.replaceChildren(any, ...options.map(([value, count]) => {
      const option = el("option", null, `${value} (${count})`);
      option.value = value;
      return option;
    }));
    // A dropdown with nothing to choose from is just noise.
    filter.select.closest(".filter").hidden = options.length === 0;
  }
  filtersBox.hidden = false;
}

// The recipes that pass every chosen filter, still in best-match order.
function filteredRecipes() {
  return lastRecipes.filter((recipe) =>
    Object.values(FILTERS).every((filter) =>
      !filter.select.value || filter.values(recipe).includes(filter.select.value)));
}

for (const filter of Object.values(FILTERS)) {
  filter.select.addEventListener("change", () => {
    shownCount = PAGE_SIZE;
    renderResults();
  });
}

clearButton.addEventListener("click", () => {
  Object.values(FILTERS).forEach((filter) => (filter.select.value = ""));
  shownCount = PAGE_SIZE;
  renderResults();
});

moreButton.addEventListener("click", () => {
  shownCount += PAGE_SIZE;
  renderResults();
});

/* ---------- Drawing the recipes ---------- */

function renderResults() {
  const matching = filteredRecipes();
  const shown = matching.slice(0, shownCount);
  results.replaceChildren(...shown.map((recipe, index) => buildRecipe(recipe, index + 1)));

  if (!lastRecipes.length) return;
  const anyFilter = Object.values(FILTERS).some((filter) => filter.select.value);
  clearButton.hidden = !anyFilter;
  filterCount.textContent = matching.length
    ? `Showing ${shown.length} of ${matching.length}`
    : "No dishes match these filters";
  moreButton.hidden = shown.length >= matching.length;
}

// Words that turn an ingredient into a different product:
// "chicken stock" is not your chicken, "garlic powder" is not your garlic.
const PRODUCT_WORDS = /\b(stock|broth|sauce|oil|powder|paste|juice|cube|cubes|granules|extract|vinegar)$/;

// Find which of your ingredients (if any) a recipe ingredient is.
function yourItemFor(ingredientName) {
  const lower = ingredientName.toLowerCase();
  return items.find((item) => {
    const word = item.name.replace(/s$/, "");
    if (!lower.includes(word)) return false;
    return !PRODUCT_WORDS.test(lower) || PRODUCT_WORDS.test(item.name);
  });
}

// Each recipe is laid out like a page in a cookbook:
// a big photo on one side, the recipe on the other.
function buildRecipe({ meal, ingredients, tags: recipeTags, matchedItems }, rank) {
  const page = el("li", "recipe");

  const figure = el("figure", "recipe-photo");
  const image = el("img");
  image.src = meal.strMealThumb; // the full-size dish photo
  image.alt = meal.strMeal;
  image.loading = "lazy";
  figure.append(image, el("span", "recipe-rank", `No. ${rank}`));

  const text = el("div", "recipe-text");
  text.append(el("h2", "recipe-title", meal.strMeal));

  const tags = el("ul", "tags");
  for (const tag of [meal.strArea, meal.strCategory, ...recipeTags]) {
    if (tag && tag !== "Unknown") tags.append(el("li", null, tag));
  }
  text.append(tags);

  const leftOver = items.length - matchedItems.length;
  text.append(el("p", "recipe-uses",
    `Uses your ${sentenceList(matchedItems)}` +
    (leftOver ? `. ${leftOver} of your ingredients aren't in this one.` : `, everything you listed.`)));

  // Ingredient list in your measurement system, with what you have marked.
  text.append(el("h3", "recipe-subhead", "Ingredients"));
  const list = el("ul", "ingredients");
  for (const { name, measure } of ingredients) {
    const yours = yourItemFor(name);
    const row = el("li", yours ? "have" : null);

    const icon = el("img", "ingredient-icon");
    icon.src = MealDB.ingredientImage(name);
    icon.alt = "";
    icon.loading = "lazy";
    icon.addEventListener("error", () => (icon.style.visibility = "hidden"));

    const label = el("span", "ingredient-name", name);
    const amount = el("span", "ingredient-measure", Units.convertMeasure(measure, system));
    row.append(icon, label, amount);

    // If you gave an amount, say whether it's enough.
    if (yours && yours.amount != null) {
      const verdict = Units.compare(yours, measure, system);
      const note = verdict === "enough"
        ? `You have ${amountText(yours)}, that's enough`
        : verdict
          ? `You have ${amountText(yours)}, ${verdict}`
          : `You have ${amountText(yours)}`;
      row.append(el("span", "ingredient-note" + (verdict && verdict !== "enough" ? " short" : ""), note));
    }
    list.append(row);
  }
  text.append(list);

  // The method, folded away until you want it.
  const method = el("details", "method");
  method.append(el("summary", null, "Read the method"));
  const steps = (meal.strInstructions || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const step of steps) method.append(el("p", null, step));

  const links = el("p", "links");
  if (meal.strSource) links.append(makeLink(meal.strSource, "Original recipe"));
  if (meal.strYoutube) links.append(makeLink(meal.strYoutube, "Watch the video"));
  if (links.childElementCount) method.append(links);
  text.append(method);

  page.append(figure, text);
  return page;
}

function makeLink(href, text) {
  const link = el("a", null, text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}

/* ---------- Rotating photo background ---------- */

function startBackdrop() {
  const holder = document.getElementById("backdrop");
  const slides = [];
  let current = -1;

  function show(index) {
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    current = index;
  }

  // Load each photo first; only photos that actually load join the rotation.
  BACKDROPS.forEach((url) => {
    const probe = new Image();
    probe.onload = () => {
      const slide = el("div", "slide");
      slide.style.backgroundImage = `url("${url}")`;
      holder.append(slide);
      slides.push(slide);
      if (current === -1) show(0);
    };
    probe.src = url;
  });

  // Switch photo every 7 seconds (less often if you've asked your
  // computer for reduced motion).
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setInterval(() => {
    if (slides.length > 1) show((current + 1) % slides.length);
  }, reduced ? 20000 : 7000);
}

/* ---------- Start ---------- */

setSystem(system);
startBackdrop();
