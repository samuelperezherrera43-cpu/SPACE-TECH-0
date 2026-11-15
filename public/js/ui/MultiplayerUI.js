/**
 * Interfaz del multijugador cooperativo.
 *
 * Pantalla independiente dentro del menú existente: crear sala, unirse por
 * código, listar salas públicas, sala de espera, preparación e inicio.
 * Todos los botones ejecutan acciones reales contra el servidor.
 */

const SUIT_SWATCHES = ['#eef3f7', '#ffc38d', '#9fe3ff', '#c9bcff'];
const STATUS_LABELS = {
  idle: 'Sin conexión',
  connecting: 'Conectando…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  disconnected: 'Desconectado',
};

export class MultiplayerUI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.client = game.multiplayer;
    this.visible = false;
    this.lastState = null;
    this._lastRoomsFetch = 0;

    this.dom = {
      screen: root.querySelector('#screen-multiplayer'),
      entry: root.querySelector('#mp-entry'),
      room: root.querySelector('#mp-room'),
      roomsPanel: root.querySelector('#mp-rooms-panel'),
      connection: root.querySelector('#mp-connection'),
      connectionLabel: root.querySelector('#mp-connection-label'),
      latency: root.querySelector('#mp-latency'),
      name: root.querySelector('#mp-name'),
      appearance: root.querySelector('#mp-appearance'),
      roomName: root.querySelector('#mp-room-name'),
      privateRoom: root.querySelector('#mp-private'),
      code: root.querySelector('#mp-code'),
      create: root.querySelector('#mp-create'),
      join: root.querySelector('#mp-join'),
      quick: root.querySelector('#mp-quick'),
      refresh: root.querySelector('#mp-refresh'),
      rooms: root.querySelector('#mp-rooms'),
      roomCode: root.querySelector('#mp-room-code'),
      copy: root.querySelector('#mp-copy'),
      roomNameLabel: root.querySelector('#mp-room-name-label'),
      roomCapacity: root.querySelector('#mp-room-capacity'),
      players: root.querySelector('#mp-players'),
      ready: root.querySelector('#mp-ready'),
      start: root.querySelector('#mp-start'),
      leave: root.querySelector('#mp-leave'),
      hint: root.querySelector('#mp-hint'),
      message: root.querySelector('#mp-message'),
      back: root.querySelector('#mp-back'),
      hud: root.querySelector('#mp-hud'),
      hudCode: root.querySelector('#mp-hud-code'),
      hudPlayers: root.querySelector('#mp-hud-players'),
      hudLatency: root.querySelector('#mp-hud-latency'),
    };

    this._buildSwatches();
    this._wire();
    this._subscribe();

    this.dom.name.value = this.client.name || '';
    this._renderConnection('idle');
  }

  /* ------------------------------------------------------------- montaje */

  _buildSwatches() {
    if (!this.dom.appearance) return;
    this.dom.appearance.textContent = '';
    SUIT_SWATCHES.forEach((color, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mp-swatch';
      button.dataset.index = String(index);
      button.style.setProperty('--swatch', color);
      button.setAttribute('aria-label', `Traje ${index + 1}`);
      button.addEventListener('click', () => {
        this.client.setIdentity({ appearance: index });
        this._renderSwatches();
      });
      this.dom.appearance.appendChild(button);
    });
    this._renderSwatches();
  }

  _renderSwatches() {
    if (!this.dom.appearance) return;
    for (const button of this.dom.appearance.querySelectorAll('.mp-swatch')) {
      button.classList.toggle('is-active', Number(button.dataset.index) === this.client.appearance);
    }
  }

  _wire() {
    this.dom.create?.addEventListener('click', () => this._createRoom());
    this.dom.join?.addEventListener('click', () => this._joinRoom());
    this.dom.quick?.addEventListener('click', () => this._joinPublic());
    this.dom.refresh?.addEventListener('click', () => this.refreshRooms(true));
    this.dom.copy?.addEventListener('click', () => this._copyCode());
    this.dom.ready?.addEventListener('click', () => this._toggleReady());
    this.dom.start?.addEventListener('click', () => this.client.sendStart());
    this.dom.leave?.addEventListener('click', () => this._leaveRoom());
    this.dom.back?.addEventListener('click', () => this.close());

    this.dom.code?.addEventListener('input', () => {
      this.dom.code.value = this.dom.code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    this.dom.code?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this._joinRoom();
    });
  }

  _subscribe() {
    this.client.on('status', ({ status, message }) => {
      this._renderConnection(status, message);
    });

    this.client.on('state', (payload) => {
      this.lastState = payload;
      this._renderState(payload);
    });

    this.client.on('latency', ({ ms }) => {
      const text = ms > 0 ? `${ms} ms` : '—';
      if (this.dom.latency) this.dom.latency.textContent = text;
      if (this.dom.hudLatency) this.dom.hudLatency.textContent = text;
    });

    this.client.on('notice', ({ level, message }) => {
      if (!message) return;
      this._message(message, level === 'warn' ? 'warn' : level === 'good' ? 'good' : '');
      if (this.game.multiplayerActive) {
        this.game.hud.toast(message, level === 'warn' ? 'warn' : 'good', 3);
      }
    });

    this.client.on('error', ({ message }) => this._message(message, 'bad'));

    this.client.on('started', () => {
      this._message('Exploración iniciada.', 'good');
      this.game.enterMultiplayerWorld();
    });

    this.client.on('destinationChanged', ({ destination }) => {
      this.game.applyMultiplayerDestination(destination);
    });

    this.client.on('left', () => {
      this._showEntry();
      this._renderPlayers(new Map(), null);
      this.game.exitMultiplayerWorld();
    });
  }

  /* ------------------------------------------------------------ pantalla */

  open() {
    this.visible = true;
    this.game.state = 'menu';
    this.game.hud.screen('multiplayer');
    this.dom.name.value = this.client.name || '';
    this._renderSwatches();
    if (this.client.room) {
      this._showRoom(this.lastState);
      this._renderState(this.lastState);
    } else {
      this._showEntry();
      this.refreshRooms(false);
      void this._tryResume();
    }
    this._renderConnection(this.client.status);
  }

  /** Recupera una sesión anterior tras recargar la página, si sigue viva. */
  async _tryResume() {
    if (this._resuming) return;
    this._resuming = true;
    try {
      const room = await this.client.resumeSession();
      if (room) {
        this._showRoom(this.lastState);
        this._message('Sesión recuperada. Sigues en la misma sala.', 'good');
      }
    } finally {
      this._resuming = false;
    }
  }

  close() {
    if (this.client.room) {
      void this._leaveRoom();
      return;
    }
    this.hide();
    this.game.hud.screen('menu');
  }

  hide() {
    this.visible = false;
    this.dom.screen?.classList.add('hidden');
    if (this.game.state === 'menu') this.game.hud.screen('menu');
  }

  _showEntry() {
    this.dom.entry?.classList.remove('hidden');
    this.dom.roomsPanel?.classList.remove('hidden');
    this.dom.room?.classList.add('hidden');
    this._message('');
  }

  _showRoom(state) {
    this.dom.entry?.classList.add('hidden');
    this.dom.roomsPanel?.classList.add('hidden');
    this.dom.room?.classList.remove('hidden');
    if (state) this._renderState(state);
  }

  /* ------------------------------------------------------------- acciones */

  _readIdentity() {
    const name = this.dom.name?.value?.trim() || '';
    if (!name) {
      this._message('Escribe un nombre visible antes de continuar.', 'warn');
      this.dom.name?.focus();
      return false;
    }
    this.client.setIdentity({ name, appearance: this.client.appearance });
    return true;
  }

  async _createRoom() {
    if (!this._readIdentity()) return;
    this._busy(true);
    try {
      await this.client.createRoom({
        isPrivate: this.dom.privateRoom?.checked !== false,
        roomName: this.dom.roomName?.value?.trim() || '',
      });
      this._showRoom(this.lastState);
      this._message('Sala creada. Comparte el código con tu tripulación.', 'good');
    } catch (error) {
      this._message(this._friendly(error), 'bad');
    } finally {
      this._busy(false);
    }
  }

  async _joinRoom() {
    if (!this._readIdentity()) return;
    const code = this.dom.code?.value?.trim() || '';
    if (!code) {
      this._message('Introduce el código de invitación.', 'warn');
      return;
    }
    this._busy(true);
    try {
      await this.client.joinRoom(code);
      this._showRoom(this.lastState);
      this._message('Te has unido a la sala.', 'good');
    } catch (error) {
      this._message(this._friendly(error), 'bad');
    } finally {
      this._busy(false);
    }
  }

  async _joinPublic() {
    if (!this._readIdentity()) return;
    this._busy(true);
    try {
      await this.client.joinPublic();
      this._showRoom(this.lastState);
      this._message('Te has unido a una partida pública.', 'good');
    } catch (error) {
      this._message(this._friendly(error), 'bad');
    } finally {
      this._busy(false);
    }
  }

  async _leaveRoom() {
    await this.client.leave();
    this._showEntry();
    this._renderPlayers(new Map(), null);
    this.refreshRooms(false);
  }

  _toggleReady() {
    const me = this.client.players.get(this.client.sessionId);
    this.client.sendReady(!(me?.ready === true));
  }

  async _copyCode() {
    const code = this.client.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this._message(`Código ${code} copiado al portapapeles.`, 'good');
    } catch {
      this._message(`Código de invitación: ${code}`, '');
    }
  }

  async refreshRooms(manual = false) {
    if (!this.dom.rooms) return;
    const now = performance.now();
    if (!manual && now - this._lastRoomsFetch < 1500) return;
    this._lastRoomsFetch = now;
    this.dom.rooms.textContent = '';
    const loading = document.createElement('li');
    loading.className = 'mp-room-empty';
    loading.textContent = 'Buscando salas públicas…';
    this.dom.rooms.appendChild(loading);

    try {
      const rooms = await this.client.listPublicRooms();
      this.dom.rooms.textContent = '';
      if (!rooms.length) {
        const empty = document.createElement('li');
        empty.className = 'mp-room-empty';
        empty.textContent = 'No hay salas públicas abiertas. Crea una o usa un código.';
        this.dom.rooms.appendChild(empty);
        return;
      }
      for (const room of rooms) {
        this.dom.rooms.appendChild(this._roomRow(room));
      }
    } catch (error) {
      this.dom.rooms.textContent = '';
      const failed = document.createElement('li');
      failed.className = 'mp-room-empty';
      failed.textContent = `No se pudo consultar el servidor (${this.client.serverUrl}).`;
      this.dom.rooms.appendChild(failed);
      if (manual) this._message(this._friendly(error), 'bad');
    }
  }

  _roomRow(room) {
    const item = document.createElement('li');
    item.className = 'mp-room-row';

    const info = document.createElement('div');
    info.className = 'mp-room-info';
    const name = document.createElement('b');
    name.textContent = room.name || 'Sesión SPACE-TECH';
    const meta = document.createElement('span');
    meta.textContent = `${room.players}/${room.maxPlayers} jugadores · ${room.destination || 'station'} · ${room.phase || 'lobby'}`;
    info.append(name, meta);

    const join = document.createElement('button');
    join.type = 'button';
    join.className = 'btn ghost small';
    join.textContent = 'ENTRAR';
    join.addEventListener('click', async () => {
      if (!this._readIdentity()) return;
      join.disabled = true;
      try {
        await this.client.joinRoom(room.code);
        this._showRoom(this.lastState);
      } catch (error) {
        this._message(this._friendly(error), 'bad');
      } finally {
        join.disabled = false;
      }
    });

    item.append(info, join);
    return item;
  }

  /* -------------------------------------------------------------- render */

  _renderConnection(status, message = '') {
    const label = STATUS_LABELS[status] || STATUS_LABELS.idle;
    if (this.dom.connection) this.dom.connection.dataset.state = status || 'idle';
    if (this.dom.connectionLabel) this.dom.connectionLabel.textContent = label;
    if (this.dom.hud) {
      this.dom.hud.dataset.state = status || 'idle';
      this.dom.hud.classList.toggle('hidden', !this.game.multiplayerActive);
    }
    if (message) this._message(message, status === 'reconnecting' ? 'warn' : '');
  }

  _renderState(state) {
    if (!state) return;
    this.lastState = state;

    if (this.dom.roomCode) this.dom.roomCode.textContent = state.code || '------';
    if (this.dom.roomNameLabel) {
      this.dom.roomNameLabel.textContent =
        state.code && this.game.multiplayer ? `Sala ${state.code}` : 'Sesión';
    }
    if (this.dom.roomCapacity) {
      this.dom.roomCapacity.textContent = `${state.players.size} / ${state.maxClients || 4}`;
    }

    if (this.dom.hud) {
      this.dom.hud.classList.toggle('hidden', !this.game.multiplayerActive);
      if (this.dom.hudCode) this.dom.hudCode.textContent = state.code || '—';
      if (this.dom.hudPlayers) {
        this.dom.hudPlayers.textContent = `${state.players.size}/${state.maxClients || 4}`;
      }
    }

    this._renderPlayers(state.players, state);
    this._renderReadyButton(state);

    // Si la sesión ya está en exploración (p. ej. entrada tardía), entrar al mundo.
    if (state.phase === 'exploring' && !this.game.multiplayerActive && this.client.room) {
      this.game.enterMultiplayerWorld();
    }
  }

  _renderPlayers(players, state) {
    if (!this.dom.players) return;
    this.dom.players.textContent = '';

    for (const player of players.values()) {
      const item = document.createElement('li');
      item.className = 'mp-player';
      item.dataset.connected = player.connected ? 'true' : 'false';

      const dot = document.createElement('span');
      dot.className = 'mp-dot';
      dot.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'mp-player-name';
      name.textContent = player.name;
      if (player.id === state?.sessionId) name.textContent += ' (tú)';

      const badge = document.createElement('span');
      badge.className = 'mp-badge';
      badge.textContent = player.host ? 'Anfitrión' : player.connected ? 'En línea' : 'Reconectando';

      const status = document.createElement('span');
      status.className = 'mp-player-state';
      status.textContent = player.ready ? 'Preparado' : 'En espera';

      item.append(dot, name, badge, status);
      this.dom.players.appendChild(item);
    }

    if (!players.size) {
      const empty = document.createElement('li');
      empty.className = 'mp-room-empty';
      empty.textContent = 'Nadie en la sala todavía.';
      this.dom.players.appendChild(empty);
    }
  }

  _renderReadyButton(state) {
    const me = state?.players.get(state.sessionId);
    const ready = me?.ready === true;
    if (this.dom.ready) {
      this.dom.ready.textContent = ready ? 'CANCELAR PREPARACIÓN' : 'PREPARARSE';
      this.dom.ready.classList.toggle('is-ready', ready);
    }

    const guests = [...(state?.players.values() ?? [])].filter((player) => !player.host);
    const allReady = guests.length > 0 && guests.every((player) => player.ready);
    if (this.dom.start) {
      const canStart = state?.isHost && (allReady || guests.length === 0);
      this.dom.start.hidden = !state?.isHost;
      this.dom.start.disabled = !canStart;
    }
    if (this.dom.hint) {
      if (!state?.isHost) {
        this.dom.hint.textContent = 'Espera a que el anfitrión inicie la exploración.';
      } else if (guests.length === 0) {
        this.dom.hint.textContent = 'Comparte el código o inicia en solitario cuando quieras.';
      } else if (!allReady) {
        this.dom.hint.textContent = 'Todos los invitados deben prepararse antes de iniciar.';
      } else {
        this.dom.hint.textContent = 'Tripulación preparada. Puedes iniciar la exploración.';
      }
    }
  }

  _busy(busy) {
    for (const button of [this.dom.create, this.dom.join, this.dom.quick]) {
      if (button) button.disabled = busy;
    }
  }

  _message(text, level = '') {
    if (!this.dom.message) return;
    this.dom.message.textContent = text || '';
    this.dom.message.dataset.level = level || '';
  }

  _friendly(error) {
    const message = String(error?.message || error || 'Error desconocido');
    if (/ECONNREFUSED|Failed to fetch|NetworkError|fetch failed/i.test(message)) {
      return `No se pudo conectar con el servidor (${this.client.serverUrl}). Comprueba que esté en marcha.`;
    }
    if (/full|locked/i.test(message)) return 'La sala está completa. Pide otro código o crea una nueva.';
    if (/not found|invalid room/i.test(message)) return 'No existe ninguna sala con ese código.';
    return message;
  }
}
