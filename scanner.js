import { config } from "./config.js";

const BLOCKED_HANDLES = [
  "red-line-club-exclusive-2025-hot-wheels-super-treasure-hunt-set-jcp51"
];

function isHotWheels(product) {
  const title = (product.title || "").toLowerCase();

  const excluded = [
    "shirt",
    "hoodie",
    "sweatshirt",
    "jacket",
    "mug",
    "poster",
    "sticker",
    "hat",
    "beanie",
    "bag"
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

let seenProducts = {};

async function scanMattel() {

  console.log("Starting scan...");

  const products = await fetchMattelProducts();

  for (const product of products) {

    if (!seenProducts[product.id]) {

      seenProducts[product.id] = true;

      console.log(
        `NEW PRODUCT: ${product.title}`
      );

      await sendDiscord({
        title: "🆕 NEW PRODUCT",
        description: product.title,
        url: product.url,
        color: 3447003
      });
    }
  }

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