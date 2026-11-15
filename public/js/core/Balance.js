/**
 * Balance central del juego.
 *
 * Todos los consumos, recuperaciones y límites viven aquí para poder ajustar
 * la experiencia sin tocar Player, Game ni las misiones. Las unidades son
 * "puntos por segundo" sobre recursos de 0 a 100.
 *
 * Duraciones aproximadas de una EVA con 100 puntos de O2:
 *   Exploración · 0,16/s  → ~10,4 min (sin propulsar)
 *   Normal      · 0,42/s  → ~4 min
 *   Desafío     · 0,85/s  → ~2 min
 */

export const DIFFICULTIES = {
  exploration: {
    id: 'exploration',
    name: 'Exploración',
    tagline: 'Recursos holgados y misiones largas. Recomendado.',
    o2Drain: 0.16,
    o2ThrustDrain: 0.05,
    o2Regen: 14,
    rcsDrain: 1.2,
    rcsBoostDrain: 2.0,
    rcsRegen: 16,
    hullImpactScale: 0.8,
    hullImpactThreshold: 3.4,
    hullRepair: 30,
    hullRepairCooldown: 4,
    tetherLength: 32,
    tetherStiffness: 5.0,
    tetherDamping: 2.6,
    breachBurstInterval: 999,
    breachBurstDamage: 0,
    scanCooldown: 3.5,
    repairTimeScale: 0.85,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    tagline: 'Equilibrio entre exploración, recursos y objetivos.',
    o2Drain: 0.42,
    o2ThrustDrain: 0.16,
    o2Regen: 10,
    rcsDrain: 2.4,
    rcsBoostDrain: 3.8,
    rcsRegen: 12,
    hullImpactScale: 1,
    hullImpactThreshold: 3.0,
    hullRepair: 25,
    hullRepairCooldown: 5,
    tetherLength: 28,
    tetherStiffness: 5.6,
    tetherDamping: 2.8,
    breachBurstInterval: 999,
    breachBurstDamage: 0,
    scanCooldown: 4,
    repairTimeScale: 1,
  },
  challenge: {
    id: 'challenge',
    name: 'Desafío',
    tagline: 'Consumo exigente, impactos duros y menos margen.',
    o2Drain: 0.85,
    o2ThrustDrain: 0.3,
    o2Regen: 6,
    rcsDrain: 4.0,
    rcsBoostDrain: 6.2,
    rcsRegen: 8,
    hullImpactScale: 1.35,
    hullImpactThreshold: 2.6,
    hullRepair: 18,
    hullRepairCooldown: 7,
    tetherLength: 24,
    tetherStiffness: 6.4,
    tetherDamping: 3.0,
    breachBurstInterval: 999,
    breachBurstDamage: 0,
    scanCooldown: 4.5,
    repairTimeScale: 1.15,
  },
};

export const DEFAULT_DIFFICULTY = 'exploration';
const STORAGE_KEY = 'orbital.difficulty.v1';

export function loadDifficulty() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DIFFICULTIES[stored]) return stored;
  } catch {
    // localStorage puede fallar en modo privado; se usa el valor por defecto.
  }
  return DEFAULT_DIFFICULTY;
}

export function saveDifficulty(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // sin persistencia: la partida sigue funcionando.
  }
}

/**
 * Gestor mínimo: mantiene la dificultad activa y notifica el cambio.
 */
export class BalanceManager {
  constructor() {
    this.id = loadDifficulty();
    this.values = DIFFICULTIES[this.id];
    this.onChange = null;
  }

  set(id) {
    if (!DIFFICULTIES[id] || id === this.id) return;
    this.id = id;
    this.values = DIFFICULTIES[id];
    saveDifficulty(id);
    this.onChange?.(this.values, id);
  }
}
