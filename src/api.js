export async function api(url, options = {}) {
  const response = await fetch(url.startsWith("/ogc") ? url : "/api" + url, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.status === 429
        ? "Too many requests. Wait a minute and try again."
        : "The service returned an unexpected response. Please refresh and try again.",
    );
  }
  if (!response.ok) {
    const e = new Error(data.error || "Request failed");
    e.details = data.errors;
    e.status = response.status;
    throw e;
  }
  return data;
}
export const post = (url, body = {}) => api(url, { method: "POST", body });
export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
export const date = (s) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export const terminal = (s) =>
  ["Approved", "Rejected", "Withdrawn"].includes(s);
export function download(name, data, type = "application/json") {
  const b = new Blob(
    [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
    { type },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const zoneColors = {
  Residential: "#5d9d79",
  Commercial: "#c69c58",
  "Mixed use": "#868bb1",
  "Public use": "#6a9eb3",
  Agricultural: "#a0b469",
  Conservation: "#447c65",
};
