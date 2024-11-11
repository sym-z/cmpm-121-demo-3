// Many ideas for constants and algorithmic flow from Professor Smith's example.ts and example.html.
import { Cell } from "./board.ts";
import { Board } from "./board.ts";

import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";

import luck from "./luck.ts";

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

interface Coin {
  cell: Cell;
  serial: string;
}
class Cache {
  cell: Cell;
  coins: Coin[];
  constructor(cell: Cell = { i: 0, j: 0 }, coins: Coin[] = []) {
    this.cell = cell;
    this.coins = coins;
  }
  toMemento(): string {
    return JSON.stringify(this);
  }
  fromMemento(str: string): void {
    const newCache = JSON.parse(str) as Cache;
    this.cell = newCache.cell;
    this.coins = newCache.coins;
  }
}
// Rewrites a memento string after a transaction
function refreshMemento(cache: Cache) {
  for (let i = 0; i < seenCaches.length; i++) {
    const currCache: Cache = JSON.parse(seenCaches[i]);
    if (cache.cell.i == currCache.cell.i && cache.cell.j == currCache.cell.j) {
      seenCaches[i] = cache.toMemento();
    }
  }
}
// Moves coins from cache to player
function collect(coin: Coin, cache: Cache) {
  playerWallet.push(coin);
  cache.coins.splice(cache.coins.length - 1, 1);
  refreshMemento(cache);
}
// Moves coins from player to cache
function deposit(coin: Coin, cache: Cache) {
  cache.coins.push(coin);
  playerWallet.splice(playerWallet.length - 1, 1);
  refreshMemento(cache);
}
// Create a board object to use to implement the Flyweight pattern
const board: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

// This location will eventually be updated based on the user's real location, for now the player will always start at the Oakes Classroom
const playerCoordLocation = OAKES_CLASSROOM;
// Create a cell representation of the player's location
let playerCellLocation: Cell = board.getCellForPoint(playerCoordLocation);
// Add a marker to represent the player, keep track of their location and what coins are in their wallet.
let playerMarker = leaflet.marker(playerCoordLocation);
playerMarker.bindTooltip(
  `You are currently located at: ${playerCellLocation.i}, ${playerCellLocation.j}`,
);
playerMarker.addTo(map);
const playerWallet: Coin[] = [];

function refreshPlayerLocation() {
  playerMarker.remove();
  playerMarker = leaflet.marker(playerCoordLocation);
  playerMarker.bindTooltip(
    `You are currently located at: ${playerCellLocation.i}, ${playerCellLocation.j}`,
  );
  playerMarker.addTo(map);
  playerCellLocation = board.getCellForPoint(playerCoordLocation);
  map.setView(playerCoordLocation, map.getZoom());
}
// Keeps track of all shapes drawn to the screen to handle Cache refresh.
const drawnRectangles: leaflet.rect[] = [];
// Clears the screen of all Caches to draw new nearby Caches.
// Help from Brace on finding the removeLayer function.
function clearRectangles() {
  for (const rect of drawnRectangles) {
    map.removeLayer(rect);
  }
}
// The memento strings of all seen Caches.
const seenCaches: string[] = [];
// Redraws all caches to the screen
function refreshCacheLocations() {
  clearRectangles();
  const nearbyCells = board.getCellsNearPoint(playerCoordLocation);
  for (const cell of nearbyCells) {
    // If the cell is lucky enough, spawn a cache.
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      //TODO: Check to see if cache has already existed
      let duplicateFound = false;
      for (const cache of seenCaches) {
        const currCache: Cache = JSON.parse(cache) as Cache;
        // Cache has been seen before
        if (currCache.cell.i == cell.i && currCache.cell.j == cell.j) {
          const newCache = new Cache();
          newCache.fromMemento(cache);
          duplicateFound = true;
          drawCache(newCache);
          break;
        }
      }
      if (!duplicateFound) {
        const newCache = new Cache(cell, []);
        spawnCache(newCache);
      }
    }
  }
}
// Triggers when a player changes cell.
const playerMoved = new Event("player-moved");
document.addEventListener("player-moved", () => {
  refreshPlayerLocation();
  refreshCacheLocations();
});

// Movement Button Behavior
const northButton = document.getElementById("north")!;
const southButton = document.getElementById("south")!;
const westButton = document.getElementById("west")!;
const eastButton = document.getElementById("east")!;

