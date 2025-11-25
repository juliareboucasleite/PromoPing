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
        return global.discordBotInstance || null;
    } catch (error) {
        console.error('[GITHUB WEBHOOK] Erro ao obter instância do bot:', error);
        return null;
    }
}

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
    // Verificar assinatura do webhook (se configurado)
    const githubSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (githubSecret) {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) {
        return res.status(401).json({ error: 'Assinatura não fornecida' });
      }

      const hmac = crypto.createHmac('sha256', githubSecret);
      const digest = 'sha256=' + hmac.update(req.body).digest('hex');
      
      if (signature !== digest) {
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }

    const event = req.headers['x-github-event'];
    
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

    // ID do canal announcements
    const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';

    // Obter instância do bot Discord
    const bot = await getDiscordBot();
    if (!bot || !bot.client) {
      console.error('[GITHUB WEBHOOK] Bot Discord não disponível');
      return res.status(500).json({ error: 'Bot Discord não disponível' });
    }

    const channel = await bot.client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID);
    if (!channel) {
      console.error('[GITHUB WEBHOOK] Canal announcements não encontrado');
      return res.status(500).json({ error: 'Canal não encontrado' });
    }

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

