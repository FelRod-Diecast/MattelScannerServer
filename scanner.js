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

let pageValid = true;
let pageHtml = "";

try {
  const pageCheck = await fetch(productUrl);

if (!pageCheck.ok) {
  pageValid = false;
} else {
  pageHtml = await pageCheck.text();

  if (
    pageHtml.includes("Page not found") ||
    pageHtml.includes("404") ||
    pageHtml.includes("Not Found")
  ) {
    pageValid = false;
  }
}
} catch {
  pageValid = false;
}

if (!pageValid) {
  console.log(
    `SKIPPING DEAD PAGE: ${p.title}`
  );
  continue;
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
  upcoming: product.upcoming || false,
  launchDate: product.launchDate || null,
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString()
};

      console.log(
  `NEW PRODUCT: ${product.title}`
);

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

} else {

  console.log(
    `NEW PRODUCT SOLD OUT: ${product.title}`
  );

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

  const watchMatch =
    watchlist.find(keyword =>
      product.title
        .toLowerCase()
        .includes(keyword)
    );

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
          name: "Product",
          value: product.title
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
          name: "Product",
          value: product.title
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
          name: "Product",
          value: product.title
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
          name: "Product",
          value: product.title
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