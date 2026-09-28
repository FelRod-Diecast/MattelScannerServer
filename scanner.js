import "dotenv/config";
import fs from "fs";
import { config } from "./config.js";

import {
  Client,
  GatewayIntentBits
} from "discord.js";

const BLOCKED_HANDLES = [
  "red-line-club-exclusive-2025-hot-wheels-super-treasure-hunt-set-jcp51"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
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
  "sweater",
  "ugly sweater",
  "crewneck",
  "pullover",
  "glass",
  "mug",
  "pin",
  "poster",
  "sticker",
  "hat",
  "dad hat",
  "snapback",
  "beanie",
  "bag",
  "backpack",
  "wallet",
  "lanyard",
  "patch",
  "pin",
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
function getLaunchInfoFromHtml(html) {
  const match = html.match(
    /Launches\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:am|pm)\s*PT)/i
  );

  if (!match) {
    return {
      upcoming: false,
      launchDate: null
    };
  }

  const launchDate = new Date(match[1]);
  const now = new Date();

  return {
    upcoming: launchDate > now,
    launchDate: match[1]
  };
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

    let launchInfo = {
  upcoming: false,
  launchDate: null
};

const existing = seenProducts[p.id];

const productUrl =
  `https://creations.mattel.com/products/${p.handle}`;

let pageHtml = "";

try {
  const pageCheck = await fetch(productUrl);

  if (pageCheck.ok) {
    pageHtml = await pageCheck.text();
  }
} catch (err) {
  console.error(err);
}
if (
  !existing?.launchDate
) {
  const titleLower = p.title.toLowerCase();

  const shouldCheckLaunch =
    titleLower.includes("rlc") ||
    titleLower.includes("red line club") ||
    titleLower.includes("elite 64") ||
    titleLower.includes("transformers");

  if (shouldCheckLaunch) {
    launchInfo =
      getLaunchInfoFromHtml(pageHtml);
  }
}
const activeVariant =
  p.variants?.find(v => v.available) ||
  p.variants?.[0] ||
  null;

products.push({
  id: p.id,
  handle: p.handle,
  title: p.title,
  available: p.variants?.some(v => v.available) || false,
  url: productUrl,
  variantId: activeVariant?.id || null,
  price: activeVariant?.price || null,
  image: p.images?.[0]?.src || null,
  upcoming: launchInfo.upcoming,
  launchDate: launchInfo.launchDate
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
const existingProduct =
  seenProducts[product.id];
    if (!seenProducts[product.id]) {

     seenProducts[product.id] = {
  title: product.title,
  handle: product.handle,

  available: product.available,

  price: product.price || null,
  previousPrice: null,

  upcoming: product.upcoming || false,
  launchDate: product.launchDate || null,

  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),

  wasHidden: product.available === false,
  hiddenAlertSent: false,

  stats: {
    restockEvents: 0,
    soldOutEvents: 0,
    restockTimestamps: []
  }
};

 const isHiddenOpportunity =
  product.available === false &&
  !product.launchDate;

const isFutureOpportunity =
  product.available === false &&
  product.launchDate;

if (isHiddenOpportunity) {
  console.log(
    `HIDDEN OPPORTUNITY: ${product.title}`
  );
} else if (isFutureOpportunity) {
  console.log(
    `FUTURE OPPORTUNITY: ${product.title}`
  );
} else {
  console.log(
    `NEW PRODUCT: ${product.title}`
  );
}

if (product.available) {

  stats.newProductsToday++;

  alerts.unshift(
    `🆕 ${product.title}`
  );

  alerts.splice(10);

  await sendDiscord({
  title: "🆕 NEW PRODUCT",
  url: product.url,
  color: 3447003,
  thumbnail: {
    url: product.image
  },
  fields: [
  {
    name: "📦 Product",
    value: product.title,
    inline: false
  },
  {
    name: "💲 Price",
    value: `$${product.price}`,
    inline: true
  },
 
   {
  name: "🛒 QTY 2",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:2)`,
  inline: true
},
{
  name: "🛒 QTY 10",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:10)`,
  inline: true
},
{
  name: "🛒 QTY 20",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:20)`,
  inline: true
},
{
  name: "🛒 QTY 50",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:50)`,
  inline: true
}

  ]
});
} else {

  if (
    !product.launchDate
  ) {
    seenProducts[product.id].wasHidden = true;

    console.log(
      `HIDDEN PRODUCT DETECTED: ${product.title}`
    );
  } else {
    console.log(
      `FUTURE RELEASE DETECTED: ${product.title}`
    );
  }

}
    const watchMatch =
  watchlist.find(keyword =>
    product.title
      .toLowerCase()
      .includes(keyword)
  );

