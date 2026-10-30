/*
 * backdrops.js — the photos that fade in and out behind the top of the page.
 *
 * These are free photos hosted by Unsplash. To use your own, either paste
 * another Unsplash link here, or put an image in an "images" folder and
 * write e.g. "images/spices.jpg". Photos that fail to load are skipped.
 *
 * The "?w=2000&q=80&auto=format&fit=crop" part asks Unsplash's image server
 * for a 2000px wide, compressed version, so the page loads quickly.
 */

const BACKDROPS = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836", // plated dish, dark table
  "https://images.unsplash.com/photo-1596040033229-a9821ebd058d", // spices
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe", // colourful salad
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352", // vegetables from above
  "https://images.unsplash.com/photo-1466637574441-749b8f19452f", // fresh produce in a kitchen
  "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a", // bowl of soup
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd", // greens bowl
].map((url) => url.startsWith("http") ? url + "?w=2000&q=80&auto=format&fit=crop" : url);
