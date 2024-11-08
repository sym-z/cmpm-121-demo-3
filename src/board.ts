/*
    Code in this section was inspired by Professor Smith's flyweight example.
*/
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";

export interface Cell {
  readonly i: number;
  readonly j: number;
}
export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }
  // Pulls a cell from the Map if it exists, creates it and returns it if it doesn't
  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (this.knownCells.has(key)) {
      return this.knownCells.get(key)!;
    } else {
      this.knownCells.set(key, cell);
      return cell;
    }
  }
  // Returns cell representation of a given point, getCanonicalCell prevents duplicate cells.
  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: Math.floor(point.lat / this.tileWidth),
      j: Math.floor(point.lng / this.tileWidth),
    });
  }
  // Calculates bounds of a given cell.
  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i * this.tileWidth, cell.j * this.tileWidth],
      [
        (cell.i + 1) * this.tileWidth,
        (cell.j + 1) * this.tileWidth,
      ],
    ]);
  }
  // Returns all cells surrounding a given point, using getCanonicalCell() to prevent duplicates.
  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    for (
      let i = -this.tileVisibilityRadius;
      i < this.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = -this.tileVisibilityRadius;
        j < this.tileVisibilityRadius;
        j++
      ) {
        resultCells.push(
          this.getCanonicalCell({ i: originCell.i + i, j: originCell.j + j }),
        );
      }
    }
    return resultCells;
  }
}
