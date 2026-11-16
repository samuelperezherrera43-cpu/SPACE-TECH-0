/**
 * Configuración de despliegue de SPACE-TECH.
 *
 * Este archivo se carga antes que el juego y define las URLs públicas que
 * necesita el multijugador. Al desplegar en Vercel, Render, Netlify o un VPS,
 * edita los valores y vuelve a desplegar.
 *
 * - `multiplayerUrl`: URL HTTPS del servidor Colyseus (server/).
 *   Déjalo vacío para desarrollo local: el cliente usará localhost:2567.
 *   Ejemplo: 'https://space-tech-server.onrender.com'
 *
 * - `publicUrl`: URL pública del juego, usada para generar enlaces de
 *   invitación. Ejemplo: 'https://space-tech.vercel.app'
 *
 * Nunca uses `localhost` en enlaces que vayas a compartir.
 */
window.SPACE_TECH_CONFIG = {
  multiplayerUrl: '',
  publicUrl: '',
};
