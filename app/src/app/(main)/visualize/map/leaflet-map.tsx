"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Marker {
  lat: number;
  lng: number;
  type: "origin" | "archive";
  manuscript: {
    id: string;
    title: string;
    language: string;
    originLocation: string | null;
    archiveLocation: string | null;
    dateStart: number | null;
    dateEnd: number | null;
  };
}

interface LeafletMapProps {
  markers: Marker[];
  onSelect: (ms: Marker["manuscript"]) => void;
}

const COLORS = { origin: "#3b82f6", archive: "#10b981" };

function createIcon(type: "origin" | "archive"): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${COLORS[type]};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
  });
}

export default function LeafletMap({ markers, onSelect }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [30, 20],
      zoom: 3,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();

    for (const m of markers) {
      const icon = createIcon(m.type);
      const marker = L.marker([m.lat, m.lng], { icon })
        .bindTooltip(`${m.manuscript.title} (${m.type})`, { direction: "top", offset: [0, -8] });

      marker.on("click", () => onSelect(m.manuscript));
      layerRef.current.addLayer(marker);
    }

    if (markers.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  }, [markers, onSelect]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
