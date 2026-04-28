/**
 * PromoPing Blog API Routes
 * 
 * Endpoints para buscar artigos do blog
 */

import express from "express";
import { pool } from "../database/db.js";

const router = express.Router();

/**
 * Garante que a tabela blog_articles existe
 */
async function ensureBlogTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS blog_articles (
                Id SERIAL PRIMARY KEY,
                Title VARCHAR(500) NOT NULL,
                Description TEXT,
                Url VARCHAR(500) NOT NULL UNIQUE,
                ImageUrl VARCHAR(500) DEFAULT NULL,
                Source VARCHAR(200) DEFAULT NULL,
                Category VARCHAR(100) DEFAULT NULL,
                ImpactScore INTEGER DEFAULT 0,
                PublishedAt TIMESTAMP NOT NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                IsVisible SMALLINT DEFAULT 1,
                Views INTEGER DEFAULT 0
            )
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_articles (Category)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_impact_score ON blog_articles (ImpactScore)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_published_at ON blog_articles (PublishedAt)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_created_at ON blog_articles (CreatedAt)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_is_visible ON blog_articles (IsVisible)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_url ON blog_articles (Url)`);
    } catch (error) {
        console.error('[BLOG] Erro ao criar tabela blog_articles:', error);
    }
}

/**
 * GET /api/blog/articles
 * Busca artigos do blog com filtros opcionais
 * Query params: category, limit, offset, minScore
 */
router.get("/articles", async (req, res) => {
    try {
        // Garantir que a tabela existe
        await ensureBlogTable();
        
        const { category, limit = 20, offset = 0, minScore = 0, search = '' } = req.query;
        
        let query = `
            SELECT 
                Id,
                Title,
                Description,
                Url,
                ImageUrl,
                Source,
                Category,
                ImpactScore,
                PublishedAt,
                CreatedAt,
                Views
            FROM blog_articles
            WHERE IsVisible = 1
        `;
        
        const params = [];
        
        if (category && category !== 'all') {
            query += ` AND Category = ?`;
            params.push(category);
        }
        
        if (minScore) {
            query += ` AND ImpactScore >= ?`;
            params.push(parseInt(minScore));
        }
        
        // Busca por título ou descrição
        if (search && search.trim()) {
            query += ` AND (Title LIKE ? OR Description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }
        
        query += ` ORDER BY PublishedAt DESC, ImpactScore DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const [articles] = await pool.query(query, params);
        
        // Buscar total de artigos para paginação
        let countQuery = `SELECT COUNT(*) as total FROM blog_articles WHERE IsVisible = 1`;
        const countParams = [];
        
        if (category && category !== 'all') {
            countQuery += ` AND Category = ?`;
            countParams.push(category);
        }
        
        if (minScore) {
            countQuery += ` AND ImpactScore >= ?`;
            countParams.push(parseInt(minScore));
        }
        
        if (search && search.trim()) {
            countQuery += ` AND (Title LIKE ? OR Description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            countParams.push(searchTerm, searchTerm);
        }
        
        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        
        res.json({
            success: true,
            articles: articles.map(article => ({
                id: article.Id,
                title: article.Title,
                description: article.Description,
                url: article.Url,
                imageUrl: article.ImageUrl,
                source: article.Source,
                category: article.Category,
                impactScore: article.ImpactScore,
                publishedAt: article.PublishedAt,
                createdAt: article.CreatedAt,
                views: article.Views || 0
            })),
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < total
            }
        });
    } catch (error) {
        console.error('[BLOG] Erro ao buscar artigos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar artigos do blog'
        });
    }
});

/**
 * GET /api/blog/articles/:id
 * Busca um artigo específico por ID
 */
router.get("/articles/:id", async (req, res) => {
    try {
        // Garantir que a tabela existe
        await ensureBlogTable();
        
        const { id } = req.params;
        
        const [articles] = await pool.query(
            `SELECT 
                Id,
                Title,
                Description,
                Url,
                ImageUrl,
                Source,
                Category,
                ImpactScore,
                PublishedAt,
                CreatedAt,
                Views
            FROM blog_articles
            WHERE Id = ? AND IsVisible = 1`,
            [id]
        );
        
        if (articles.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Artigo não encontrado'
            });
        }
        
        // Incrementar visualizações
        await pool.query(
            `UPDATE blog_articles SET Views = Views + 1 WHERE Id = ?`,
            [id]
        );
        
        res.json({
            success: true,
            article: {
                id: articles[0].Id,
                title: articles[0].Title,
                description: articles[0].Description,
                url: articles[0].Url,
                imageUrl: articles[0].ImageUrl,
                source: articles[0].Source,
                category: articles[0].Category,
                impactScore: articles[0].ImpactScore,
                publishedAt: articles[0].PublishedAt,
                createdAt: articles[0].CreatedAt,
                views: (articles[0].Views || 0) + 1
            }
        });
    } catch (error) {
        console.error('[BLOG] Erro ao buscar artigo:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar artigo'
        });
    }
});

/**
 * GET /api/blog/categories
 * Lista todas as categorias disponíveis
 */
router.get("/categories", async (req, res) => {
    try {
        // Garantir que a tabela existe
        await ensureBlogTable();
        
        const [categories] = await pool.query(
            `SELECT 
                Category,
                COUNT(*) as count
            FROM blog_articles
            WHERE IsVisible = 1
            GROUP BY Category
            ORDER BY count DESC, Category ASC`
        );
        
        res.json({
            success: true,
            categories: categories.map(cat => ({
                name: cat.Category,
                count: cat.count
            }))
        });
    } catch (error) {
        console.error('[BLOG] Erro ao buscar categorias:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar categorias'
        });
    }
});

export default router;