if (watchMatch && product.available) {
  console.log(
    `WATCHLIST MATCH: ${product.title}`
  );

  await sendDiscord({
    title: "🚨 WATCHLIST MATCH",
    url: product.url,
    color: 16711680,
    thumbnail: {
      url: product.image
    },
   fields: [
  {
    name: "📦 Product",
    value: product.title,
    inline: false
  },
  {
    name: "🎯 Watchlist Keyword",
    value: watchMatch,
    inline: true
  },
  {
    name: "💲 Price",
    value: `$${product.price}`,
    inline: true
  },
      
     {
  name: "🛒 QTY 2",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:2)`,
  inline: true
},
{
  name: "🛒 QTY 10",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:10)`,
  inline: true
},
{
  name: "🛒 QTY 20",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:20)`,
  inline: true
},
{
  name: "🛒 QTY 50",
  value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:50)`,
  inline: true
}

    ]
  });
}
    }
  }
for (const product of products) {

  const previous =
    seenProducts[product.id];

 if (
  previous &&
  previous.available === false &&
  product.available === true
)
{

  const wasHiddenOpportunity =
  previous.wasHidden === true;

const watchMatch =
  watchlist.find(keyword =>
    product.title
      .toLowerCase()
      .includes(keyword)
  );

if (wasHiddenOpportunity) {
  console.log(
    `HIDDEN PRODUCT WENT LIVE: ${product.title}`
  );
} else {
  console.log(
    `PRODUCT BACK IN STOCK: ${product.title}`
  );
}

 if (watchMatch) {

  if (product.upcoming) {

    console.log(
      `WATCHLIST UPCOMING: ${product.title}`
    );

    await sendDiscord({
      title: "🚀 WATCHLIST UPCOMING",
      url: product.url,
      color: 16753920,
      thumbnail: {
        url: product.image
      },
      fields: [
       {
  name: "📦 Product",
  value: product.title,
  inline: false
},
        {
          name: "Watchlist Keyword",
          value: watchMatch,
          inline: true
        },
        {
          name: "Launch Date",
          value: product.launchDate || "Mattel Launch Scheduled"
        },
        {
          name: "Price",
          value: `$${product.price}`,
          inline: true
        },
        
      ]
    });

  } else {

    console.log(
      `WATCHLIST RESTOCK: ${product.title}`
    );

    await sendDiscord({
      title: "🚨 WATCHLIST RESTOCK",
      url: product.url,
      color: 16711680,
      thumbnail: {
        url: product.image
      },
      fields: [
      {
  name: "📦 Product",
  value: product.title,
  inline: false
},
        {
          name: "Watchlist Keyword",
          value: watchMatch,
          inline: true
        },
        {
          name: "Price",
          value: `$${product.price}`,
          inline: true
        },
     
        {
          name: "🛒 QTY 2",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:2)`,
          inline: true
        },
        {
          name: "🛒 QTY 10",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:10)`,
          inline: true
        },
        {
          name: "🛒 QTY 20",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:20)`,
          inline: true
        },
        {
          name: "🛒 QTY 50",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:50)`,
          inline: true
        }
      ]
    });

  }

  } else {

  if (product.upcoming) {

    console.log(
      `UPCOMING LAUNCH: ${product.title}`
    );

    await sendDiscord({
      title: "🚀 UPCOMING LAUNCH",
      url: product.url,
      color: 16753920,
      thumbnail: {
        url: product.image
      },
      fields: [
       {
  name: "📦 Product",
  value: product.title,
  inline: false
},
        {
          name: "Launch Date",
          value: product.launchDate || "Mattel Launch Scheduled"
        },
        {
          name: "Price",
          value: `$${product.price}`,
          inline: true
        },
     
      ]
    });

  } else {

    console.log(
      `RESTOCK: ${product.title}`
    );

    await sendDiscord({
      title: "🔥 RESTOCK",
      url: product.url,
      color: 65280,
      thumbnail: {
        url: product.image
      },
      fields: [
       {
  name: "📦 Product",
  value: product.title,
  inline: false
},
        {
          name: "Price",
          value: `$${product.price}`,
          inline: true
        },
        
        {
          name: "🛒 QTY 2",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:2)`,
          inline: true
        },
        {
          name: "🛒 QTY 10",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:10)`,
          inline: true
        },
        {
          name: "🛒 QTY 20",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:20)`,
          inline: true
        },
        {
          name: "🛒 QTY 50",
          value: `[OPEN CART](https://creations.mattel.com/cart/${product.variantId}:50)`,
          inline: true
        }
      ]
    });

  }
}

  stats.restocksToday++;

}

}
for (const product of products) {
if (seenProducts[product.id]) {

  if (
    seenProducts[product.id].price === undefined
  ) {
    seenProducts[product.id].price =
      product.price || null;
  }

  if (
    seenProducts[product.id].previousPrice === undefined
  ) {
    seenProducts[product.id].previousPrice =
      null;
  }

  if (
    seenProducts[product.id].wasHidden === undefined
  ) {
    seenProducts[product.id].wasHidden =
      false;
  }

  if (
    seenProducts[product.id].hiddenAlertSent === undefined
  ) {
    seenProducts[product.id].hiddenAlertSent =
      false;
  }

  if (
    seenProducts[product.id].stats === undefined
  ) {
    seenProducts[product.id].stats = {
      restockEvents: 0,
      soldOutEvents: 0,
      restockTimestamps: []
    };
  }

  seenProducts[product.id].previousPrice =
  seenProducts[product.id].price ?? null;

seenProducts[product.id].price =
  product.price || null;

seenProducts[product.id].available =
  product.available;

seenProducts[product.id].upcoming =
  product.upcoming || false;

seenProducts[product.id].launchDate =
  product.launchDate || null;

seenProducts[product.id].lastSeen =
  new Date().toISOString();
}

}
saveProducts(seenProducts);
saveStats(stats);
saveAlerts(alerts);
  console.log(
  `Scan complete. Found ${products.length} products`
);

}
client.once("ready", () => {
  console.log(
    `✅ Logged in as ${client.user.tag}`
  );
});

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) return;

    if (message.content === "!status") {
      const products = loadProducts();

      return message.reply(
        `✅ Online\n📦 Tracking ${
          Object.keys(products).length
        } products`
      );
    }

    if (message.content === "!stats") {
      const stats = loadStats();

      return message.reply(
        "📊 Mattel Stats\n\n" +
        `🆕 New Products: ${stats.newProductsToday}\n` +
        `🔥 Restocks: ${stats.restocksToday}\n` +
        `❌ Sold Out: ${stats.soldOutToday}`
      );
    }

    if (message.content === "!alerts") {
      const alerts = loadAlerts();

      return message.reply(
        alerts.length
          ? alerts.join("\n")
          : "No alerts recorded."
      );
    }

    if (message.content === "!watchlist") {
      const watchlist = loadWatchlist();

      return message.reply(
        watchlist.length
          ? watchlist.join("\n")
          : "Watchlist empty."
      );
    }

    if (message.content === "!debug") {
      const products = loadProducts();
      const stats = loadStats();

      return message.reply(
        "🛠️ Debug\n\n" +
        `📦 Products: ${Object.keys(products).length}\n` +
        `🆕 New: ${stats.newProductsToday}\n` +
        `🔥 Restocks: ${stats.restocksToday}\n` +
        `❌ Sold Out: ${stats.soldOutToday}`
      );
    }
