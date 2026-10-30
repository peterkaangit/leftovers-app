/*
 * app.js — the page logic: reading your ingredients and amounts, the photo
 * background, drawing the results, the menu and the grocery list.
 * It never talks to the API directly; it asks MealDB.findRecipes() (in
 * mealdb.js) and draws whatever comes back. The menu maths is in kitchen.js.
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
const peopleCount = document.getElementById("people-count");
const peopleButtons = document.querySelectorAll(".people-stepper button");
const menuPanel = document.getElementById("menu-panel");
const menuList = document.getElementById("menu-list");
const menuPeople = document.getElementById("menu-people");
const stockList = document.getElementById("stock-list");
const groceryList = document.getElementById("grocery-list");
const copyButton = document.getElementById("copy-grocery");
const menuToggle = document.getElementById("menu-toggle");
const menuClose = document.getElementById("menu-close");

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

// How many people are eating. Recipe amounts are scaled to this.
let people = 2;

// TheMealDB doesn't say how many a recipe serves. We assume
// Kitchen.DEFAULT_SERVES, and you can change it per recipe: idMeal -> number.
const serves = new Map();

// The dishes you picked, in the order you picked them.
let menu = [];

// Grocery lines you've ticked off, by lower-case name.
const ticked = new Set();

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
  renderAll();
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
  renderAll(); // a changed amount changes what's left
}

function removeItem(name) {
  items = items.filter((item) => item.name !== name);
  renderChips();
  renderAll();
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
    menuPanel.hidden = false;
    menuToggle.hidden = false;
    buildFilters();
    shownCount = PAGE_SIZE;
    renderAll();
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

/* ---------- People and servings ---------- */

peopleButtons.forEach((button) =>
  button.addEventListener("click", () => {
    people = Math.min(20, Math.max(1, people + Number(button.dataset.step)));
    peopleCount.textContent = people;
    renderAll();
  }));

// How much to multiply a recipe's amounts by: 2 people from a recipe for 4 = 0.5.
function factorFor(recipe) {
  return people / (serves.get(recipe.meal.idMeal) || Kitchen.DEFAULT_SERVES);
}

// Run the kitchen maths for the current menu (see kitchen.js).
function currentPlan() {
  return Kitchen.plan(items, menu.map((recipe) => ({ recipe, factor: factorFor(recipe) })));
}

function onMenu(recipe) {
  return menu.some((picked) => picked.meal.idMeal === recipe.meal.idMeal);
}

/* ---------- Drawing everything ---------- */

function renderAll() {
  const plan = currentPlan();
  renderResults(plan);
  renderMenu(plan);
}

function renderResults(plan = currentPlan()) {
  if (!lastRecipes.length) return;

  // Dishes already on the menu leave the list. The rest are re-ranked by
  // how many of your ingredients they use that are still left.
  const matching = filteredRecipes()
    .filter((recipe) => !onMenu(recipe))
    .map((recipe, index) => ({
      recipe,
      index,
      available: recipe.matchedItems.filter((name) => Kitchen.isAvailable(plan.stock.get(name))),
    }))
    .sort((a, b) => b.available.length - a.available.length || a.index - b.index);

  const shown = matching.slice(0, shownCount);

  // Redrawing replaces the elements, so remember which control had focus.
  const focusedId = document.activeElement && document.activeElement.dataset.focusId;
  results.replaceChildren(...shown.map((entry, i) => buildRecipe(entry.recipe, i + 1, entry.available, plan)));
  if (focusedId) {
    const again = results.querySelector(`[data-focus-id="${focusedId}"]`);
    if (again) again.focus();
  }

  const anyFilter = Object.values(FILTERS).some((filter) => filter.select.value);
  clearButton.hidden = !anyFilter;
  filterCount.textContent = matching.length
    ? `Showing ${shown.length} of ${matching.length}`
    : menu.length ? "Every matching dish is on your menu" : "No dishes match these filters";
  moreButton.hidden = shown.length >= matching.length;
}

