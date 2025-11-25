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

// Função para obter instância do bot Discord (se disponível)
async function getDiscordBot() {
    try {
        // A instância do bot é armazenada globalmente quando iniciado
        const bot = global.discordBotInstance;
        if (!bot) {
            console.error('[GITHUB WEBHOOK] Bot não encontrado em global.discordBotInstance');
            return null;
        }
        if (!bot.client) {
            console.error('[GITHUB WEBHOOK] Bot encontrado mas client não disponível');
            return null;
        }
        if (!bot.client.isReady()) {
            console.error('[GITHUB WEBHOOK] Bot encontrado mas não está pronto (ready)');
            return null;
        }
        return bot;
    } catch (error) {
        console.error('[GITHUB WEBHOOK] Erro ao obter instância do bot:', error);
        return null;
    }
}

// Endpoint de teste para verificar se o webhook está funcionando
router.get("/api/webhooks/github/test", async (req, res) => {
    try {
        const bot = await getDiscordBot();
        const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';
        
        if (!bot || !bot.client) {
            return res.status(500).json({ 
                error: 'Bot Discord não disponível',
                botAvailable: false,
                channelId: ANNOUNCEMENTS_CHANNEL_ID
            });
        }
        
        const channel = await bot.client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID).catch(() => null);
        
        return res.json({
            status: 'ok',
            botAvailable: true,
            botReady: bot.client.isReady(),
            channelFound: !!channel,
            channelName: channel?.name || 'Não encontrado',
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
        console.log('[GITHUB WEBHOOK TEST] Teste manual recebido');
        
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

// ================== WEBHOOK: RECEBER EVENTOS DE RELEASE DO GITHUB ==================
router.post("/api/webhooks/github", rawBodyMiddleware, async (req, res) => {
  try {
    console.log('[GITHUB WEBHOOK] ========== WEBHOOK RECEBIDO ==========');
    console.log('[GITHUB WEBHOOK] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[GITHUB WEBHOOK] Body length:', req.body?.length || 0);
    
    const event = req.headers['x-github-event'];
    console.log(`[GITHUB WEBHOOK] Evento recebido: ${event || 'NENHUM'}`);
    
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
      console.log('[GITHUB WEBHOOK] Assinatura verificada com sucesso');
    } else {
      console.log('[GITHUB WEBHOOK] GITHUB_WEBHOOK_SECRET não configurado, pulando verificação de assinatura');
    }
    
    // Processar apenas eventos de release
    if (event !== 'release') {
      console.log(`[GITHUB WEBHOOK] Evento ignorado: ${event}`);
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
    console.log(`[GITHUB WEBHOOK] Ação da release: ${action}`);

    // Processar apenas releases publicados
    if (action !== 'published' && action !== 'released') {
      console.log(`[GITHUB WEBHOOK] Release não publicado ainda (ação: ${action})`);
      return res.status(200).json({ message: 'Release não publicado ainda', action });
    }
    
    console.log(`[GITHUB WEBHOOK] Processando release publicada: ${releaseData.repository?.full_name} ${releaseData.release?.tag_name}`);

    const release = releaseData.release;
    const repository = releaseData.repository;

    // ID do canal announcements
    const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';

    // Obter instância do bot Discord
    console.log('[GITHUB WEBHOOK] Tentando obter instância do bot Discord...');
    const bot = await getDiscordBot();
    if (!bot || !bot.client) {
      console.error('[GITHUB WEBHOOK] Bot Discord não disponível - verifique se o bot está rodando');
      return res.status(500).json({ error: 'Bot Discord não disponível' });
    }
    console.log('[GITHUB WEBHOOK] Bot Discord encontrado');

    console.log(`[GITHUB WEBHOOK] Buscando canal ${ANNOUNCEMENTS_CHANNEL_ID}...`);
    const channel = await bot.client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID).catch(err => {
      console.error(`[GITHUB WEBHOOK] Erro ao buscar canal: ${err.message}`);
      return null;
    });
    
    if (!channel) {
      console.error('[GITHUB WEBHOOK] Canal announcements não encontrado');
      return res.status(500).json({ error: 'Canal não encontrado' });
    }
    console.log(`[GITHUB WEBHOOK] Canal encontrado: ${channel.name}`);

    // Criar embed de notificação
    const embed = new EmbedBuilder()
      .setTitle('🚀 Nova Release')
      .setDescription(`**${release.tag_name}** foi lançada!`)
      .addFields(
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
      )
      .setColor(0x24292e)
      .setTimestamp(new Date(release.published_at))
      .setFooter({ text: 'PromoPing - GitHub Releases' });

    // Adicionar thumbnail do repositório
    if (repository.owner?.avatar_url) {
      embed.setThumbnail(repository.owner.avatar_url);
    }

    // Adicionar notas da release (se houver)
    if (release.body) {
      const bodyText = release.body.length > 1024 
        ? release.body.substring(0, 1021) + '...' 
        : release.body;
      embed.addFields({
        name: 'Notas da Release',
        value: bodyText,
        inline: false
      });
    }

    // Adicionar link para a release
    embed.addFields({
      name: 'Links',
      value: `[Ver Release](${release.html_url}) | [Download](${release.assets[0]?.browser_download_url || release.html_url})`,
      inline: false
    });

    // Enviar notificação
    await channel.send({ embeds: [embed] });

    console.log(`[GITHUB WEBHOOK] Notificação de release enviada: ${repository.full_name} ${release.tag_name}`);

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

