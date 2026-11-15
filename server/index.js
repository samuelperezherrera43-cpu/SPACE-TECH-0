/**
 * Servidor básico de SPACE-TECH (modo solo).
 * 
 * En modo solo, este servidor solo sirve archivos estáticos y health checks.
 * El multijugador ha sido eliminado.
 */

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 2567);
const HOST = process.env.HOST || '0.0.0.0';

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end('SPACE-TECH server (modo solo)');
});

httpServer.listen(PORT, HOST, () => {
  console.log(`SPACE-TECH server escuchando en ${HOST}:${PORT}`);
  console.log(`health:  http://localhost:${PORT}/health`);
});

export { httpServer };