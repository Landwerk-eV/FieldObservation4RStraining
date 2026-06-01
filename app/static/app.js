const datasetSelect = document.getElementById("datasetSelect");
const apiTokenInput = document.getElementById("apiToken");
const tokenBtn = document.getElementById("tokenBtn");
const loadBtn = document.getElementById("loadBtn");
const saveBtn = document.getElementById("saveBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const drawBtn = document.getElementById("drawBtn");
const modifyBtn = document.getElementById("modifyBtn");
const splitBtn = document.getElementById("splitBtn");
const confirmSplitBtn = document.getElementById("confirmSplitBtn");
const cancelSplitBtn = document.getElementById("cancelSplitBtn");
const mergeBtn = document.getElementById("mergeBtn");
const deleteBtn = document.getElementById("deleteBtn");
const statusText = document.getElementById("statusText");
const attrForm = document.getElementById("attrForm");
const metaInfo = document.getElementById("metaInfo");
const activityLog = document.getElementById("activityLog");

let currentDataset = null;
let currentLayer = null;
let editableFields = [];
let selectedFeature = null;
let editMode = "modify";
let pendingSplit = null;
let historyStack = [];
let redoStack = [];
let activityEvents = [];
let localFeatureCounter = 0;
let baselineSnapshot = "";
let isDirty = false;
let apiToken = localStorage.getItem("fieldobs.apiToken") || "";

function syncApiToken(token) {
  apiToken = token.trim();
  if (apiToken) {
    localStorage.setItem("fieldobs.apiToken", apiToken);
  } else {
    localStorage.removeItem("fieldobs.apiToken");
  }
  if (apiTokenInput) {
    apiTokenInput.value = apiToken;
  }
}

syncApiToken(apiToken);

const rasterLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attributions: "Tiles: Esri"
  })
});

const vectorSource = new ol.source.Vector();
const vectorLayer = new ol.layer.Vector({
  source: vectorSource,
  style: (feature) => {
    if (feature.get("__splitPreview")) {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({ color: "#22a6b3", width: 3, lineDash: [6, 6] }),
        fill: new ol.style.Fill({ color: "rgba(34, 166, 179, 0.24)" })
      });
    }
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#ffbc42", width: 2 }),
      fill: new ol.style.Fill({ color: "rgba(196, 89, 46, 0.25)" })
    });
  }
});

const map = new ol.Map({
  target: "map",
  layers: [rasterLayer, vectorLayer],
  view: new ol.View({
    center: ol.proj.fromLonLat([10.0, 51.2]),
    zoom: 9
  })
});

const selectInteraction = new ol.interaction.Select({ layers: [vectorLayer], multi: true });
const modifyInteraction = new ol.interaction.Modify({ source: vectorSource });
const drawPolygonInteraction = new ol.interaction.Draw({
  source: vectorSource,
  type: "Polygon"
});
const drawSplitLineInteraction = new ol.interaction.Draw({
  source: new ol.source.Vector(),
  type: "LineString"
});

map.addInteraction(selectInteraction);
map.addInteraction(modifyInteraction);
map.addInteraction(drawPolygonInteraction);
map.addInteraction(drawSplitLineInteraction);
drawPolygonInteraction.setActive(false);
drawSplitLineInteraction.setActive(false);

selectInteraction.on("select", (event) => {
  const selected = event.target.getFeatures().getArray();
  selectedFeature = selected.length === 1 ? selected[0] : null;
  renderAttributes();
});

function setStatus(msg) {
  statusText.textContent = msg;
}

function updateDirtyIndicator() {
  document.title = `${isDirty ? "* " : ""}Field Observation Editor`;
}

function refreshDirtyState() {
  if (!baselineSnapshot) {
    isDirty = false;
    updateDirtyIndicator();
    return;
  }
  isDirty = pendingSplit !== null || snapshotCurrentFeatures() !== baselineSnapshot;
  updateDirtyIndicator();
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function renderActivityLog() {
  if (!activityLog) {
    return;
  }
  activityLog.innerHTML = "";
  if (activityEvents.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No actions yet.";
    activityLog.appendChild(item);
    return;
  }

  activityEvents.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `[${entry.time}] ${entry.message}`;
    activityLog.appendChild(item);
  });
}

function logAction(message) {
  activityEvents.unshift({ time: nowTime(), message });
  if (activityEvents.length > 20) {
    activityEvents = activityEvents.slice(0, 20);
  }
  renderActivityLog();
}

