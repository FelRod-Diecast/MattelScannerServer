import "dotenv/config";
import fs from "fs";
import { config } from "./config.js";

const BLOCKED_HANDLES = [
  "red-line-club-exclusive-2025-hot-wheels-super-treasure-hunt-set-jcp51"
];
function loadProducts() {
  try {
    return JSON.parse(
      fs.readFileSync(
        "./products.json",
        "utf8"
      )
    );
  } catch {
    return {};
  }
}

function saveProducts(data) {
  fs.writeFileSync(
    "./products.json",
    JSON.stringify(data, null, 2)
  );
}

function loadWatchlist() {
  try {
    return JSON.parse(
      fs.readFileSync(
        "./watchlist.json",
        "utf8"
      )
    );
  } catch {
    return [];
  }
}

function loadStats() {
  try {
    return JSON.parse(
      fs.readFileSync(
        "./stats.json",
        "utf8"
      )
    );
  } catch {
    return {
      newProductsToday: 0,
      restocksToday: 0,
      soldOutToday: 0
    };
  }
}

function saveStats(stats) {
  fs.writeFileSync(
    "./stats.json",
    JSON.stringify(stats, null, 2)
  );
}

function loadAlerts() {
  try {
    return JSON.parse(
      fs.readFileSync(
        "./alerts.json",
        "utf8"
      )
    );
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  fs.writeFileSync(
    "./alerts.json",
    JSON.stringify(alerts, null, 2)
  );
}
function isHotWheels(product) {
  const title = (product.title || "").toLowerCase();

  const excluded = [
  "shirt",
  "t-shirt",
  "hoodie",
  "sweatshirt",
  "jacket",
  "mug",
  "poster",
  "sticker",
  "hat",
  "dad hat",
  "snapback",
  "beanie",
  "bag",
  "tumbler",
  "jersey",
  "figure",
  "mechanic shirt",
  "pants"
];
  if (excluded.some(word => title.includes(word))) {
    return false;
  }

  return (
    title.includes("hot wheels") ||
    title.includes("rlc") ||
    title.includes("red line club") ||
    title.includes("elite 64")
  );
}

async function sendDiscord(embed) {
  try {
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: "Mattel Scanner",
        embeds: [embed]
      })
    });
  } catch (err) {
    console.error(err);
  }
}

async function fetchMattelProducts() {
  const products = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://creations.mattel.com/products.json?page=${page}`
    );

    if (!res.ok) break;

    const data = await res.json();

    if (!data.products?.length) break;

    for (const p of data.products) {
      if (BLOCKED_HANDLES.includes(p.handle)) continue;

      if (!isHotWheels(p)) continue;

      products.push({
        id: p.id,
        handle: p.handle,
        title: p.title,
        available: p.variants?.[0]?.available || false,
        url: `https://creations.mattel.com/products/${p.handle}`
      });
    }

    page++;
  }

  return products;
}

let seenProducts = loadProducts();

async function scanMattel() {

  console.log("Starting scan...");

 const products = await fetchMattelProducts();

const stats = loadStats();
const alerts = loadAlerts();
const watchlist = loadWatchlist();

  for (const product of products) {

    if (!seenProducts[product.id]) {

      seenProducts[product.id] = {
  title: product.title,
  handle: product.handle,
  available: product.available,
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString()
};

      console.log(
        `NEW PRODUCT: ${product.title}`
      );
stats.newProductsToday++;

alerts.unshift(
  `🆕 ${product.title}`
);

alerts.splice(10);
      await sendDiscord({
        title: "🆕 NEW PRODUCT",
        description: product.title,
        url: product.url,
        color: 3447003
      });
    }
  }

saveProducts(seenProducts);
saveStats(stats);
saveAlerts(alerts);
  console.log(
    `Scan complete. Found ${products.length} products`
  );
}

async function startScanner() {

  await scanMattel();

  setInterval(async () => {

    try {
      await scanMattel();
    } catch (err) {
      console.error(err);
    }

  }, config.scanIntervalMinutes * 60 * 1000);
}

startScanner();