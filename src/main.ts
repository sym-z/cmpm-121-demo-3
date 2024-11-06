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

// Add a marker to represent the player, keep track of their location and what coins are in their wallet.
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
const playerLocation: Cell = { i: 0, j: 0 };
playerMarker.bindTooltip(
  `You are currently located at: ${
    OAKES_CLASSROOM.lat + playerLocation.i * TILE_DEGREES
  }, ${OAKES_CLASSROOM.lng + playerLocation.j * TILE_DEGREES}`,
);
playerMarker.addTo(map);
const playerWallet: Coin[] = [];

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

interface Cell {
  i: number;
  j: number;
}
interface Coin {
  cell: Cell;
  serial: string;
}
interface Cache extends Cell {
  coins: Coin[];
}

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
  const serialNumber: string = `${cache.i}:${cache.j}#${cache.coins.length}`;
  const coin: Coin = { cell: { i: cache.i, j: cache.j }, serial: serialNumber };
  cache.coins.push(coin);
}

// Create a representation of a new cache object on the map.
function spawnCache(cache: Cache) {
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + cache.i * TILE_DEGREES, origin.lng + cache.j * TILE_DEGREES],
    [
      origin.lat + (cache.i + 1) * TILE_DEGREES,
      origin.lng + (cache.j + 1) * TILE_DEGREES,
    ],
  ]);
  // Calculate the starting number of coins for each cache.
  const totalCoins = Math.floor(
    luck([cache.i, cache.j, "initialValue"].toString()) * 100,
  );
  // Make and deposit that many coins into the cache
  for (let i = 0; i < totalCoins; i++) {
    makeCoin(cache);
  }
  // Create a border around the cache on the map.
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Each cache's popup behavior.
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${
      origin.lat + cache.i * TILE_DEGREES
    },${
      origin.lng + cache.j * TILE_DEGREES
    }". It contains <span id="value">${cache.coins.length}</span> coins.</div>
                <button id="add">Add Coins</button>
                <button id="sub">Take Coins</button>`;
    // Deposit coins into the cache and remove them from the player's wallet when the add button is clicked.
    popupDiv
      .querySelector<HTMLButtonElement>("#add")!
      .addEventListener("click", () => {
        if (playerWallet.length > 0) {
          deposit(playerWallet[playerWallet.length - 1], cache);
        }
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .coins.length.toString();
        statusPanel.innerHTML = `${playerWallet.length} points currently`;
      });
    // Remove coins from the cache and add them to the player's wallet when the add button is clicked.
    popupDiv
      .querySelector<HTMLButtonElement>("#sub")!
      .addEventListener("click", () => {
        if (cache.coins.length > 0) {
          collect(cache.coins[cache.coins.length - 1], cache);
        }
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .coins.length.toString();
        statusPanel.innerHTML = `${playerWallet.length} points currently`;
      });
    return popupDiv;
  });
}
// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      // Pass in parameters within a Cache object.
      spawnCache({ i: i, j: j, coins: [] });
    }
  }
}