function featureLabel(feature) {
  if (!feature) {
    return "feature:unknown";
  }
  const id = feature.getId?.();
  if (id !== undefined && id !== null && `${id}`.length > 0) {
    return `feature:${id}`;
  }

  const candidates = [
    feature.get("id"),
    feature.get("fid"),
    feature.get("ID"),
    feature.get("FID"),
    feature.get("OBJECTID"),
    feature.get("objectid")
  ];
  const value = candidates.find((item) => item !== undefined && item !== null && `${item}`.length > 0);
  if (value !== undefined) {
    return `feature:${value}`;
  }

  const localLabel = feature.get("__localLabel");
  if (localLabel) {
    return localLabel;
  }

  localFeatureCounter += 1;
  const generated = `feature:local-${localFeatureCounter}`;
  feature.set("__localLabel", generated, true);
  return generated;

  return "feature:unknown";
}

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (apiToken) {
    headers.set("X-FieldObs-Token", apiToken);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload.detail || `Request failed (${response.status})`;
    if (response.status === 401) {
      throw new Error(apiToken ? `Access token rejected: ${detail}` : "Access token required");
    }
    throw new Error(detail);
  }
  return response.json();
}

function snapshotCurrentFeatures() {
  const format = new ol.format.GeoJSON();
  const fc = format.writeFeaturesObject(vectorSource.getFeatures(), {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });
  return JSON.stringify(fc);
}

function restoreSnapshot(snapshot, statusMessage) {
  const format = new ol.format.GeoJSON();
  const fc = JSON.parse(snapshot);
  vectorSource.clear();
  const features = format.readFeatures(fc, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });
  vectorSource.addFeatures(features);
  selectInteraction.getFeatures().clear();
  selectedFeature = null;
  renderAttributes();
  if (statusMessage) {
    setStatus(statusMessage);
  }
}

function pushHistory() {
  const current = snapshotCurrentFeatures();
  if (historyStack.length === 0 || historyStack[historyStack.length - 1] !== current) {
    historyStack.push(current);
    if (historyStack.length > 50) {
      historyStack = historyStack.slice(historyStack.length - 50);
    }
    redoStack = [];
  }
}

function initHistory() {
  historyStack = [];
  redoStack = [];
  pushHistory();
  baselineSnapshot = historyStack.length > 0 ? historyStack[0] : "";
  refreshDirtyState();
}

function commitAttributeChange(field, value) {
  if (!selectedFeature) {
    return;
  }
  selectedFeature.set(field, value);
  pushHistory();
  refreshDirtyState();
  logAction(`Updated attribute '${field}' on ${featureLabel(selectedFeature)}`);
  setStatus(`Attribute '${field}' updated`);
}

function renderAttributes() {
  attrForm.innerHTML = "";
  const selected = selectInteraction.getFeatures().getArray();
  if (selected.length > 1) {
    attrForm.innerHTML = "<p class='muted'>Multiple polygons selected. Select one to edit attributes.</p>";
    return;
  }
  if (!selectedFeature) {
    attrForm.innerHTML = "<p class='muted'>No feature selected.</p>";
    return;
  }

  editableFields.forEach((field) => {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", `field-${field}`);
    label.textContent = field;

    const input = document.createElement("input");
    input.id = `field-${field}`;
    input.value = selectedFeature.get(field) || "";
    input.addEventListener("input", (event) => {
      selectedFeature.set(field, event.target.value);
      refreshDirtyState();
      setStatus("Unsaved changes");
    });
    input.addEventListener("change", (event) => {
      commitAttributeChange(field, event.target.value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    attrForm.appendChild(wrapper);
  });
}

function fitToFeatures() {
  if (vectorSource.getFeatures().length === 0) {
    return;
  }
  map.getView().fit(vectorSource.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 18 });
}

function setEditMode(mode) {
  editMode = mode;
  drawPolygonInteraction.setActive(mode === "draw");
  drawSplitLineInteraction.setActive(mode === "split");
  modifyInteraction.setActive(mode !== "draw" && mode !== "split");
}

if (tokenBtn) {
  tokenBtn.addEventListener("click", () => {
    syncApiToken(apiTokenInput ? apiTokenInput.value : "");
    setStatus(apiToken ? "Access token saved" : "Access token cleared");
  });
}

async function loadDatasets() {
  const payload = await fetchJson("/api/datasets");
  datasetSelect.innerHTML = "";

  payload.datasets.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    datasetSelect.appendChild(option);
  });

  if (payload.datasets.length > 0) {
    datasetSelect.value = payload.datasets[0];
    currentDataset = payload.datasets[0];
  }
}

