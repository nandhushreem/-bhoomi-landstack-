// Workflow checks must not repeatedly fetch community basemap tiles.
export const mapFixture = {
  version: 8,
  sources: {
    roads: {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [77.57, 12.973],
            [77.62, 12.973],
          ],
        },
      },
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e7ebdf" },
    },
    {
      id: "roads",
      type: "line",
      source: "roads",
      paint: { "line-color": "#ffffff", "line-width": 12 },
    },
  ],
};
export async function fixtureMap(context) {
  await context.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({ json: mapFixture }),
  );
}
