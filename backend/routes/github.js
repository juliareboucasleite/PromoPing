// github.js - Rotas para acessar a API do GitHub (para repositórios privados)

import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import mysql from "mysql2/promise";
import { EmbedBuilder } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const router = express.Router();

// Função para enviar mensagem via bot Discord (usando servidor interno)
async function sendDiscordMessage(channelId, embed) {
    try {
        // Tentar usar instância global primeiro (se no mesmo processo)
        const bot = global.discordBotInstance;
        if (bot && bot.client && bot.client.isReady()) {
            const channel = await bot.client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                await channel.send({ embeds: [embed] });
                return true;
            }
        }
        
        // Se não estiver no mesmo processo, usar servidor HTTP interno do bot
        const response = await fetch('http://127.0.0.1:3001/internal/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, embed })
        });
        
        if (!response.ok) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[GITHUB WEBHOOK] Erro ao enviar mensagem:', error.message);
        return false;
    }
}

// Função para verificar se o bot está disponível
async function checkBotStatus() {
    try {
        // Tentar instância global primeiro
        const bot = global.discordBotInstance;
        if (bot && bot.client && bot.client.isReady()) {
            return { available: true, ready: true };
        }
        
        // Tentar servidor HTTP interno
        const response = await fetch('http://127.0.0.1:3001/internal/status', {
            method: 'GET',
            timeout: 2000
        }).catch(() => null);
        
        if (response && response.ok) {
            return await response.json();
        }
        
        return { available: false, ready: false };
    } catch (error) {
        return { available: false, ready: false };
    }
}

