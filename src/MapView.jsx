import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { zoneColors } from "./api";
export default function MapView({
  parcels,
  selected,
  onSelect,
  layer,
  overlays,
  visibleOverlays,
}) {
  const container = useRef(),
    map = useRef(),
    polygons = useRef(),
    selection = useRef(),
    extra = useRef();
  const choose = useRef(onSelect);
  choose.current = onSelect;
  useEffect(() => {
    map.current = L.map(container.current, { zoomControl: false }).setView(
      [12.973, 77.596],
      16,
    );
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.current.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    polygons.current?.remove();
    polygons.current = L.geoJSON(
      {
        type: "FeatureCollection",
        features: parcels.map((p) => ({
          type: "Feature",
          properties: p,
          geometry: p.geometry,
        })),
      },
      {
        style: (f) => ({
          color: "#fff",
          weight: 2,
          fillColor:
            layer === "Risk indicators"
              ? f.properties.disputed
                ? "#c36b59"
                : f.properties.tax_due
                  ? "#cea95c"
                  : "#6d9c85"
              : zoneColors[f.properties.zone],
          fillOpacity: 0.6,
        }),
        onEachFeature: (f, l) => {
          const text = document.createElement("span");
          text.textContent = f.properties.id + " · " + f.properties.zone;
          l.bindTooltip(text);
          l.on("click", () => choose.current(f.properties));
        },
      },
    ).addTo(map.current);
    if (parcels.length && !selected)
      map.current.fitBounds(polygons.current.getBounds(), {
        padding: [45, 45],
        maxZoom: 17,
      });
  }, [parcels, layer]);
  useEffect(() => {
    selection.current?.remove();
    if (selected && map.current) {
      selection.current = L.geoJSON(selected.geometry, {
        style: { color: "#153d2d", weight: 4, fillOpacity: 0.1 },
      }).addTo(map.current);
      map.current.flyToBounds(selection.current.getBounds(), {
        padding: [65, 65],
        maxZoom: 18,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 0.5,
      });
    }
  }, [selected?.id]);
  useEffect(() => {
    if (!map.current) return;
    extra.current?.remove();
    extra.current = L.geoJSON(
      {
        type: "FeatureCollection",
        features: overlays.filter((f) => visibleOverlays[f.properties.kind]),
      },
      {
        interactive: false,
        style: (f) =>
          f.properties.kind === "restriction"
            ? {
                color: "#a76353",
                weight: 2,
                dashArray: "7 5",
                fillColor: "#db9b7d",
                fillOpacity: 0.15,
              }
            : { color: "#5a99b5", weight: 4, dashArray: "9 5" },
      },
    ).addTo(map.current);
  }, [overlays, visibleOverlays]);
  return (
    <div
      ref={container}
      className="map-canvas"
      aria-label="Interactive synthetic land parcel map"
    />
  );
}
