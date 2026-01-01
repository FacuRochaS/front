// Nuevo script.js para el flujo solicitado
const API = window.location.origin.includes('localhost') ? 'http://localhost:8080/api' : window.location.origin + '/api';
let playerId = null;
let playerName = null;
let lobbyId = null;
let hostToken = null;
let isHost = false;
let roundInterval = null;

// Utilidades para localStorage
function savePlayerId(id) {
  localStorage.setItem('impostor_player_id', id);
}
function getSavedPlayerId() {
  return localStorage.getItem('impostor_player_id');
}
function savePlayerName(name) {
  localStorage.setItem('impostor_player_name', name);
}
function getSavedPlayerName() {
  return localStorage.getItem('impostor_player_name');
}

// Navegación principal
window.onload = () => {
  showMainMenu();
  document.getElementById('play-btn').onclick = showPlayNameStep;
  document.getElementById('add-word-btn').onclick = showAddWordSection;
  document.getElementById('playerNameNext').onclick = handlePlayerNameNext;
  document.getElementById('create-lobby-btn').onclick = showCreateLobbyStep;
  document.getElementById('createLobbyConfirm').onclick = handleCreateLobby;
  document.getElementById('addCategoryBtn').onclick = handleAddCategory;
  document.getElementById('addWordBtn').onclick = handleAddWord;
  document.getElementById('startGameBtn').onclick = handleStartGame;
  document.getElementById('newRoundBtn').onclick = handleNewRound;
  document.getElementById('back-to-menu-play').onclick = showMainMenu;
  document.getElementById('back-to-menu-add').onclick = showMainMenu;
  document.getElementById('back-to-name').onclick = showPlayNameStep;
  document.getElementById('back-to-lobbies').onclick = showLobbiesStep;
  document.getElementById('back-to-lobbies-wait').onclick = showLobbiesStep;
  document.getElementById('back-to-lobby-round').onclick = showLobbyWaitFromRound;
  loadCategorySelect();
};

function showMainMenu() {
  hideAll();
  document.getElementById('main-menu').style.display = '';
}
function showPlayNameStep() {
  hideAll();
  document.getElementById('play-section').style.display = '';
  document.getElementById('play-step-name').style.display = '';
  document.getElementById('back-to-menu-play').style.display = '';
  document.getElementById('playerNameInput').value = getSavedPlayerName() || '';
}
function showLobbiesStep() {
  hideAll();
  document.getElementById('play-section').style.display = '';
  document.getElementById('play-step-lobbies').style.display = '';
  document.getElementById('back-to-name').style.display = '';
  loadLobbies();
}
function showCreateLobbyStep() {
  hideAll();
  document.getElementById('play-section').style.display = '';
  document.getElementById('play-step-create-lobby').style.display = '';
  document.getElementById('back-to-lobbies').style.display = '';
  loadCategories();
}
function showLobbyWaitStep(host, players, isHostFlag) {
  hideAll(false); // No limpiar el polling aquí
  document.getElementById('play-section').style.display = '';
  document.getElementById('play-step-lobby-wait').style.display = '';
  document.getElementById('back-to-lobbies-wait').style.display = '';
  document.getElementById('lobbyHostName').textContent = host;
  renderPlayers(players);
  document.getElementById('startGameBtn').style.display = isHostFlag ? '' : 'none';
  if (!roundInterval) pollLobbyState();
}
function showRoundStep(secret, isHostFlag) {
  hideAll(false); // No limpiar el polling aquí
  document.getElementById('play-section').style.display = '';
  document.getElementById('play-step-round').style.display = '';
  document.getElementById('back-to-lobby-round').style.display = '';
  document.getElementById('secret-word').textContent = secret;
  document.getElementById('newRoundBtn').style.display = isHostFlag ? '' : 'none';
  if (!roundInterval) pollLobbyState();
}
function showAddWordSection() {
  hideAll();
  document.getElementById('add-word-section').style.display = '';
  document.getElementById('back-to-menu-add').style.display = '';
  loadCategorySelect();
}
function hideAll(stopPolling = true) {
  document.querySelectorAll('.card').forEach(e => e.style.display = 'none');
  document.querySelectorAll('#play-section > div').forEach(e => e.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(e => e.style.display = 'none');
  if (stopPolling && roundInterval) {
    clearInterval(roundInterval);
    roundInterval = null;
  }
  const playMsg = document.getElementById('play-message');
  if (playMsg) playMsg.textContent = '';
  const addWordMsg = document.getElementById('add-word-message');
  if (addWordMsg) addWordMsg.textContent = '';
}

// --- JUGAR ---
function handlePlayerNameNext() {
  playerName = document.getElementById('playerNameInput').value.trim();
  if (!playerName) {
    showPlayMessage('Escribe tu nombre');
    return;
  }
  savePlayerName(playerName);
  showLobbiesStep();
}
function showPlayMessage(msg) {
  document.getElementById('play-message').textContent = msg;
}
function showAddWordMessage(msg) {
  document.getElementById('add-word-message').textContent = msg;
}
async function loadLobbies() {
  // Suponiendo endpoint GET /api/lobby/list
  const res = await fetch(`${API}/lobby/list`);
  const lobbies = await res.json();
  const list = document.getElementById('lobby-list');
  list.innerHTML = '';
  lobbies.forEach(lobby => {
    const div = document.createElement('div');
    div.className = 'lobby-item';
    div.innerHTML = `${lobby.hostName} <span style='color:#aaa;font-size:0.9em'>(ID: ${lobby.id})</span>`;
    div.onclick = () => joinLobby(lobby.id);
    list.appendChild(div);
  });
}
async function joinLobby(lobbyIdToJoin) {
  const res = await fetch(`${API}/lobby/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, lobbyId: lobbyIdToJoin })
  });
  const data = await res.json();
  playerId = data.playerId;
  lobbyId = lobbyIdToJoin;
  isHost = false;
  savePlayerId(playerId);
  pollLobbyState();
}
async function handleCreateLobby() {
  const impostorCount = parseInt(document.getElementById('impostorCount').value);
  const checked = Array.from(document.querySelectorAll('#category-list input:checked')).map(e => parseInt(e.value));
  if (checked.length === 0) {
    showPlayMessage('Selecciona al menos una categoría');
    return;
  }
  const res = await fetch(`${API}/lobby/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName: playerName, impostorCount, categories: checked })
  });
  const data = await res.json();
  playerId = data.playerId;
  hostToken = data.hostToken;
  lobbyId = data.lobbyId;
  isHost = true;
  savePlayerId(playerId);
  pollLobbyState();
}
function pollLobbyState() {
  if (roundInterval) clearInterval(roundInterval);
  fetchLobbyState();
  roundInterval = setInterval(fetchLobbyState, 3000);
}
async function fetchLobbyState() {
  // Suponiendo endpoint GET /api/lobby/state?lobbyId=xxx
  const res = await fetch(`${API}/lobby/state?lobbyId=${lobbyId}`);
  const state = await res.json();
  // Si no hay ronda activa, mostrar la pantalla de espera de lobby y seguir haciendo polling
  if (!state.currentRound) {
    showLobbyWaitStep(state.hostName, state.players, isHost);
    // El polling sigue activo aquí
  } else {
    fetchSecretWord();
    // El polling sigue activo en la ronda
  }
}
function renderPlayers(players) {
  const list = document.getElementById('players-list');
  // Muestra el nombre del jugador y el ID de la partida (lobbyId)
  list.innerHTML = `<b>Jugadores (ID de sala: ${lobbyId}):</b><br>` + players.map(p => `${p.name}`).join('<br>');
}
async function handleStartGame() {
  await fetch(`${API}/lobby/round/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Host-Token': hostToken
    },
    body: JSON.stringify({ lobbyId })
  });
  fetchLobbyState();
}
async function fetchSecretWord() {
  // Suponiendo endpoint GET /api/lobby/me/{playerId}?lobbyId=xxx
  const res = await fetch(`${API}/lobby/me/${playerId}?lobbyId=${lobbyId}`);
  const data = await res.json();
  showRoundStep(data.secret, isHost);
}
async function handleNewRound() {
  await fetch(`${API}/lobby/round/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Host-Token': hostToken
    },
    body: JSON.stringify({ lobbyId })
  });
  fetchLobbyState();
}