// Each recipe is laid out like a page in a cookbook:
// a big photo on one side, the recipe on the other.
function buildRecipe(recipe, rank, available, plan) {
  const { meal, ingredients, tags: recipeTags } = recipe;
  const factor = factorFor(recipe);
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

  text.append(el("p", "recipe-uses", available.length
    ? `Uses your ${sentenceList(available)}.`
    : menu.length
      ? "Your menu has used up the ingredients this one needs from your kitchen."
      : "Uses none of your ingredients."));

  // Servings: TheMealDB doesn't give them, so the original size is a guess you can change.
  const servings = el("p", "servings");
  const servesSelect = el("select");
  servesSelect.dataset.focusId = "serves-" + meal.idMeal;
  servesSelect.setAttribute("aria-label", "People the original recipe serves");
  for (let n = 1; n <= 12; n++) {
    const option = el("option", null, String(n));
    option.value = n;
    servesSelect.append(option);
  }
  servesSelect.value = serves.get(meal.idMeal) || Kitchen.DEFAULT_SERVES;
  servesSelect.addEventListener("change", () => {
    serves.set(meal.idMeal, Number(servesSelect.value));
    renderAll();
  });
  servings.append(
    `Amounts for ${people} ${people === 1 ? "person" : "people"}. The original recipe serves about `,
    servesSelect,
    " (TheMealDB doesn't say, so this is our guess)."
  );
  text.append(servings);

  // Ingredient list, scaled and in your measurement system, compared with
  // what's left in your kitchen after your menu.
  text.append(el("h3", "recipe-subhead", "Ingredients"));
  const list = el("ul", "ingredients");
  for (const { name, measure } of ingredients) {
    const check = Kitchen.check(name, measure, factor, items, plan.stock, system);
    const row = el("li", check ? "have" : null);

    const icon = el("img", "ingredient-icon");
    icon.src = MealDB.ingredientImage(name);
    icon.alt = "";
    icon.loading = "lazy";
    icon.addEventListener("error", () => (icon.style.visibility = "hidden"));

    const label = el("span", "ingredient-name", name);
    const amount = el("span", "ingredient-measure", Units.scaleMeasure(measure, factor, system));
    row.append(icon, label, amount);
    if (check) row.append(el("span", "ingredient-note" + (check.short ? " short" : ""), check.text));
    list.append(row);
  }
  text.append(list);

  const actions = el("div", "recipe-actions");
  const addToMenu = el("button", "add-to-menu", "Add to menu");
  addToMenu.type = "button";
  addToMenu.addEventListener("click", () => {
    menu.push(recipe);
    renderAll();
    menuPanel.classList.add("just-added");
    setTimeout(() => menuPanel.classList.remove("just-added"), 700);
  });

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

  actions.append(addToMenu);
  text.append(actions, method);

  page.append(figure, text);
  return page;
}

/* ---------- The menu sidebar ---------- */

function renderMenu(plan) {
  if (!lastRecipes.length && !menu.length) return;
  menuPeople.textContent = `For ${people} ${people === 1 ? "person" : "people"}`;
  menuToggle.textContent = menu.length ? `Your menu (${menu.length})` : "Your menu";

  // The dishes you picked.
  if (!menu.length) {
    menuList.replaceChildren(el("li", "menu-empty",
      "Add dishes to build your menu. Each one takes what it needs from your kitchen, and anything missing goes on the grocery list."));
  } else {
    menuList.replaceChildren(...menu.map((recipe) => {
      const row = el("li", "menu-dish");
      const thumb = el("img");
      thumb.src = recipe.meal.strMealThumb + "/small";
      thumb.alt = "";
      const remove = el("button", "menu-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Take ${recipe.meal.strMeal} off the menu`);
      remove.addEventListener("click", () => {
        menu = menu.filter((picked) => picked !== recipe);
        renderAll();
      });
      row.append(thumb, el("span", null, recipe.meal.strMeal), remove);
      return row;
    }));
  }

  // What's left in your kitchen.
  stockList.replaceChildren(...items.map((item) => {
    const entry = plan.stock.get(item.name);
    const usedUp = !Kitchen.isAvailable(entry);
    const row = el("li", usedUp ? "used-up" : null);
    let left;
    if (entry.value == null) left = "some";
    else if (usedUp) left = "used up";
    else if (entry.value < entry.start) {
      left = `${Units.formatBase(entry.kind, entry.value, system)} of ${Units.formatBase(entry.kind, entry.start, system)}`;
    } else left = Units.formatBase(entry.kind, entry.value, system);
    row.append(el("span", null, item.name), el("span", "stock-amount", left));
    return row;
  }));

  // The grocery list.
  const lines = plan.grocery.sort((a, b) => a.name.localeCompare(b.name));
  copyButton.hidden = lines.length === 0;
  if (!lines.length) {
    groceryList.replaceChildren(el("li", "menu-empty", menu.length
      ? "Nothing to buy. Your kitchen covers this menu."
      : "Nothing yet."));
    return;
  }
  groceryList.replaceChildren(...lines.map((line) => {
    const key = line.name.toLowerCase();
    const row = el("li", "grocery-line");
    const label = el("label");
    const box = el("input");
    box.type = "checkbox";
    box.checked = ticked.has(key);
    box.addEventListener("change", () => (box.checked ? ticked.add(key) : ticked.delete(key)));
    const words = el("span", "grocery-words");
    words.append(
      el("span", "grocery-name", line.name),
      el("span", "grocery-amount", Kitchen.describeLine(line, system)),
      el("span", "grocery-for", "For " + sentenceList([...line.dishes]))
    );
    label.append(box, words);
    row.append(label);
    return row;
  }));
}

copyButton.addEventListener("click", async () => {
  const text = currentPlan().grocery
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((line) => `- ${line.name}: ${Kitchen.describeLine(line, system) || "some"}`)
    .join("\n");
  try {
    await navigator.clipboard.writeText("Grocery list\n" + text);
    copyButton.textContent = "Copied";
  } catch (error) {
    copyButton.textContent = "Couldn't copy";
  }
  setTimeout(() => (copyButton.textContent = "Copy list"), 1800);
});

// On phones the menu is a panel that slides up from the bottom.
menuToggle.addEventListener("click", () => menuPanel.classList.add("open"));
menuClose.addEventListener("click", () => menuPanel.classList.remove("open"));

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