// Endpoint de teste para verificar se o webhook está funcionando
router.get("/api/webhooks/github/test", async (req, res) => {
    try {
        const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';
        const botStatus = await checkBotStatus();
        
        if (!botStatus.available || !botStatus.ready) {
            return res.status(500).json({ 
                error: 'Bot Discord não disponível',
                botAvailable: false,
                botReady: false,
                channelId: ANNOUNCEMENTS_CHANNEL_ID,
                tip: 'Verifique se o bot Discord está rodando'
            });
        }
        
        // Testar envio de mensagem
        const testEmbed = {
            title: '✅ Teste de Webhook GitHub',
            description: 'Esta é uma notificação de teste do webhook do GitHub.',
            color: 0x00ff00,
            timestamp: new Date().toISOString()
        };
        
        const sent = await sendDiscordMessage(ANNOUNCEMENTS_CHANNEL_ID, testEmbed);
        
        return res.json({
            status: 'ok',
            botAvailable: true,
            botReady: true,
            messageSent: sent,
            channelId: ANNOUNCEMENTS_CHANNEL_ID,
            message: 'Webhook está configurado. Use este endpoint para testar: POST /api/webhooks/github',
            webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/github`
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Erro ao verificar webhook',
            message: error.message
        });
    }
});

// Endpoint para simular webhook do GitHub (para testes locais)
router.post("/api/webhooks/github/test", express.json(), async (req, res) => {
    try {
        
        // Simular payload de release do GitHub
        const testPayload = {
            action: 'published',
            release: {
                tag_name: 'v2.5.0',
                name: 'Test Release',
                body: 'Esta é uma release de teste',
                published_at: new Date().toISOString(),
                html_url: 'https://github.com/juliareboucasleite/PromoPing/releases/tag/v2.5.0',
                author: {
                    login: 'juliareboucasleite'
                },
                assets: []
            },
            repository: {
                full_name: 'juliareboucasleite/PromoPing',
                html_url: 'https://github.com/juliareboucasleite/PromoPing',
                owner: {
                    login: 'juliareboucasleite',
                    avatar_url: 'https://avatars.githubusercontent.com/u/69313019?v=4'
                }
            }
        };

        // Processar como se fosse um webhook real
        req.headers['x-github-event'] = 'release';
        req.body = Buffer.from(JSON.stringify(testPayload));
        
        // Chamar o handler do webhook
        const originalUrl = req.url;
        req.url = '/api/webhooks/github';
        
        // Usar o mesmo handler
        return await router.handle(req, res);
        
    } catch (error) {
        console.error('[GITHUB WEBHOOK TEST] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao processar teste',
            message: error.message
        });
    }
});

// ================== ROTA: OBTER RELEASES DO GITHUB ==================
router.get("/api/github/releases", async (req, res) => {
  try {
    const owner = req.query.owner || "juliareboucasleite";
    const repo = req.query.repo || "PromoPing";
    const maxReleases = parseInt(req.query.limit) || 20;

    // URL da API do GitHub
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;

    // Headers para a requisição
    const headers = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "PromoPing-Backend"
    };

    // Se houver token do GitHub configurado, usar para autenticação
    // GitHub aceita tanto "token" quanto "Bearer", mas "Bearer" é o formato recomendado
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // Fazer requisição ao GitHub
    const response = await fetch(githubApiUrl, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          status: "error",
          error: "Repositório não encontrado ou sem releases",
          message: `O repositório ${owner}/${repo} não foi encontrado ou não possui releases`,
          suggestion: "Verifique se o repositório existe e se há releases criados no GitHub"
        });
      }

      const errorText = await response.text();
      return res.status(response.status).json({
        status: "error",
        error: "Erro ao buscar releases do GitHub",
        message: `GitHub API retornou status ${response.status}: ${errorText}`,
        statusCode: response.status
      });
    }

    const releases = await response.json();

    // Se não houver releases ou estiver vazio
    if (!releases || releases.length === 0) {
      return res.json({
        status: "ok",
        releases: [],
        total: 0,
        message: "Nenhum release encontrado no repositório"
      });
    }

    // Limitar número de releases
    const recentReleases = releases.slice(0, maxReleases);

    // Retornar releases formatados
    res.json({
      status: "ok",
      releases: recentReleases,
      total: releases.length,
      showing: recentReleases.length,
      repository: `${owner}/${repo}`
    });

  } catch (err) {
    console.error("Erro ao buscar releases do GitHub:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao buscar releases do GitHub",
      message: err.message
    });
  }
});

// ================== ROTA: VERIFICAR DISPONIBILIDADE DO REPOSITÓRIO ==================
router.get("/api/github/check", async (req, res) => {
  try {
    const owner = req.query.owner || "juliareboucasleite";
    const repo = req.query.repo || "PromoPing";

    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const headers = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "PromoPing-Backend"
    };

    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(githubApiUrl, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      return res.status(response.status).json({
        status: "error",
        exists: false,
        accessible: false,
        message: `Repositório ${owner}/${repo} não encontrado ou inacessível`
      });
    }

    const repoData = await response.json();

    res.json({
      status: "ok",
      exists: true,
      accessible: true,
      repository: `${owner}/${repo}`,
      isPrivate: repoData.private || false,
      hasReleases: repoData.has_releases || false
    });

  } catch (err) {
    console.error("Erro ao verificar repositório:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao verificar repositório",
      message: err.message
    });
  }
});

// Middleware para capturar body raw para verificação de assinatura
const rawBodyMiddleware = express.raw({ type: 'application/json' });

// Cache de releases já processadas (para evitar envios duplicados)
// Formato: releaseId -> timestamp
const processedReleases = new Map();

// Limpar cache antigo a cada hora (releases com mais de 24h)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 horas
  for (const [releaseId, timestamp] of processedReleases.entries()) {
    if (now - timestamp > maxAge) {
      processedReleases.delete(releaseId);
    }
  }
}, 60 * 60 * 1000); // Executar a cada hora

// ================== WEBHOOK: RECEBER EVENTOS DE RELEASE DO GITHUB ==================
router.post("/api/webhooks/github", rawBodyMiddleware, async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    
    // Verificar assinatura do webhook (se configurado)
    const githubSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (githubSecret) {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) {
        console.error('[GITHUB WEBHOOK] Assinatura não fornecida');
        return res.status(401).json({ error: 'Assinatura não fornecida' });
      }

      const hmac = crypto.createHmac('sha256', githubSecret);
      const digest = 'sha256=' + hmac.update(req.body).digest('hex');
      
      if (signature !== digest) {
        console.error('[GITHUB WEBHOOK] Assinatura inválida');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }
    
    // Processar apenas eventos de release
    if (event !== 'release') {
      return res.status(200).json({ message: 'Evento ignorado', event });
    }

    // Parse do body JSON
    let releaseData;
    try {
      releaseData = JSON.parse(req.body.toString());
    } catch (error) {
      return res.status(400).json({ error: 'Body inválido' });
    }
    const action = releaseData.action; // published, created, edited, deleted, prereleased, released

    // Processar apenas releases publicados
    if (action !== 'published' && action !== 'released') {
      return res.status(200).json({ message: 'Release não publicado ainda', action });
    }
    
    const release = releaseData.release;
    const repository = releaseData.repository;

    // Criar ID único para a release (tag + published_at)
    const releaseId = `${repository.full_name}:${release.tag_name}:${release.published_at}`;
    
    // Verificar se já processamos esta release
    if (processedReleases.has(releaseId)) {
      return res.status(200).json({ 
        status: 'ok', 
        message: 'Release já processada',
        repository: repository.full_name,
        tag: release.tag_name
      });
    }

    // Marcar como processada ANTES de enviar (para evitar duplicatas se houver retry)
    processedReleases.set(releaseId, Date.now());

    // ID do canal announcements
    const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';

    // Verificar se o bot está disponível
    const botStatus = await checkBotStatus();
    if (!botStatus.available || !botStatus.ready) {
      console.error('[GITHUB WEBHOOK] Bot Discord não disponível');
      // Remover do cache se falhar para permitir retry
      processedReleases.delete(releaseId);
      return res.status(500).json({ error: 'Bot Discord não disponível' });
    }

    // Criar embed de notificação (formato JSON para envio via HTTP)
    const embedData = {
      title: '🚀 Nova Release',
      description: `**${release.tag_name}** foi lançada!`,
      url: release.html_url,
      color: 0x24292e,
      timestamp: new Date(release.published_at).toISOString(),
      footer: { text: 'PromoPing - GitHub Releases' },
      fields: [
        { 
          name: 'Repositório', 
          value: `[${repository.full_name}](${repository.html_url})`, 
          inline: true 
        },
        { 
          name: 'Tag', 
          value: release.tag_name, 
          inline: true 
        },
        { 
          name: 'Autor', 
          value: release.author?.login || 'Desconhecido', 
          inline: true 
        }
      ]
    };

    // Adicionar thumbnail do repositório
    if (repository.owner?.avatar_url) {
      embedData.thumbnail = { url: repository.owner.avatar_url };
    }

    // Adicionar notas da release (se houver)
    if (release.body) {
      const bodyText = release.body.length > 1024 
        ? release.body.substring(0, 1021) + '...' 
        : release.body;
      embedData.fields.push({
        name: 'Notas da Release',
        value: bodyText,
        inline: false
      });
    }

    // Adicionar link para a release
    embedData.fields.push({
      name: 'Links',
      value: `[Ver Release](${release.html_url}) | [Download](${release.assets[0]?.browser_download_url || release.html_url})`,
      inline: false
    });

    // Enviar mensagem via função helper
    const sent = await sendDiscordMessage(ANNOUNCEMENTS_CHANNEL_ID, embedData);
    if (!sent) {
      console.error('[GITHUB WEBHOOK] Falha ao enviar mensagem para o Discord');
      // Remover do cache se falhar para permitir retry
      processedReleases.delete(releaseId);
      return res.status(500).json({ error: 'Falha ao enviar notificação' });
    }
    
    console.log(`[GITHUB WEBHOOK] Notificação enviada: ${repository.full_name} ${release.tag_name}`);

    res.status(200).json({ 
      status: 'ok', 
      message: 'Notificação enviada',
      repository: repository.full_name,
      tag: release.tag_name
    });

  } catch (err) {
    console.error("Erro ao processar webhook do GitHub:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao processar webhook",
      message: err.message
    });
  }
});

export default router;

