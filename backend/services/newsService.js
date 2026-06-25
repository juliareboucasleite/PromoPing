import { pool } from '../database/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Serviço para buscar e filtrar notícias impactantes sobre categorias monitoradas
 */
class NewsService {
    constructor() {
        // Categorias e palavras-chave relacionadas às lojas monitoradas
        this.monitoredCategories = {
            'Tecnologia': ['tecnologia', 'tech', 'smartphone', 'tablet', 'laptop', 'computador', 'iphone', 'samsung', 'xiaomi', 'huawei', 'apple', 'microsoft', 'nvidia', 'amd', 'intel'],
            'Eletrônicos': ['eletrônicos', 'eletronicos', 'tv', 'televisão', 'televisao', 'som', 'audio', 'fones', 'headphones', 'speaker', 'caixa de som'],
            'Casa e Jardim': ['casa', 'jardim', 'móveis', 'moveis', 'decoração', 'decoracao', 'cozinha', 'banheiro', 'sala', 'quarto', 'sofá', 'sofa', 'mesa', 'cadeira'],
            'Moda': ['moda', 'roupa', 'vestuário', 'vestuario', 'calçado', 'calcado', 'sapatos', 'tênis', 'tenis', 'camiseta', 'calça', 'calca', 'vestido'],
            'Desporto': ['desporto', 'esporte', 'fitness', 'ginásio', 'ginasio', 'corrida', 'ciclismo', 'natação', 'natacao', 'futebol', 'basquete'],
            'Alimentação': ['alimentação', 'alimentacao', 'supermercado', 'comida', 'bebida', 'grocery', 'supermercado'],
            'Retalho': ['retalho', 'varejo', 'loja', 'promoção', 'promocao', 'desconto', 'black friday', 'cyber monday', 'saldos']
        };

        // Lojas monitoradas
        this.monitoredStores = [
            'Worten', 'FNAC', 'MediaMarkt', 'PCDiga', 'GlobalData', 'Rádio Popular',
            'Amazon', 'IKEA', 'Leroy Merlin', 'Continente', 'Pingo Doce', 'Auchan',
            'Zara', 'H&M', 'Decathlon', 'Sport Zone', 'Foot Locker'
        ];
        this.newsApiUnavailableLoggedAt = 0;
    }

