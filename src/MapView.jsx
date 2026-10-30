import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { zoneColors } from "./api";
setWorkerUrl(workerUrl);
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
  const [basemapStatus, setBasemapStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  choose.current = onSelect;
  useEffect(() => {
    map.current = L.map(container.current, {
      zoomControl: false,
      minZoom: 2,
      maxZoom: 19,
      maxBounds: [
        [-85, -Infinity],
        [85, Infinity],
      ],
      maxBoundsViscosity: 1,
    }).setView([12.973, 77.596], 16);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.current.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const leaflet = map.current;
    let basemap,
      gl,
      disposed = false,
      failed = false;
    setBasemapStatus("loading");
    const unavailable = () => {
      if (disposed || failed) return;
      failed = true;
      clearTimeout(timeout);
      setBasemapStatus("unavailable");
      // Defer removal until the renderer has finished dispatching its event.
      queueMicrotask(() => {
        if (!disposed) basemap?.remove();
      });
    };
    const ready = () => {
      if (disposed || failed) return;
      clearTimeout(timeout);
      setBasemapStatus("ready");
    };
    const timeout = setTimeout(unavailable, 20000);
    try {
      // Detect unsupported browsers before the Leaflet adapter adds a layer.
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe) throw new Error("WebGL unavailable");
      probe.getExtension("WEBGL_lose_context")?.loseContext();
      basemap = maplibreGL({
        style: "https://tiles.openfreemap.org/styles/positron",
        attributionControl: {
          customAttribution:
            '<a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      });
      basemap.addTo(leaflet);
      gl = basemap.getMaplibreMap();
      gl.once("idle", ready);
      gl.on("error", unavailable);
      gl.getCanvas().addEventListener("webglcontextlost", unavailable);
    } catch {
      unavailable();
    }
    return () => {
      disposed = true;
      clearTimeout(timeout);
      gl?.off("idle", ready);
      gl?.off("error", unavailable);
      gl?.getCanvas().removeEventListener("webglcontextlost", unavailable);
      basemap?.remove();
    };
  }, [attempt]);
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
    <>
      <div
        ref={container}
        className="map-canvas"
        data-basemap-status={basemapStatus}
        aria-label="Interactive synthetic land parcel map"
      />
      {basemapStatus !== "ready" && (
        <div className="map-service-status" role="status">
          <span>
            {basemapStatus === "loading"
              ? "Loading background map…"
              : "Background map unavailable. Parcel records and boundaries are still available."}
          </span>
          {basemapStatus === "unavailable" && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Retry map
            </button>
          )}
        </div>
      )}
    </>
  );
}
