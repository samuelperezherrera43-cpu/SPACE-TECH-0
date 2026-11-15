/**
 * Perfil gráfico único de SPACE-TECH.
 *
 * Desde la versión 3.7 no existe selector de calidad visible: el juego usa un
 * perfil estándar equilibrado (materiales PBR, sombras controladas, bloom
 * suave, SMAA y pixel ratio limitado). La optimización avanzada queda para una
 * fase posterior; aquí sólo se centraliza la configuración.
 */

export const STANDARD_PROFILE = {
  id: 'standard',
  name: 'Estándar',
  pixelRatio: 1.0,
  shadows: true,
  shadowMapSize: 1024,
  bloom: true,
  bloomStrength: 0.2,
  bloomRadius: 0.42,
  bloomThreshold: 0.84,
  bloomResolutionScale: 0.4,
  aa: 'smaa',
  anisotropy: 8,
  stars: 2000,
  pointLights: true,
};

export class QualityManager {
  constructor() {
    this.presets = { standard: STANDARD_PROFILE };
    this.current = 'standard';
    // Se conserva el callback para que Game pueda aplicar el perfil al
    // arrancar, pero ya no hay cambios interactivos.
    this.onChange = null;
  }

  get preset() {
    return this.presets[this.current];
  }

  /** Compatibilidad: sólo existe el perfil estándar. */
  set() {
    return this.preset;
  }

  /** Perfil solicitado por herramientas de medición. */
  describe() {
    return { ...STANDARD_PROFILE };
  }
}
