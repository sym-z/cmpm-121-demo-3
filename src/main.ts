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
// Calculates the amount of coins in each Cache, using the luck() function.
const CACHE_COIN_SIZE_MULTIPLIER = 100;

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
  constructor(cell: Cell, coins: Coin[]) {
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
  // Rewrites a memento string after a transaction
  refreshMemento() {
    for (let i = 0; i < seenCaches.length; i++) {
      const currCache: Cache = JSON.parse(seenCaches[i]) as Cache;
      if (this.cell.i == currCache.cell.i && this.cell.j == currCache.cell.j) {
        seenCaches[i] = this.toMemento();
      }
    }
  }
  // Moves coins from cache to player
  withdraw(coin: Coin) {
    playerWallet.push(coin);
    this.coins.splice(this.coins.length - 1, 1);
    this.refreshMemento();
  }
  // Moves coins from player to cache
  deposit(coin: Coin) {
    this.coins.push(coin);
    playerWallet.splice(playerWallet.length - 1, 1);
    this.refreshMemento();
  }
  // Makes a coin and deposits it into a cache
  makeCoin() {
    const serialNumber: string =
      `${this.cell.i}:${this.cell.j}#${this.coins.length}`;
    const coin: Coin = {
      cell: this.cell,
      serial: serialNumber,
    };
    this.coins.push(coin);
  }
  // Refreshes the cache's tooltip to reflect its inventory after a transaction.
  refreshCacheTooltip(popupDiv: HTMLDivElement, coin: Coin) {
    popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = this.coins
      .length.toString();
    popupDiv.querySelector<HTMLSpanElement>(
      "#inventory",
    )!.innerHTML = `<h3>Cache's Current Inventory</h3>\n${
      printInventory(
        this.coins,
      )
    }`;
    statusPanel.innerHTML += `${coin.serial}`;
    inventoryPanel.innerHTML = `<h3>Player's Current Inventory</h3>\n${
      printInventory(
        playerWallet,
      )
    }`;
  }
  // Creates Cache Popups. These two functions were suggested by Brace to simplify my draw function and separate its PopUp creation code.
  private createPopupContent(): HTMLDivElement {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${this.cell.i},${this.cell.j}". It contains <span id="value">${this.coins.length}</span> coins. <span id="inventory"><h3>Cache's Current Inventory</h3>\n${
      printInventory(
        this.coins,
      )
    }</span></div>
                <button id="add">Deposit Coins</button>
                <button id="sub">Withdraw Coins</button>
                `;
    return popupDiv;
  }
  // Refreshes Cache Popups.
  private bindPopupEvents(popupDiv: HTMLDivElement) {
    // Deposit coins into the cache and remove them from the player's wallet when the add button is clicked.
    popupDiv
      .querySelector<HTMLButtonElement>("#add")!
      .addEventListener("click", () => {
        if (playerWallet.length > 0) {
          this.deposit(playerWallet[playerWallet.length - 1]);
          statusPanel.innerHTML =
            `${playerWallet.length} points currently, player deposited coin: `;
          this.refreshCacheTooltip(
            popupDiv,
            this.coins[this.coins.length - 1],
          );
          saveData();
        }
      });
    // Remove coins from the cache and add them to the player's wallet when the add button is clicked.
    popupDiv
      .querySelector<HTMLButtonElement>("#sub")!
      .addEventListener("click", () => {
        if (this.coins.length > 0) {
          this.withdraw(this.coins[this.coins.length - 1]);
          statusPanel.innerHTML =
            `${playerWallet.length} points currently, player picked up coin: `;
          this.refreshCacheTooltip(
            popupDiv,
            playerWallet[playerWallet.length - 1],
          );
        }
        saveData();
      });
  }
  // Draws a Cache to the screen
  draw() {
    // Create a border around the cache on the map.
    const rect = leaflet.rectangle(board.getCellBounds(this.cell));
    rect.addTo(map);
    // Add to list of rectangle Caches drawn to the screen.
    drawnRectangles.push(rect);
    // Each cache's popup behavior.
    rect.bindPopup(() => {
      const popupDiv = this.createPopupContent();
      this.bindPopupEvents(popupDiv);
      return popupDiv;
    });
  }
  // Create a representation of a new cache object on the map.
  spawn() {
    // Calculate the starting number of coins for each cache.
    const totalCoins = Math.floor(
      luck([this.cell.i, this.cell.j, "initialValue"].toString()) *
        CACHE_COIN_SIZE_MULTIPLIER,
    );
    // Make and deposit that many coins into the cache
    for (let i = 0; i < totalCoins; i++) {
      this.makeCoin();
    }
    this.draw();
    seenCaches.push(this.toMemento());
  }
}

// Create a board object to use to implement the Flyweight pattern
const board: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

// This location will eventually be updated based on the user's real location, for now the player will always start at the Oakes Classroom
let playerCoordLocation = OAKES_CLASSROOM;
// Create a cell representation of the player's location
let playerCellLocation: Cell = board.getCellForPoint(playerCoordLocation);
// Add a marker to represent the player, keep track of their location and what coins are in their wallet.
let playerMarker = leaflet.marker(playerCoordLocation);
playerMarker.bindTooltip(
  `You are currently located at: ${playerCellLocation.i}, ${playerCellLocation.j}`,
);
playerMarker.addTo(map);
let playerWallet: Coin[] = [];

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
let seenCaches: string[] = [];
// Redraws all caches to the screen
// Got a bit of help from Brace on some syntax for how I declared currCache so I implemented Flyweight effectively still.
function refreshCacheLocations() {
  clearRectangles();
  const nearbyCells = board.getCellsNearPoint(playerCoordLocation);
  for (const cell of nearbyCells) {
    let duplicateFound = false;
    // If the cell is lucky enough, spawn a cache.
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      const currCache: Cache = new Cache(cell, []);
      for (const cacheMemento of seenCaches) {
        currCache.fromMemento(cacheMemento);
        // Cache has been seen before
        if (currCache.cell.i == cell.i && currCache.cell.j == cell.j) {
          duplicateFound = true;
          currCache.draw();
          break;
        }
      }
      // No memento was found for this cache, create a new one.
      if (!duplicateFound) {
        const newCache = new Cache(cell, []);
        newCache.spawn();
      }
    }
  }
}
// Attach a polyline to follow the player's movements.
const playerTraceLine: leaflet.polyline = leaflet
  .polyline([], { color: "red" })
  .addTo(map);
// Triggers when a player changes cell.
const playerMoved = new Event("player-moved");
document.addEventListener("player-moved", () => {
  refreshPlayerLocation();
  refreshCacheLocations();
  playerTraceLine.addLatLng(
    new leaflet.latLng(playerCoordLocation.lat, playerCoordLocation.lng),
  );
  saveData();
});

// Prints the current state of a coin array, could be the players wallet or a cache, in a scroll box.
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
  printInventory(
    playerWallet,
  )
}`;

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

let watchID: number | null = null;
// Help from Brace on syntax.
function trackLocation() {
  if ("geolocation" in navigator) {
    watchID = navigator.geolocation.watchPosition(
      (position) => {
        playerCoordLocation.lat = position.coords.latitude;
        playerCoordLocation.lng = position.coords.longitude;
        document.dispatchEvent(playerMoved);
      },
      (error) => console.error("Error watching position: ", error),
      { enableHighAccuracy: false },
    );
  } else {
    console.error("Geolocation unavailable in this browser.");
  }
}
function stopTracking() {
  if (watchID !== null) {
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
  }
}
const sensorButton = document.getElementById("sensor")!;
sensorButton.addEventListener("click", () => {
  if (watchID == null) {
    // Erase the player's movement history by clearing all points in the polyline except for their current location.
    playerTraceLine.setLatLngs([]);
    trackLocation();
    sensorButton.classList.add("active");
  } else {
    stopTracking();
    sensorButton.classList.remove("active");
  }
});
// Move all coins to their original caches and empty the player's wallet.
function resetCoins() {
  // Erase all mementos
  seenCaches.splice(0, seenCaches.length);
  // Clear player's inventory
  playerWallet.splice(0, playerWallet.length);
  // Update player wallet text
  statusPanel.innerHTML = "No points yet...";
  inventoryPanel.innerHTML = `<h3>Player's Current Inventory</h3>\n${
    printInventory(
      playerWallet,
    )
  }`;
}
const resetButton = document.getElementById("reset")!;
resetButton.addEventListener("click", () => {
  // Reset state of all coins
  resetCoins();
  // Refresh all nearby caches
  refreshCacheLocations();
  // Erase the player's movement history by clearing all points in the polyline except for their current location.
  playerTraceLine.setLatLngs([{
    lat: playerCoordLocation.lat,
    lng: playerCoordLocation.lng,
  }]);
  // Save the state of the game after the reset button is pressed.
  saveData();
});

// Help from Brace on syntax.
function saveData() {
  // Current location
  localStorage.setItem(
    "playerCoordLocation",
    JSON.stringify(playerCoordLocation),
  );
  // Polyline
  localStorage.setItem(
    "playerTraceLine",
    JSON.stringify(playerTraceLine.getLatLngs()),
  );
  // Wallet
  localStorage.setItem("playerWallet", JSON.stringify(playerWallet));
  // Seen Caches (Mementos)
  localStorage.setItem("seenCaches", JSON.stringify(seenCaches));
  // Status Panel string
  localStorage.setItem("status", JSON.stringify(statusPanel.innerHTML));
}

function loadData() {
  if (localStorage.getItem("playerCoordLocation")) {
    playerCoordLocation = JSON.parse(
      localStorage.getItem("playerCoordLocation")!,
    ) as leaflet.latLng;
    refreshPlayerLocation();
  }
  if (localStorage.getItem("playerTraceLine")) {
    playerTraceLine.setLatLngs(
      JSON.parse(localStorage.getItem("playerTraceLine")!) as leaflet.latLng[],
    );
  } else {
    // Start with a fresh traceline at the player's location.
    document.dispatchEvent(playerMoved);
  }
  if (localStorage.getItem("playerWallet")) {
    playerWallet = JSON.parse(localStorage.getItem("playerWallet")!) as Coin[];
    inventoryPanel.innerHTML = `<h3>Player's Current Inventory</h3>\n${
      printInventory(
        playerWallet,
      )
    }`;
  }
  if (localStorage.getItem("seenCaches")) {
    seenCaches = JSON.parse(localStorage.getItem("seenCaches")!) as string[];
    refreshCacheLocations();
  }
  if (localStorage.getItem("status")) {
    statusPanel.innerHTML = JSON.parse(
      localStorage.getItem("status")!,
    ) as string;
  }
}

loadData();
