import * as THREE from 'three';
import {
  makeHullTextures,
  makeDarkMetalTextures,
  makeSuitTextures,
  makeSolarTextures,
} from './Textures.js';

/**
 * Biblioteca central de materiales PBR.
 * Comparte texturas y materiales entre estación, astronauta y herramientas.
 */
export class MaterialLibrary {
  constructor(renderer, preset) {
    this.renderer = renderer;
    this.preset = preset;
    this.anisotropy = Math.min(
      preset.anisotropy ?? 4,
      renderer.capabilities.getMaxAnisotropy()
    );
    this.textures = new Set();
    this.materials = [];
    this._build();
  }

  _texture(texture) {
    texture.anisotropy = this.anisotropy;
    texture.needsUpdate = true;
    this.textures.add(texture);
    return texture;
  }

  _material(options) {
    const material = new THREE.MeshStandardMaterial(options);
    material.envMapIntensity = options.envMapIntensity ?? 0.8;
    this.materials.push(material);
    return material;
  }

  _build() {
    const hull = makeHullTextures(256);
    const dark = makeDarkMetalTextures(256);
    const suit = makeSuitTextures(256);
    const solar = makeSolarTextures(256);

    for (const texture of [hull.map, hull.normalMap, hull.roughnessMap]) this._texture(texture);
    for (const texture of [dark.map, dark.normalMap, dark.roughnessMap]) this._texture(texture);
    for (const texture of [suit.map, suit.normalMap, suit.roughnessMap]) this._texture(texture);
    for (const texture of [solar.map, solar.normalMap, solar.roughnessMap]) this._texture(texture);

    this.hull = this._material({
      map: hull.map,
      normalMap: hull.normalMap,
      roughnessMap: hull.roughnessMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0xffffff,
      roughness: 0.68,
      metalness: 0.34,
      envMapIntensity: 0.85,
    });

    this.hullDark = this._material({
      map: dark.map,
      normalMap: dark.normalMap,
      roughnessMap: dark.roughnessMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0xb9c4d4,
      roughness: 0.58,
      metalness: 0.5,
      envMapIntensity: 0.9,
    });

    this.dark = this._material({
      map: dark.map,
      normalMap: dark.normalMap,
      roughnessMap: dark.roughnessMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      color: 0x8d99aa,
      roughness: 0.52,
      metalness: 0.62,
      envMapIntensity: 1.0,
    });

    this.solar = this._material({
      map: solar.map,
      normalMap: solar.normalMap,
      roughnessMap: solar.roughnessMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.72,
      emissive: 0x0a1c36,
      emissiveIntensity: 0.55,
      envMapIntensity: 1.15,
    });

    this.suit = this._material({
      map: suit.map,
      normalMap: suit.normalMap,
      roughnessMap: suit.roughnessMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.45,
    });

    this.suitDark = this._material({
      map: dark.map,
      normalMap: dark.normalMap,
      roughnessMap: dark.roughnessMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: 0x566273,
      roughness: 0.72,
      metalness: 0.22,
      envMapIntensity: 0.7,
    });

    this.visor = this._material({
      color: 0x06121e,
      roughness: 0.06,
      metalness: 1.0,
      emissive: 0x0b2f40,
      emissiveIntensity: 0.45,
      envMapIntensity: 2.0,
    });

    this.accent = this._material({
      color: 0x5ff0ff,
      emissive: 0x5ff0ff,
      emissiveIntensity: 2.1,
      roughness: 0.32,
      metalness: 0.2,
      envMapIntensity: 0.4,
    });

    this.green = this._material({
      color: 0x6dffa8,
      emissive: 0x2fbf6a,
      emissiveIntensity: 1.7,
      roughness: 0.42,
      metalness: 0.2,
      envMapIntensity: 0.4,
    });

    this.red = this._material({
      color: 0xff5c6c,
      emissive: 0xff2438,
      emissiveIntensity: 1.8,
      roughness: 0.4,
      metalness: 0.2,
      envMapIntensity: 0.4,
    });

    this.metal = this._material({
      map: dark.map,
      normalMap: dark.normalMap,
      roughnessMap: dark.roughnessMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0xc2ccda,
      roughness: 0.28,
      metalness: 0.9,
      envMapIntensity: 1.3,
    });

    this.grip = this._material({
      map: dark.map,
      normalMap: dark.normalMap,
      roughnessMap: dark.roughnessMap,
      color: 0x3c4656,
      roughness: 0.85,
      metalness: 0.18,
      envMapIntensity: 0.5,
    });
  }

  setQuality(preset) {
    this.preset = preset;
    this.anisotropy = Math.min(
      preset.anisotropy ?? 4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    for (const texture of this.textures) {
      texture.anisotropy = this.anisotropy;
      texture.needsUpdate = true;
    }
  }

  dispose() {
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.materials.length = 0;
    this.textures.clear();
  }
}
