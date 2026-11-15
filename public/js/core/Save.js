/**
 * Persistencia versionada del universo.
 *
 * Guarda únicamente estado reconstruible (posiciones, módulos, recursos,
 * misiones y vehículos). Nunca serializa geometría de Three.js ni materiales.
 */

export const SAVE_KEY = 'orbital.universe.save';
export const SAVE_VERSION = 3;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Migra instantáneas antiguas al formato actual. */
export function migrateSave(raw) {
  if (!isObject(raw)) return null;

  let data = raw;
  let version = Number(data.version) || 1;

  if (version < 2) {
    // v1 sólo existía como prototipo: se conserva lo que sea compatible y el
    // resto se reconstruye con los valores por defecto.
    data = {
      ...data,
      version: 2,
      destination: data.destination ?? 'station',
      shipLocation: data.shipLocation ?? data.destination ?? 'station',
      missions: data.missions ?? null,
      moon: data.moon ?? null,
      mars: data.mars ?? null,
    };
    version = 2;
  }

  if (version < 3) {
    // v3 añade el estado de la mesa de diseño, el progreso de la Academia y
    // la marca de experiencia guiada. Los saves v2 se conservan íntegros.
    data = {
      ...data,
      version: 3,
      design: data.design ?? null,
      academy: data.academy ?? null,
      guided: data.guided ?? false,
    };
    version = 3;
  }

  if (version > SAVE_VERSION) return null;

  return {
    version: SAVE_VERSION,
    savedAt: Number(data.savedAt) || Date.now(),
    data,
  };
}

export function readSave() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    return migrateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), ...data })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Sin persistencia el juego sigue siendo jugable.
  }
}

export function hasSave() {
  return readSave() !== null;
}

/** ¿La introducción cinematográfica ya fue vista en este perfil? */
export function hasViewedIntro() {
  const save = readSave();
  if (!save) return false;
  return save.data.introViewed === true;
}

/** Marcar la introducción como vista en el perfil actual */
export function setIntroViewed() {
  const save = readSave();
  if (!save) return false;
  save.data = save.data || {};
  save.data.introViewed = true;
  return writeSave(save);
}
