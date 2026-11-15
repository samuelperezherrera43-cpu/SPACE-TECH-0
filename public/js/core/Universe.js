/**
 * Configuración de los destinos planetarios.
 *
 * Las coordenadas son locales a la superficie: la base mira al norte (+Z)
 * y la plataforma de aterrizaje queda al sur, en el punto de llegada.
 */
export const MOON_CONFIG = {
  id: 'moon',
  name: 'Luna · Base Selene',
  short: 'Luna',
  seed: 0x51e1a,
  gravity: 1.624,
  pad: [0, 6],
  rover: [12, 18],
  mountain: [82, 64],
  mountainStart: 58,
  mountainWidth: 32,
  mountainHeight: 9,
  craters: [
    { x: -52, z: 8, r: 16, depth: 4.2, rim: 1.6 },
    { x: 46, z: -34, r: 12, depth: 3.2, rim: 1.3 },
    { x: -34, z: 70, r: 20, depth: 5.0, rim: 2.0 },
    { x: 20, z: 84, r: 10, depth: 2.6, rim: 1.0 },
  ],
  flatZones: [
    { x: 0, z: 30, y: 0, radius: 40 },
    { x: 0, z: 6, y: 0, radius: 13 },
  ],
  resources: [
    { id: 'moon_ice_1', resource: 'waterIce', label: 'hielo lunar', amount: 4, position: [-28, 12] },
    { id: 'moon_ice_2', resource: 'waterIce', label: 'hielo lunar', amount: 5, position: [24, -16] },
    { id: 'moon_ore_1', resource: 'minerals', label: 'minerales', amount: 4, position: [28, 42] },
    { id: 'moon_metal_1', resource: 'metals', label: 'metales', amount: 5, position: [-30, 46] },
    { id: 'moon_regolith_1', resource: 'regolith', label: 'regolito', amount: 8, position: [32, 18] },
    { id: 'moon_regolith_2', resource: 'regolith', label: 'regolito', amount: 8, position: [-16, 54] },
  ],
  groundLow: 0x62666d,
  groundHigh: 0xb9bdc4,
  rockColor: 0x7d828a,
  rockDark: 0x484d55,
  glassColor: 0x9fd8ff,
  accentColor: 0x5ff0ff,
  oreColor: 0xffb45f,
  dustColor: 0xbfc4cc,
  rockCount: 180,
  dust: true,
  cave: null,
};

export const SOLAR_SYSTEM = {
  earth: {
    gravity: 9.80665, // m/s², NSSDC Earth Fact Sheet
    radiusKm: 6371.0, // radio medio
    issAltitudeKm: { min: 370, max: 460, reference: 400 }, // ISS LEO
  },
  moon: {
    gravity: 1.624, // m/s², NSSDC Moon Fact Sheet
    radiusKm: 1737.4,
    distanceFromEarthKm: 384400, // distancia media Tierra-Luna
    earthAngularDiameterDeg: { min: 1.8, max: 2.0 }, // desde la Luna
  },
  mars: {
    gravity: 3.73, // m/s², NSSDC Mars Fact Sheet (3.71 redondeado en el juego)
    radiusKm: 3389.5,
    distanceFromEarthKm: { min: 54600000, max: 400200000 }, // varía con la órbita
    earthAngularDiameterDeg: { min: 0.0018, max: 0.013 }, // desde Marte (aprox.)
  },
  sun: {
    distanceFromEarthKm: 149600000, // 1 UA
  },
  transferWindows: {
    marsMonths: 26, // oportunidades de transferencia eficiente cada ~26 meses
  },
  durations: {
    moonDays: { min: 3, reference: 3 }, // misiones Apollo ~3 días
    marsMonths: { min: 7, max: 10 }, // trayectorias directas 7-10 meses
  },
};
export const MARS_CONFIG = {
  id: 'mars',
  name: 'Marte · Puesto Ares',
  short: 'Marte',
  seed: 0xa4e5,
  gravity: 3.73,
  pad: [0, 6],
  rover: [12, 18],
  mountain: [-74, 72],
  mountainStart: 54,
  mountainWidth: 52,
  mountainHeight: 32,
  craters: [
    { x: 48, z: 20, r: 14, depth: 3.8, rim: 1.4 },
    { x: -30, z: 64, r: 18, depth: 4.6, rim: 1.8 },
    { x: 30, z: -40, r: 10, depth: 2.8, rim: 1.1 },
  ],
  canyon: { z: -42, width: 13, depth: 9 },
  flatZones: [
    { x: 0, z: 30, y: 0, radius: 40 },
    { x: 0, z: 6, y: 0, radius: 13 },
    { x: -40, z: -26, y: -0.6, radius: 15 },
  ],
  resources: [
    { id: 'mars_ore_1', resource: 'minerals', label: 'minerales', amount: 6, position: [22, 52] },
    { id: 'mars_ore_2', resource: 'minerals', label: 'minerales', amount: 5, position: [-46, 4] },
    { id: 'mars_ice_1', resource: 'waterIce', label: 'hielo subsuperficial', amount: 5, position: [-22, -22] },
    { id: 'mars_metal_1', resource: 'metals', label: 'metales', amount: 6, position: [-32, 34] },
    { id: 'mars_regolith_1', resource: 'regolith', label: 'regolito', amount: 9, position: [30, 12] },
  ],
  groundLow: 0x7a3a22,
  groundHigh: 0xd08a5a,
  rockColor: 0x8f4a2e,
  rockDark: 0x4f2618,
  glassColor: 0xffb27a,
  accentColor: 0xff8a3c,
  oreColor: 0x8ff0ff,
  dustColor: 0xd99a6a,
  rockCount: 190,
  dust: true,
  cave: { x: -40, z: -26 },
};