    async fetchJsonWithTimeout(url, timeoutMs = 30000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Calcula o score de impacto de uma notícia (1-10)
     * Baseado em palavras-chave, relevância e recência
     */
    calculateImpactScore(article, category) {
        let score = 0;
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const content = title + ' ' + description;

        // Palavras-chave de alto impacto
        const highImpactKeywords = [
            'promoção', 'promocao', 'desconto', 'saldos', 'black friday', 'cyber monday',
            'lançamento', 'lancamento', 'novo', 'nova', 'breakthrough', 'inovação', 'inovacao',
            'recorde', 'histórico', 'historico', 'maior', 'menor', 'primeiro', 'único', 'unico',
            'revolução', 'revolucao', 'mudança', 'mudanca', 'impacto', 'crise', 'boom'
        ];

        // Palavras-chave de médio impacto
        const mediumImpactKeywords = [
            'anúncio', 'anuncio', 'atualização', 'atualizacao', 'melhoria', 'atualizar',
            'preço', 'preco', 'valor', 'custo', 'barato', 'caro', 'oferta', 'venda'
        ];

        // Verificar palavras-chave de alto impacto
        highImpactKeywords.forEach(keyword => {
            if (content.includes(keyword)) {
                score += 2;
            }
        });

        // Verificar palavras-chave de médio impacto
        mediumImpactKeywords.forEach(keyword => {
            if (content.includes(keyword)) {
                score += 1;
            }
        });

        // Verificar se menciona lojas monitoradas
        this.monitoredStores.forEach(store => {
            if (content.includes(store.toLowerCase())) {
                score += 1.5;
            }
        });

        // Verificar palavras-chave da categoria
        if (this.monitoredCategories[category]) {
            this.monitoredCategories[category].forEach(keyword => {
                if (content.includes(keyword)) {
                    score += 0.5;
                }
            });
        }

        // Normalizar score para 1-10
        score = Math.min(10, Math.max(1, Math.round(score)));

        return score;
    }

    /**
     * Busca notícias usando NewsAPI ou fonte alternativa
     * Retorna apenas notícias com score de impacto >= minScore
     */
    async fetchNews(minScore = 7) {
        try {
            // Buscar configuração
            const [configs] = await pool.query(
                "SELECT * FROM news_config WHERE IsActive = 1 LIMIT 1"
            );

            if (configs.length === 0) {
                return [];
            }

            const config = configs[0];
            const minImpactScore = config.minimpactscore || config.MinImpactScore || minScore;

            // Verificar última verificação para evitar spam
            const lastCheckRaw = config.lastcheck || config.LastCheck;
            const lastCheck = lastCheckRaw ? new Date(lastCheckRaw) : null;
            const now = new Date();
            const checkInterval = (config.checkinterval || config.CheckInterval || 60) * 60 * 1000;

            if (lastCheck && (now - lastCheck) < checkInterval) {
                return []; // Ainda não é hora de verificar novamente
            }

            // Buscar notícias usando NewsAPI (se configurado) ou fonte alternativa
            const newsApiKey = process.env.NEWS_API_KEY;
            const articles = [];

            if (newsApiKey) {
                // Usar NewsAPI
                try {
                    const categories = Object.keys(this.monitoredCategories);
                    for (const category of categories) {
                        const keywords = this.monitoredCategories[category].slice(0, 3).join(' OR ');
                        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keywords)}&language=pt&sortBy=publishedAt&pageSize=10&apiKey=${newsApiKey}`;
                        
                        const response = await this.fetchJsonWithTimeout(url);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.articles) {
                                articles.push(...data.articles.map(article => ({
                                    ...article,
                                    category: category
                                })));
                            }
                        }
                        
                        // Rate limiting - aguardar entre requisições
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error('[NEWS] Erro ao buscar notícias da NewsAPI:', error);
                }
            } else {
                // Fonte alternativa: usar RSS feeds ou scraping (implementação futura)
                console.log('[NEWS] NewsAPI não configurada. Configure NEWS_API_KEY no .env para usar notícias automáticas.');
            }

            // Filtrar e classificar notícias por impacto
            const filteredNews = [];
            const seenUrls = new Set();

            for (const article of articles) {
                const title = article.title != null ? String(article.title).trim() : '';
                if (!title || !article.url || seenUrls.has(article.url)) continue;
                seenUrls.add(article.url);

                const impactScore = this.calculateImpactScore(article, article.category || 'Geral');
                
                if (impactScore >= minImpactScore) {
                    filteredNews.push({
                        title,
                        description: article.description,
                        url: article.url,
                        image: article.urlToImage,
                        publishedAt: article.publishedAt,
                        source: article.source?.name || 'Fonte',
                        category: article.category || 'Geral',
                        impactScore: impactScore
                    });
                }
            }

            // Ordenar por score de impacto (maior primeiro)
            filteredNews.sort((a, b) => b.impactScore - a.impactScore);

            // Salvar todas as notícias filtradas na tabela blog_articles
            await this.saveNewsToBlog(filteredNews);

            const newsToNotify = [];
            const { isNewsletterArticleSent, markNewsletterArticlesSent } = await import("./newsletterNotifier.js");
            for (const news of filteredNews) {
                if (!(await isNewsletterArticleSent(news.url))) {
                    newsToNotify.push(news);
                }
            }

            // Newsletter — tracking separado do Discord (news_sent)
            if (newsToNotify.length > 0) {
                try {
                    const { notifySubscribersOfNewArticles } = await import("./newsletterNotifier.js");
                    const delivery = await notifySubscribersOfNewArticles(newsToNotify);
                    if (delivery.sent > 0) {
                        await markNewsletterArticlesSent(newsToNotify);
                    }
                } catch (notifyErr) {
                    console.error("[NEWS] Erro ao notificar subscritores de novos artigos:", notifyErr.message);
                }
            }

            // Limitar a 5 notícias mais impactantes
            const topNews = filteredNews.slice(0, 5);

            // Atualizar última verificação
            await pool.query(
                'UPDATE news_config SET LastCheck = NOW() WHERE Id = ?',
                [config.id || config.Id]
            );

            return topNews;

        } catch (error) {
            console.error('[NEWS] Erro ao buscar notícias:', error);
            return [];
        }
    }

    /**
     * Verifica se uma notícia já foi enviada (evitar duplicatas)
     */
    async isNewsAlreadySent(url) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS news_sent (
                    Id SERIAL PRIMARY KEY,
                    Url VARCHAR(500) NOT NULL UNIQUE,
                    Title VARCHAR(500),
                    Category VARCHAR(100),
                    ImpactScore INT,
                    SentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_news_sent_url ON news_sent (Url)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_news_sent_at ON news_sent (SentAt)`);

            const [existing] = await pool.query(
                'SELECT Id FROM news_sent WHERE Url = ?',
                [url]
            );

            return existing.length > 0;

        } catch (error) {
            console.error('[NEWS] Erro ao verificar notícia enviada:', error);
            return false;
        }
    }

    /**
     * Marca uma notícia como enviada
     */
    async markNewsAsSent(news) {
        try {
            await pool.query(`
                INSERT INTO news_sent (Url, Title, Category, ImpactScore)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (Url) DO UPDATE SET Title = EXCLUDED.Title
            `, [news.url, news.title, news.category, news.impactScore]);
        } catch (error) {
            console.error('[NEWS] Erro ao marcar notícia como enviada:', error);
        }
    }

    /**
     * Salva notícias na tabela blog_articles
     */
    async saveNewsToBlog(newsArray) {
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
                    ImpactScore INT DEFAULT 0,
                    PublishedAt TIMESTAMP NOT NULL,
                    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    IsVisible BOOLEAN DEFAULT TRUE,
                    Views INT DEFAULT 0
                )
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_articles_category ON blog_articles (Category)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_articles_impact_score ON blog_articles (ImpactScore)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_articles_published_at ON blog_articles (PublishedAt)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_articles_created_at ON blog_articles (CreatedAt)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_blog_articles_is_visible ON blog_articles (IsVisible)`);

            for (const news of newsArray) {
                const title = news.title != null && String(news.title).trim() !== '' ? String(news.title).trim() : null;
                const url = news.url != null && String(news.url).trim() !== '' ? news.url : null;
                if (!title || !url) {
                    continue;
                }
                const publishedDate = news.publishedAt ? new Date(news.publishedAt) : new Date();

                await pool.query(`
                    INSERT INTO blog_articles 
                        (Title, Description, Url, ImageUrl, Source, Category, ImpactScore, PublishedAt, IsVisible)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                    ON CONFLICT (Url) DO UPDATE SET
                        Title = EXCLUDED.Title,
                        Description = EXCLUDED.Description,
                        ImageUrl = EXCLUDED.ImageUrl,
                        Source = EXCLUDED.Source,
                        Category = EXCLUDED.Category,
                        ImpactScore = EXCLUDED.ImpactScore,
                        PublishedAt = EXCLUDED.PublishedAt,
                        UpdatedAt = CURRENT_TIMESTAMP
                `, [
                    title,
                    news.description || null,
                    url,
                    news.image || null,
                    news.source || null,
                    news.category || 'Geral',
                    news.impactScore ?? 0,
                    publishedDate
                ]);
            }
        } catch (error) {
            console.error('[NEWS] Erro ao salvar notícias no blog:', error);
        }
    }
}

export default new NewsService();

