import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startDevServer } from './dev.mjs';

const port = Number(process.env.PORT || 5173);
const wantTunnel = !process.argv.includes('--no-tunnel');

const server = startDevServer({ port });

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nEl puerto ${port} ya esta ocupado. Cierra el otro servidor o usa PORT=5174 npm run share\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

const has = (command) => {
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return probe.status === 0;
};

// cloudflared puede estar instalado con winget o ser el .exe portátil
// colocado en el perfil del usuario (sin permisos de administrador).
function findCloudflared() {
  if (has('cloudflared')) return 'cloudflared';
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const portable = join(process.env.LOCALAPPDATA, 'cloudflared', 'cloudflared.exe');
    if (existsSync(portable)) return portable;
  }
  return null;
}

let tunnel = null;

function stop(code = 0) {
  if (tunnel && !tunnel.killed) tunnel.kill();
  server.close(() => process.exit(code));
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

function shareTips() {
  console.log('\n-- Compartir por internet ---------------------------------');
  console.log('No encuentro cloudflared ni ngrok instalados.');
  console.log('  winget install --id Cloudflare.cloudflared');
  console.log('  npm run share');
  console.log('\nSi tu companero no conecta en la LAN, permite Node.js en el');
  console.log('Firewall de Windows (redes privadas) o ejecuta como admin:');
  console.log(`  netsh advfirewall firewall add rule name="ORBITAL dev" dir=in action=allow protocol=TCP localport=${port}`);
  console.log('-----------------------------------------------------------\n');
}

function openTunnel() {
  if (!wantTunnel) {
    shareTips();
    return;
  }

  const cloudflared = findCloudflared();

  if (cloudflared) {
    console.log('Abriendo tunel con cloudflared...\n');
    tunnel = spawn(cloudflared, ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], {
      shell: cloudflared === 'cloudflared' && process.platform === 'win32',
    });

    const scan = (chunk) => {
      const match = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (!match) return;
      console.log('-- Enlace publico para tu companero -----------------------');
      console.log(`  ${match[0]}`);
      console.log('  Temporal mientras este proceso siga abierto.');
      console.log('  Cualquiera con el enlace puede jugar: no lo publiques.');
      console.log('-----------------------------------------------------------\n');
      tunnel.stdout?.off('data', scan);
      tunnel.stderr?.off('data', scan);
    };

    tunnel.stdout?.on('data', scan);
    tunnel.stderr?.on('data', scan);
    tunnel.on('exit', (code) => {
      if (code !== 0 && code !== null) console.error(`cloudflared termino con codigo ${code}`);
    });
    return;
  }

  if (has('ngrok')) {
    console.log('Abriendo tunel con ngrok...\n');
    tunnel = spawn('ngrok', ['http', String(port)], { shell: process.platform === 'win32' });
    tunnel.stdout?.on('data', (chunk) => process.stdout.write(chunk));
    tunnel.stderr?.on('data', (chunk) => process.stderr.write(chunk));
    return;
  }

  shareTips();
}

server.once('listening', openTunnel);