northButton.addEventListener("click", () => {
  playerCoordLocation.lat += TILE_DEGREES;
  document.dispatchEvent(playerMoved);
});
southButton.addEventListener("click", () => {
  playerCoordLocation.lat -= TILE_DEGREES;
  document.dispatchEvent(playerMoved);
});
westButton.addEventListener("click", () => {
  playerCoordLocation.lng -= TILE_DEGREES;
  document.dispatchEvent(playerMoved);
});
eastButton.addEventListener("click", () => {
  playerCoordLocation.lng += TILE_DEGREES;
  document.dispatchEvent(playerMoved);
});

// Makes a coin and deposits it into a cache
function makeCoin(cache: Cache) {
  const serialNumber: string =
    `${cache.cell.i}:${cache.cell.j}#${cache.coins.length}`;
  const coin: Coin = {
    cell: { i: cache.cell.i, j: cache.cell.j },
    serial: serialNumber,
  };
  cache.coins.push(coin);
}
// Prints the current state of a coin array, in a scroll box.
function printInventory(coins: Coin[]) {
  let inventoryString: string =
    `<details><summary>Click to Open</summary><div class="scroll-box"><ul>`;
  for (const coin of coins) {
    inventoryString += "<li>" + coin.serial + "</li>";
  }
  inventoryString += "</ul></div></details>";
  return inventoryString;
}

// Shows recent coin deposits and pickups
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// Shows the player's coin inventory.
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;
inventoryPanel.innerHTML = `<h3>Player's Current Inventory</h3>\n${
  printInventory(playerWallet)
}`;

// Draws a Cache to the screen
function drawCache(cache: Cache) {
  // Create a border around the cache on the map.
  const rect = leaflet.rectangle(board.getCellBounds(cache.cell));
  rect.addTo(map);
  // Add to list of rectangle Caches drawn to the screen.
  drawnRectangles.push(rect);
  // Each cache's popup behavior.
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${cache.cell.i},${cache.cell.j}". It contains <span id="value">${cache.coins.length}</span> coins. <span id="inventory"><h3>Cache's Current Inventory</h3>\n${
      printInventory(cache.coins)
    }</span></div>
                <button id="add">Deposit Coins</button>
                <button id="sub">Withdraw Coins</button>
                `;
    // Deposit coins into the cache and remove them from the player's wallet when the add button is clicked.
    popupDiv
      .querySelector<HTMLButtonElement>("#add")!
      .addEventListener("click", () => {
        if (playerWallet.length > 0) {
          deposit(playerWallet[playerWallet.length - 1], cache);
          statusPanel.innerHTML =
            `${playerWallet.length} points currently, player deposited coin: `;
          refreshCacheTooltip(
            cache,
            popupDiv,
            cache.coins[cache.coins.length - 1],
          );
        }
      });
    // Remove coins from the cache and add them to the player's wallet when the add button is clicked.
    popupDiv
      .querySelector<HTMLButtonElement>("#sub")!
      .addEventListener("click", () => {
        if (cache.coins.length > 0) {
          collect(cache.coins[cache.coins.length - 1], cache);
          statusPanel.innerHTML =
            `${playerWallet.length} points currently, player picked up coin: `;
          refreshCacheTooltip(
            cache,
            popupDiv,
            playerWallet[playerWallet.length - 1],
          );
        }
      });
    return popupDiv;
  });
}
// Refreshes the cache's tooltip to reflect its inventory after a transaction.
function refreshCacheTooltip(
  cache: Cache,
  popupDiv: HTMLDivElement,
  coin: Coin,
) {
  popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
    .coins.length.toString();
  popupDiv.querySelector<HTMLSpanElement>("#inventory")!.innerHTML =
    `<h3>Cache's Current Inventory</h3>\n${printInventory(cache.coins)}`;
  statusPanel.innerHTML += `${coin.serial}`;
  inventoryPanel.innerHTML = `<h3>Player's Current Inventory</h3>\n${
    printInventory(playerWallet)
  }`;
}
// Create a representation of a new cache object on the map.
function spawnCache(cache: Cache) {
  // Calculate the starting number of coins for each cache.
  const totalCoins = Math.floor(
    luck([cache.cell.i, cache.cell.j, "initialValue"].toString()) * 100,
  );
  // Make and deposit that many coins into the cache
  for (let i = 0; i < totalCoins; i++) {
    makeCoin(cache);
  }
  drawCache(cache);
  seenCaches.push(cache.toMemento());
}
// Generate initial caches.
document.dispatchEvent(playerMoved);