if (message.content === "!health") {
  const products = loadProducts();
  const stats = loadStats();

  return message.reply(
    "🤖 MattelBotV3 Health\n\n" +
    "✅ Online\n" +
    `📦 Tracking: ${Object.keys(products).length}\n` +
    `🆕 New Today: ${stats.newProductsToday}\n` +
    `🔥 Restocks Today: ${stats.restocksToday}\n` +
    `❌ Sold Out Today: ${stats.soldOutToday}\n` +
    `⏰ Checked: ${new Date().toLocaleString()}`
  );
}

if (message.content === "!counts") {
  const products = Object.values(
    loadProducts()
  );

  const inStock = products.filter(
    p => p.available === true
  ).length;

  const soldOut = products.filter(
    p => p.available === false
  ).length;

  return message.reply(
    "📦 Mattel Inventory Counts\n\n" +
    `📦 Total Tracked: ${products.length}\n` +
    `✅ In Stock: ${inStock}\n` +
    `❌ Sold Out: ${soldOut}`
  );
}

if (message.content === "!latest") {
  const products =
    Object.values(loadProducts())
      .sort(
        (a, b) =>
          new Date(
            b.firstSeen || b.detectedAt
          ) -
          new Date(
            a.firstSeen || a.detectedAt
          )
      )
      .slice(0, 10);

  if (!products.length) {
    return message.reply(
      "❌ No products found."
    );
  }

  let reply =
    "📦 Latest Products\n\n";

  products.forEach(
    (product, index) => {
      reply +=
        `${index + 1}. ${product.title}\n` +
        `🔗 https://creations.mattel.com/products/${product.handle}\n\n`;
    }
  );

  return message.reply(reply);
}

if (message.content === "!hidden") {
  const hiddenProducts =
    Object.values(loadProducts())
      .filter(
        product =>
          product.available === false
      );

  if (
    hiddenProducts.length === 0
  ) {
    return message.reply(
      "✅ No hidden products tracked."
    );
  }

  let reply =
    "🚨 Hidden Products\n\n";

  hiddenProducts
    .slice(0, 25)
    .forEach(product => {
      reply +=
        `📦 ${product.title}\n`;
    });

  reply +=
    `\n📊 Total Hidden: ${hiddenProducts.length}`;

  return message.reply(reply);
}

if (message.content === "!help") {
  return message.reply(
    "🤖 MattelBotV3 Commands\n\n" +

    "📦 Core\n" +
    "!status\n" +
    "!health\n" +
    "!stats\n" +
    "!counts\n" +
    "!debug\n\n" +

    "🔍 Products\n" +
    "!latest\n" +
    "!hidden\n\n" +

    "📢 Alerts\n" +
    "!alerts\n\n" +

    "⭐ Watchlist\n" +
    "!watchlist"
  );
}
  }
  
);

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

client.login(process.env.DISCORD_TOKEN);

client.once("ready", async () => {
  await startScanner();
});