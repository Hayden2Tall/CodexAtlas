"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

interface MapManuscript {
  id: string;
  title: string;
  language: string;
  originLocation: string | null;
  archiveLocation: string | null;
  dateStart: number | null;
  dateEnd: number | null;
}

interface MapViewProps {
  manuscripts: MapManuscript[];
}

interface Marker {
  lat: number;
  lng: number;
  type: "origin" | "archive";
  manuscript: MapManuscript;
}

const LOCATION_COORDS: Record<string, [number, number]> = {
  egypt: [26.0, 30.0],
  "upper egypt": [25.7, 32.6],
  "lower egypt": [30.0, 31.0],
  "oxyrhynchus": [28.53, 30.66],
  "fayum": [29.31, 30.84],
  "nag hammadi": [26.05, 32.28],
  "alexandria": [31.2, 29.95],
  "cairo": [30.04, 31.24],
  "sinai": [28.55, 33.97],
  "monastery of saint catherine": [28.55, 33.97],
  "st. catherine's monastery": [28.55, 33.97],
  "qumran": [31.74, 35.46],
  "dead sea": [31.5, 35.5],
  "jerusalem": [31.77, 35.23],
  "bethlehem": [31.7, 35.2],
  "caesarea": [32.5, 34.89],
  "antioch": [36.2, 36.15],
  "constantinople": [41.01, 28.98],
  "istanbul": [41.01, 28.98],
  "rome": [41.9, 12.5],
  "vatican": [41.9, 12.45],
  "vatican library": [41.9, 12.45],
  "biblioteca apostolica vaticana": [41.9, 12.45],
  "british library": [51.53, -0.13],
  "british museum": [51.52, -0.13],
  "london": [51.51, -0.13],
  "paris": [48.86, 2.35],
  "bibliothèque nationale": [48.83, 2.38],
  "bibliothèque nationale de france": [48.83, 2.38],
  "oxford": [51.75, -1.25],
  "bodleian library": [51.75, -1.26],
  "cambridge": [52.2, 0.12],
  "chester beatty library": [53.34, -6.27],
  "dublin": [53.35, -6.26],
  "berlin": [52.52, 13.41],
  "munich": [48.14, 11.58],
  "vienna": [48.21, 16.37],
  "florence": [43.77, 11.25],
  "milan": [45.46, 9.19],
  "leiden": [52.16, 4.49],
  "geneva": [46.2, 6.14],
  "zurich": [47.38, 8.54],
  "moscow": [55.75, 37.62],
  "st. petersburg": [59.93, 30.32],
  "saint petersburg": [59.93, 30.32],
  "russian national library": [59.93, 30.33],
  "national library of russia": [59.93, 30.33],
  "ann arbor": [42.28, -83.74],
  "university of michigan": [42.28, -83.74],
  "new york": [40.71, -74.01],
  "princeton": [40.35, -74.66],
  "washington": [38.89, -77.04],
  "ethiopia": [9.0, 38.7],
  "axum": [14.12, 38.72],
  "addis ababa": [9.02, 38.75],
  "syria": [35.0, 38.0],
  "edessa": [37.15, 38.79],
  "mesopotamia": [33.3, 44.4],
  "iraq": [33.3, 44.4],
  "persia": [32.4, 53.7],
  "iran": [32.4, 53.7],
  "armenia": [40.18, 44.51],
  "georgia": [41.72, 44.79],
  "greece": [39.07, 21.82],
  "athens": [37.98, 23.73],
  "mount athos": [40.16, 24.33],
  "patmos": [37.31, 26.55],
  "turkey": [39.93, 32.86],
  "ephesus": [37.94, 27.34],
  "cappadocia": [38.65, 34.83],
  "north africa": [32.0, 10.0],
  "carthage": [36.85, 10.32],
  "tunisia": [33.89, 9.54],
  "morocco": [31.79, -7.09],
  "spain": [40.46, -3.75],
  "ireland": [53.14, -7.69],
  "germany": [51.17, 10.45],
  "france": [46.6, 1.89],
  "italy": [41.87, 12.57],
  "palestine": [31.95, 35.2],
  "israel": [31.05, 34.85],
  "lebanon": [33.89, 35.5],
  "tyre": [33.27, 35.2],
  "india": [20.59, 78.96],
  "chester beatty": [53.34, -6.27],
};

function geocode(location: string): [number, number] | null {
  const normalized = location.toLowerCase().trim();
  if (LOCATION_COORDS[normalized]) return LOCATION_COORDS[normalized];
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }
  return null;
}

const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false });

export function MapView({ manuscripts }: MapViewProps) {
  const [layers, setLayers] = useState({ origin: true, archive: true });
  const [selectedMs, setSelectedMs] = useState<MapManuscript | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const markers = useMemo(() => {
    const result: Marker[] = [];
    for (const m of manuscripts) {
      if (m.originLocation) {
        const coords = geocode(m.originLocation);
        if (coords) result.push({ lat: coords[0], lng: coords[1], type: "origin", manuscript: m });
      }
      if (m.archiveLocation) {
        const coords = geocode(m.archiveLocation);
        if (coords) result.push({ lat: coords[0], lng: coords[1], type: "archive", manuscript: m });
      }
    }
    return result;
  }, [manuscripts]);

  const filtered = markers.filter((m) => layers[m.type]);
  const unmapped = manuscripts.filter((m) => {
    const hasOrigin = m.originLocation && geocode(m.originLocation);
    const hasArchive = m.archiveLocation && geocode(m.archiveLocation);
    return !hasOrigin && !hasArchive;
  });

  return (
    <div>
      {/* Layer toggles */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={layers.origin}
            onChange={(e) => setLayers((l) => ({ ...l, origin: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Origin
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={layers.archive}
            onChange={(e) => setLayers((l) => ({ ...l, archive: e.target.checked }))}
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Current Archive
          </span>
        </label>
        <span className="text-xs text-gray-400">
          {filtered.length} marker{filtered.length !== 1 ? "s" : ""} on map
        </span>
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-lg border border-gray-200" style={{ height: 500 }}>
        {mounted ? (
          <LeafletMap markers={filtered} onSelect={setSelectedMs} />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-400">
            Loading map…
          </div>
        )}
      </div>

      {/* Selected manuscript card */}
      {selectedMs && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-gray-900">{selectedMs.title}</h3>
              <p className="mt-0.5 text-sm text-gray-600">
                {selectedMs.language.toUpperCase()}
                {selectedMs.dateStart && ` · ${selectedMs.dateStart < 0 ? `${Math.abs(selectedMs.dateStart)} BCE` : `${selectedMs.dateStart} CE`}`}
                {selectedMs.dateEnd && `–${selectedMs.dateEnd < 0 ? `${Math.abs(selectedMs.dateEnd)} BCE` : `${selectedMs.dateEnd} CE`}`}
              </p>
              {selectedMs.originLocation && (
                <p className="text-xs text-gray-500">Origin: {selectedMs.originLocation}</p>
              )}
              {selectedMs.archiveLocation && (
                <p className="text-xs text-gray-500">Archive: {selectedMs.archiveLocation}</p>
              )}
            </div>
            <Link
              href={`/manuscripts/${selectedMs.id}`}
              className="shrink-0 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              View manuscript
            </Link>
          </div>
        </div>
      )}

      {/* Unmapped manuscripts */}
      {unmapped.length > 0 && (
        <p className="mt-4 text-xs text-gray-400">
          {unmapped.length} manuscript{unmapped.length !== 1 ? "s" : ""} could not be mapped (unrecognized location text).
        </p>
      )}
    </div>
  );
}
