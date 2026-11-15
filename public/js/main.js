import { Game } from './core/Game.js';

const root = document.getElementById('app');

try {
  const game = new Game(root);
  game.run();

  // Útil para depurar desde la consola del navegador.
  window.__orbital = game;
} catch (error) {
  console.error('[ORBITAL] No se pudo iniciar el motor:', error);

  const start = document.getElementById('screen-start');
  if (start) start.classList.add('hidden');

  const box = document.createElement('div');
  box.className = 'fatal';
  box.innerHTML = `
    <h2>No se pudo iniciar el juego</h2>
    <p>Este navegador no pudo crear un contexto WebGL.</p>
    <pre>${String(error && error.message ? error.message : error)}</pre>
  `;
  document.body.appendChild(box);
}
