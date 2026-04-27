import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../data/discord-users.json');
const DATA_DIR = path.dirname(DATA_FILE);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Carregar dados do JSON
function loadDiscordUsers() {
  try {
    ensureDataDir();
    if (!fs.existsSync(DATA_FILE)) {
      // Criar arquivo se não existir
      const initialData = { users: [] };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(' Erro ao carregar usuários Discord:', error);
    return { users: [] };
  }
}

// Salvar dados no JSON
function saveDiscordUsers(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(' Erro ao salvar usuários Discord:', error);
    return false;
  }
}

// Buscar usuário Discord por ID
export function findDiscordUser(discordId) {
  const data = loadDiscordUsers();
  return data.users.find(user => user.discordId === discordId);
}

// Buscar usuário Discord por email
export function findDiscordUserByEmail(email) {
  const data = loadDiscordUsers();
  return data.users.find(user => user.email === email);
}

// Registrar novo usuário Discord
export function registerDiscordUser(discordData) {
  const data = loadDiscordUsers();
  
  // Verificar se já existe
  const existingUser = findDiscordUser(discordData.id);
  if (existingUser) {
    console.log(' Usuário Discord já existe:', existingUser.username);
    return existingUser;
  }
  
  // Criar novo usuário
  const newUser = {
    discordId: discordData.id,
    username: discordData.username,
    email: discordData.email,
    avatar: discordData.avatar,
    registeredAt: new Date().toISOString(),
    ReferenciaID: null // Será preenchido quando associar com usuário do banco
  };
  
  data.users.push(newUser);
  
  if (saveDiscordUsers(data)) {
    console.log(' Novo usuário Discord registrado:', newUser.username);
    return newUser;
  } else {
    console.error(' Erro ao registrar usuário Discord');
    return null;
  }
}

// Associar usuário Discord com usuário do banco
export function linkDiscordUser(discordId, ReferenciaID) {
  const data = loadDiscordUsers();
  const user = data.users.find(u => u.discordId === discordId);
  
  if (user) {
    user.ReferenciaID = ReferenciaID;
    user.linkedAt = new Date().toISOString();
    
    if (saveDiscordUsers(data)) {
      console.log(' Usuário Discord associado com ReferenciaID:', ReferenciaID);
      return true;
    }
  }
  
  return false;
}

// Listar todos os usuários Discord
export function getAllDiscordUsers() {
  return loadDiscordUsers().users;
}

// Remover usuário Discord
export function removeDiscordUser(discordId) {
  const data = loadDiscordUsers();
  const initialLength = data.users.length;
  
  data.users = data.users.filter(user => user.discordId !== discordId);
  
  if (data.users.length < initialLength) {
    if (saveDiscordUsers(data)) {
      console.log(' Usuário Discord removido:', discordId);
      return true;
    }
  }
  
  return false;
}