async function loadFeatures() {
  currentDataset = datasetSelect.value;
  if (!currentDataset) {
    return;
  }

  setStatus("Loading data...");
  const payload = await fetchJson(`/api/datasets/${encodeURIComponent(currentDataset)}/features`);

  vectorSource.clear();
  const format = new ol.format.GeoJSON();
  const features = format.readFeatures(payload, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });
  vectorSource.addFeatures(features);

  currentLayer = payload.meta.layer;
  editableFields = payload.meta.editable_fields || [];
  selectedFeature = null;
  pendingSplit = null;
  confirmSplitBtn.classList.add("hidden");
  cancelSplitBtn.classList.add("hidden");
  renderAttributes();
  fitToFeatures();
  initHistory();

  metaInfo.textContent = JSON.stringify(payload.meta, null, 2);
  setStatus(`Loaded ${features.length} features`);
  activityEvents = [];
  renderActivityLog();
  logAction(`Loaded dataset ${currentDataset} (${features.length} features)`);
}

async function saveFeatures() {
  if (!currentDataset) {
    return;
  }
  if (pendingSplit) {
    setStatus("Confirm or cancel split preview before saving");
    return;
  }

  setStatus("Saving...");
  const format = new ol.format.GeoJSON();
  const geojson = format.writeFeaturesObject(vectorSource.getFeatures(), {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });

  const payload = {
    layer: currentLayer,
    feature_collection: {
      type: "FeatureCollection",
      features: geojson.features
    }
  };

  const result = await fetchJson(`/api/datasets/${encodeURIComponent(currentDataset)}/features`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  baselineSnapshot = snapshotCurrentFeatures();
  refreshDirtyState();
  logAction(`Saved ${result.feature_count} features`);
  setStatus(`Saved ${result.feature_count} features`);
}

drawSplitLineInteraction.on("drawend", async (event) => {
  try {
    if (pendingSplit) {
      setStatus("Confirm or cancel the current split preview first");
      return;
    }

    const selected = selectInteraction.getFeatures().getArray();
    if (selected.length !== 1) {
      setStatus("Select exactly one polygon before split");
      return;
    }

    const format = new ol.format.GeoJSON();
    const featureObj = format.writeFeatureObject(selected[0], {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    });
    const splitterObj = format.writeGeometryObject(event.feature.getGeometry(), {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    });

    const result = await fetchJson("/api/geometry/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: featureObj, splitter: splitterObj })
    });

    const preSnapshot = snapshotCurrentFeatures();
    vectorSource.removeFeature(selected[0]);
    const newFeatures = format.readFeatures(
      { type: "FeatureCollection", features: result.features },
      {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857"
      }
    );
    newFeatures.forEach((f) => {
      f.set("__splitPreview", true);
      vectorSource.addFeature(f);
    });

    pendingSplit = { preSnapshot };
    refreshDirtyState();
    confirmSplitBtn.classList.remove("hidden");
    cancelSplitBtn.classList.remove("hidden");
    selectInteraction.getFeatures().clear();
    selectedFeature = null;
    renderAttributes();
    logAction(`Split preview created for ${featureLabel(selected[0])} (${newFeatures.length} parts)`);
    setStatus(`Split preview ready (${newFeatures.length} parts). Confirm or cancel.`);
  } catch (err) {
    setStatus(err.message);
  }
});

loadBtn.addEventListener("click", async () => {
  if (isDirty) {
    const proceed = confirm(
      "You have unsaved changes. Loading a dataset will discard current in-memory edits. Continue?"
    );
    if (!proceed) {
      return;
    }
  }
  try {
    await loadFeatures();
  } catch (err) {
    setStatus(err.message);
  }
});

saveBtn.addEventListener("click", async () => {
  try {
    await saveFeatures();
  } catch (err) {
    setStatus(err.message);
  }
});

undoBtn.addEventListener("click", () => {
  if (historyStack.length <= 1) {
    setStatus("Nothing to undo");
    return;
  }
  const current = historyStack.pop();
  redoStack.push(current);
  const previous = historyStack[historyStack.length - 1];
  pendingSplit = null;
  confirmSplitBtn.classList.add("hidden");
  cancelSplitBtn.classList.add("hidden");
  restoreSnapshot(previous, "Undo applied");
  refreshDirtyState();
  logAction("Undo");
});

redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) {
    setStatus("Nothing to redo");
    return;
  }
  const snapshot = redoStack.pop();
  historyStack.push(snapshot);
  pendingSplit = null;
  confirmSplitBtn.classList.add("hidden");
  cancelSplitBtn.classList.add("hidden");
  restoreSnapshot(snapshot, "Redo applied");
  refreshDirtyState();
  logAction("Redo");
});

modifyBtn.addEventListener("click", () => {
  setEditMode("modify");
  setStatus("Modify mode enabled");
});

drawBtn.addEventListener("click", () => {
  setEditMode("draw");
  setStatus("Draw mode enabled");
});

splitBtn.addEventListener("click", () => {
  if (pendingSplit) {
    setStatus("Confirm or cancel current split preview first");
    return;
  }
  setEditMode("split");
  setStatus("Split mode: select one polygon, then draw a cut line");
});

confirmSplitBtn.addEventListener("click", () => {
  if (!pendingSplit) {
    return;
  }
  const previewCount = vectorSource.getFeatures().filter((feature) => feature.get("__splitPreview")).length;
  vectorSource.getFeatures().forEach((feature) => {
    if (feature.get("__splitPreview")) {
      feature.unset("__splitPreview", true);
    }
  });
  pendingSplit = null;
  confirmSplitBtn.classList.add("hidden");
  cancelSplitBtn.classList.add("hidden");
  pushHistory();
  refreshDirtyState();
  logAction(`Split confirmed (${previewCount} resulting part(s))`);
  setStatus("Split confirmed");
});

cancelSplitBtn.addEventListener("click", () => {
  if (!pendingSplit) {
    return;
  }
  restoreSnapshot(pendingSplit.preSnapshot, "Split canceled");
  pendingSplit = null;
  confirmSplitBtn.classList.add("hidden");
  cancelSplitBtn.classList.add("hidden");
  refreshDirtyState();
  logAction("Split canceled");
});

mergeBtn.addEventListener("click", async () => {
  try {
    const selected = selectInteraction.getFeatures().getArray();
    if (selected.length < 2) {
      setStatus("Select at least two polygons to merge");
      return;
    }

    const format = new ol.format.GeoJSON();
    const selectedObjects = selected.map((feature) =>
      format.writeFeatureObject(feature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857"
      })
    );

    const result = await fetchJson("/api/geometry/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: selectedObjects })
    });

    selected.forEach((feature) => vectorSource.removeFeature(feature));
    const merged = format.readFeature(result.feature, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    });
    vectorSource.addFeature(merged);
    selectInteraction.getFeatures().clear();
    selectedFeature = null;
    renderAttributes();
    pushHistory();
    refreshDirtyState();
    const labels = selected.map((feature) => featureLabel(feature)).join(", ");
    logAction(`Merged ${selected.length} polygons (${labels})`);
    setStatus("Merged selected polygons");
  } catch (err) {
    setStatus(err.message);
  }
});

deleteBtn.addEventListener("click", () => {
  const selected = selectInteraction.getFeatures().getArray();
  selected.forEach((feature) => vectorSource.removeFeature(feature));
  selectInteraction.getFeatures().clear();
  selectedFeature = null;
  renderAttributes();
  if (selected.length > 0) {
    pushHistory();
    refreshDirtyState();
    const labels = selected.map((feature) => featureLabel(feature)).join(", ");
    logAction(`Deleted ${selected.length} polygon(s) (${labels})`);
    setStatus("Deleted selected polygon(s)");
  }
});

drawPolygonInteraction.on("drawend", (event) => {
  pushHistory();
  refreshDirtyState();
  logAction(`Drew polygon (${featureLabel(event.feature)})`);
});

modifyInteraction.on("modifyend", (event) => {
  pushHistory();
  refreshDirtyState();
  const labels = event.features.getArray().map((feature) => featureLabel(feature)).join(", ");
  logAction(`Modified polygon geometry (${labels})`);
});

window.addEventListener("beforeunload", (event) => {
  if (!isDirty) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
});

(async function init() {
  try {
    setEditMode(editMode);
    renderActivityLog();
    await loadDatasets();
    if (currentDataset) {
      await loadFeatures();
    } else {
      setStatus("No GeoPackage files found in data folder");
    }
  } catch (err) {
    setStatus(err.message);
  }
})();
