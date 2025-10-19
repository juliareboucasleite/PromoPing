export default {

  clientId: "1417874318058328144",
  settings: {
    updateInterval: 30000,
    maxReconnectAttempts: 5,
    reconnectDelay: 5000,
    
    urls: {
      site: "http://localhost:3000",
      github: "https://github.com/juliareboucasleite"
    },

    texts: {
      details: "PromoPing - Monitor de Preços",
      state: "Servidor rodando localmente",
      largeImageText: "PromoPing - Sistema de Monitoramento",
      smallImageText: "Servidor Ativo"
    },

    // Configuração da logo
    images: {
      largeImageKey: "promoping-logo", // Nome da imagem no Discord Developer Portal
      smallImageKey: "server" // Imagem pequena (servidor)
    }
  }
};
