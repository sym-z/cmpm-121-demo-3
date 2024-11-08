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
interface Cache {
  cell: Cell;
  coins: Coin[];
}

// Create a board object to use to implement the Flyweight pattern
const board: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

// This location will eventually be updated based on the user's real location, for now the player will always start at the Oakes Classroom
const playerCoordLocation = OAKES_CLASSROOM;
// Create a cell representation of the player's location
const playerCellLocation: Cell = board.getCellForPoint(playerCoordLocation);
// Add a marker to represent the player, keep track of their location and what coins are in their wallet.
const playerMarker = leaflet.marker(playerCoordLocation);
playerMarker.bindTooltip(
  `You are currently located at: ${playerCellLocation.i}, ${playerCellLocation.j}`,
);
playerMarker.addTo(map);
const playerWallet: Coin[] = [];

// Moves coins from cache to player
function collect(coin: Coin, cache: Cache) {
  playerWallet.push(coin);
  cache.coins.splice(cache.coins.length - 1, 1);
}
// Moves coins from player to cache
function deposit(coin: Coin, cache: Cache) {
  cache.coins.push(coin);
  playerWallet.splice(playerWallet.length - 1, 1);
}
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
}

// Create initial caches that surround the player.
const nearbyCells = board.getCellsNearPoint(playerCoordLocation);
for (const cell of nearbyCells) {
  // If the cell is lucky enough, spawn a cache.
  if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    spawnCache({ cell: cell, coins: [] });
  }
}
