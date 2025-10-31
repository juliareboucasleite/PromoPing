// github.js - Rotas para acessar a API do GitHub (para repositórios privados)

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

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

export default router;

