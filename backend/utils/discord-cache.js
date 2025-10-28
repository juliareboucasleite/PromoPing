// Cache para evitar rate limiting do Discord
const discordCache = new Map();

// Cache por 5 minutos
const CACHE_DURATION = 5 * 60 * 1000;

export function getCachedDiscordUser(discordId) {
  const cached = discordCache.get(discordId);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(" Usando cache Discord para:", discordId);
    return cached.user;
  }
  
  return null;
}

export function setCachedDiscordUser(discordId, user) {
  discordCache.set(discordId, {
    user: user,
    timestamp: Date.now()
  });
  
  console.log(" Cache Discord salvo para:", discordId);
}

export function clearDiscordCache() {
  discordCache.clear();
  console.log(" Cache Discord limpo");
}

// Limpar cache a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of discordCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      discordCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