// --- AGREGAR PALABRAS ---
async function loadCategorySelect() {
  const res = await fetch(`${API}/categories`);
  const categories = await res.json();
  const select = document.getElementById('categorySelect');
  select.innerHTML = '';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
}
async function loadCategories() {
  const res = await fetch(`${API}/categories`);
  const categories = await res.json();
  const list = document.getElementById('category-list');
  list.innerHTML = '';
  categories.forEach(cat => {
    const label = document.createElement('label');
    label.className = 'category-checkbox';
    label.innerHTML = `<input type='checkbox' value='${cat.id}'>${cat.name}`;
    list.appendChild(label);
  });
}
async function handleAddCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  if (!name) {
    showAddWordMessage('Escribe un nombre de categoría');
    return;
  }
  await fetch(`${API}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  document.getElementById('newCategoryName').value = '';
  showAddWordMessage('¡Categoría creada!');
  loadCategorySelect();
}
async function handleAddWord() {
  const text = document.getElementById('newWord').value.trim();
  const categoryId = document.getElementById('categorySelect').value;
  if (!text) {
    showAddWordMessage('Escribe una palabra');
    return;
  }
  await fetch(`${API}/categories/${categoryId}/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  document.getElementById('newWord').value = '';
  showAddWordMessage('¡Palabra agregada!');
}

// Corrige el error de función faltante y el flujo de volver desde la ronda
function showLobbyWaitFromRound() {
  // Fuerza la pantalla de espera de lobby y mantiene el polling activo
  hideAll(false); // No limpiar el polling
  document.getElementById('play-section').style.display = '';
  document.getElementById('play-step-lobby-wait').style.display = '';
  document.getElementById('back-to-lobbies-wait').style.display = '';
  // Pedimos el estado de la lobby y mostramos la lista de jugadores
  fetch(`${API}/lobby/state?lobbyId=${lobbyId}`)
    .then(res => res.json())
    .then(state => {
      document.getElementById('lobbyHostName').textContent = state.hostName;
      renderPlayers(state.players);
      document.getElementById('startGameBtn').style.display = isHost ? '' : 'none';
    });
  if (!roundInterval) pollLobbyState();
}
