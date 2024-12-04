import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm";

let db;
let conn;
let map;

async function getDb() {
  if (window._db) return window._db;
  
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([importScripts(`${bundle.mainWorker}`)], { type: "text/javascript" })
  );
  
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  window._db = db;
  return db;
}

// Initialiser la carte et les données
async function init() {
  if (window._initCompleted) return;

  try {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('L\'élément de la carte est introuvable.');
      return;
    }

    if (map) {
      map.remove();  // Supprime la carte existante si elle existe déjà
    }

    map = L.map('map', {
      center: [31.6333, -8.0000],  // Coordonnées de la commune Al Haouz
      zoom: 6,
      maxBounds: [
        [30.000, -9.000], // Limite sud
        [37.000, -6.000]  // Limite nord
      ],
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    db = await getDb();
    conn = await db.connect();

    // Charger et insérer les fichiers GeoJSON (1 à 7 et "non touche")
    const geoJSONData1 = await loadGeoJSON('1.geojson');
    const geoJSONData2 = await loadGeoJSON('2.geojson');
    const geoJSONData3 = await loadGeoJSON('3.geojson');
    const geoJSONData4 = await loadGeoJSON('4.geojson');
    const geoJSONData5 = await loadGeoJSON('5.geojson');
    const geoJSONData6 = await loadGeoJSON('6.geojson');
    const geoJSONData7 = await loadGeoJSON('7.geojson');
    const geoJSONDatanonTouche = await loadGeoJSON('non_touche.geojson');  // Assurez-vous que ce fichier est bien dans le même dossier

    // Insérer chaque fichier dans DuckDB
    await insertGeoJSONData('geojson1', geoJSONData1);
    await insertGeoJSONData('geojson2', geoJSONData2);
    await insertGeoJSONData('geojson3', geoJSONData3);
    await insertGeoJSONData('geojson4', geoJSONData4);
    await insertGeoJSONData('geojson5', geoJSONData5);
    await insertGeoJSONData('geojson6', geoJSONData6);
    await insertGeoJSONData('geojson7', geoJSONData7);
    await insertGeoJSONData('geojsonnon_touche', geoJSONDatanonTouche);

    // Ajouter les données sur la carte
    L.geoJSON(geoJSONData1).addTo(map);
    L.geoJSON(geoJSONData2).addTo(map);
    L.geoJSON(geoJSONData3).addTo(map);
    L.geoJSON(geoJSONData4).addTo(map);
    L.geoJSON(geoJSONData5).addTo(map);
    L.geoJSON(geoJSONData6).addTo(map);
    L.geoJSON(geoJSONData7).addTo(map);
    L.geoJSON(geoJSONDatanonTouche).addTo(map);

    window._initCompleted = true; // Marque l'initialisation comme terminée
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  }
}

// Fonction pour charger un fichier GeoJSON
async function loadGeoJSON(fileName) {
  const response = await fetch(fileName);
  if (!response.ok) throw new Error(`Erreur lors du chargement du GeoJSON: ${fileName}`);
  return await response.json();
}

// Fonction pour insérer les données GeoJSON dans DuckDB
async function insertGeoJSONData(tableName, geoJSONData) {
  const features = geoJSONData.features.map(feature => ({
    geometry: JSON.stringify(feature.geometry),
    properties: JSON.stringify(feature.properties),
  }));

  await conn.query(`CREATE TABLE IF NOT EXISTS ${tableName} (geometry JSON, properties JSON);`);

  for (const feature of features) {
    await conn.query(`INSERT INTO ${tableName} (geometry, properties) VALUES ('${feature.geometry}', '${feature.properties}');`);
  }
}
