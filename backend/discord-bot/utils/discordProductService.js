const mysql = require('../mysql2-compat');

const STORE_DOMAINS = {
    'worten.pt': 'Worten',
    'fnac.pt': 'FNAC',
    'mediamarkt.pt': 'MediaMarkt',
    'pcdiga.pt': 'PCDiga',
    'leroymerlin.pt': 'Leroy Merlin',
    'ikea.pt': 'IKEA',
    'continente.pt': 'Continente',
    'pingodoce.pt': 'Pingo Doce',
    'auchan.pt': 'Auchan',
    'elcorteingles.pt': 'El Corte Inglés',
    'radiopopular.pt': 'Rádio Popular',
    'decathlon.pt': 'Decathlon',
};

function getDbConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'papv5',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
    };
}

function isAllowedProductUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function detectStore(link) {
    try {
        let hostname = new URL(link).hostname.toLowerCase().replace(/^www\./, '');
        if (hostname === 'amzn.eu' || hostname === 'amzn.to' || hostname.includes('amazon.')) {
            return { name: 'Amazon', domain: hostname };
        }
        for (const [domain, name] of Object.entries(STORE_DOMAINS)) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
                return { name, domain };
            }
        }
        return { name: 'Loja Online', domain: hostname };
    } catch {
        return { name: 'Desconhecida', domain: 'unknown' };
    }
}

function parsePrice(raw) {
    if (raw === undefined || raw === null) return null;
    const cleaned = String(raw).replace(/€/g, '').replace(/\s/g, '').replace(',', '.').trim();
    const num = Number.parseFloat(cleaned);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num * 100) / 100;
}

function fitProductName(nome, maxLength = 150) {
    const normalized = String(nome || '').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return normalized.slice(0, maxLength).trim();
}

function deriveProductName(link, storeName, explicitName) {
    const explicit = fitProductName(explicitName);
    if (explicit) return explicit;

    try {
        const pathname = new URL(link).pathname.split('/').filter(Boolean).pop() || '';
        const slug = decodeURIComponent(pathname)
            .replace(/\.(html?|php|aspx)$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (slug.length >= 3) {
            return fitProductName(slug.slice(0, 80));
        }
    } catch {
        // ignore
    }

    return fitProductName(`Produto ${storeName}`);
}

function formatVerificationInterval(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    const hours = Number.parseInt(digits, 10);
    if (!Number.isFinite(hours) || hours <= 0) return '24 horas';
    if (hours === 1) return '1 hora';
    if (hours < 24) return `${hours} horas`;
    if (hours % 24 === 0 && hours >= 24) {
        const days = hours / 24;
        return days === 1 ? '24 horas' : `${days} dias`;
    }
    return `${hours} horas`;
}

async function withDb(fn) {
    const connection = await mysql.createConnection(getDbConfig());
    try {
        return await fn(connection);
    } finally {
        await connection.end().catch(() => {});
    }
}

async function getLinkedUser(discordId) {
    return withDb(async (connection) => {
        const [users] = await connection.execute(
            'SELECT ReferenciaID, Email, Nome FROM utilizadores WHERE discord_id = ? LIMIT 1',
            [discordId]
        );
        return users[0] || null;
    });
}

async function getUserPlanSummary(referenciaID) {
    return withDb(async (connection) => {
        const [rows] = await connection.execute(
            `SELECT
                p.Id AS planoId,
                p.Nome AS planoNome,
                p.Preco AS planoPreco,
                p.LimiteProdutos AS limiteProdutos,
                p.IntervaloVerificacao AS intervaloVerificacao,
                p.HistoricoDias AS historicoDias,
                p.Relatorios AS relatorios,
                COALESCE(c.LimiteProdutos, p.LimiteProdutos, 5) AS limiteEfetivo
             FROM configutilizador c
             LEFT JOIN planos p ON p.Id = c.PlanoAtualId
             WHERE c.ReferenciaID = ?
             LIMIT 1`,
            [referenciaID]
        );

        const plan = rows[0] || {
            planoId: 1,
            planoNome: 'Free',
            planoPreco: 0,
            limiteProdutos: 5,
            limiteEfetivo: 5,
            intervaloVerificacao: '24',
            historicoDias: 0,
            relatorios: 0,
        };

        const [countRows] = await connection.execute(
            'SELECT COUNT(*) AS total FROM produtos WHERE ReferenciaID = ? AND DeletedAt IS NULL',
            [referenciaID]
        );

        const [prefRows] = await connection.execute(
            "SELECT Ativo FROM preferenciasnotificacao WHERE ReferenciaID = ? AND LOWER(Tipo) = 'discord' LIMIT 1",
            [referenciaID]
        );

        const totalProdutos = Number(countRows[0]?.total || 0);
        const limite = Number(plan.limiteEfetivo || plan.limiteProdutos || 5);
        const discordAtivo = prefRows.length > 0 ? prefRows[0].Ativo === 1 || prefRows[0].Ativo === true : false;

        return {
            ...plan,
            totalProdutos,
            limite,
            restantes: Math.max(0, limite - totalProdutos),
            intervaloLabel: formatVerificationInterval(plan.intervaloVerificacao),
            discordAtivo,
            historicoLabel: Number(plan.historicoDias) > 0 ? `${plan.historicoDias} dias` : 'Básico',
            relatoriosAtivos: plan.relatorios === 1 || plan.relatorios === true || String(plan.relatorios).toLowerCase() === 'true',
        };
    });
}

async function setDiscordNotificationPreference(referenciaID, ativo) {
    return withDb(async (connection) => {
        await connection.execute(
            `INSERT INTO preferenciasnotificacao (ReferenciaID, Tipo, Ativo)
             VALUES (?, 'discord', ?)
             ON CONFLICT (ReferenciaID, Tipo) DO UPDATE SET Ativo = EXCLUDED.Ativo`,
            [referenciaID, ativo ? 1 : 0]
        );
    });
}

async function resolveLojaId(connection, store) {
    if (!store?.domain || store.domain === 'unknown') return null;

    const [byDomain] = await connection.execute(
        'SELECT Id FROM lojas WHERE Dominio = ? LIMIT 1',
        [store.domain]
    );
    if (byDomain.length > 0) return byDomain[0].Id;

    const [byName] = await connection.execute(
        'SELECT Id FROM lojas WHERE Nome = ? LIMIT 1',
        [store.name]
    );
    if (byName.length > 0) return byName[0].Id;

    return null;
}

async function addProductForUser(referenciaID, { link, precoAlvo, nome }) {
    const normalizedLink = String(link || '').trim();
    const price = parsePrice(precoAlvo);

    if (!isAllowedProductUrl(normalizedLink)) {
        return { ok: false, code: 'INVALID_URL', message: 'O link deve começar por http:// ou https://.' };
    }
    if (!price) {
        return { ok: false, code: 'INVALID_PRICE', message: 'Indica um preço alvo válido (ex: 29.99).' };
    }

    const store = detectStore(normalizedLink);
    const safeNome = deriveProductName(normalizedLink, store.name, nome);
    if (!safeNome) {
        return { ok: false, code: 'INVALID_NAME', message: 'Não foi possível gerar um nome para o produto.' };
    }

    return withDb(async (connection) => {
        const [configRows] = await connection.execute(
            'SELECT PlanoAtualId, LimiteProdutos FROM configutilizador WHERE ReferenciaID = ? LIMIT 1',
            [referenciaID]
        );

        let limite = 5;
        if (configRows.length > 0 && configRows[0].LimiteProdutos != null) {
            limite = Number(configRows[0].LimiteProdutos) || 5;
        }

        const [countRows] = await connection.execute(
            'SELECT COUNT(*) AS total FROM produtos WHERE ReferenciaID = ? AND DeletedAt IS NULL',
            [referenciaID]
        );
        const total = Number(countRows[0]?.total || 0);

        if (total >= limite) {
            return {
                ok: false,
                code: 'LIMIT_REACHED',
                message: `Limite de ${limite} produtos atingido no teu plano atual.`,
                limite,
                total,
            };
        }

        const lojaId = await resolveLojaId(connection, store);

        const [result] = await connection.execute(
            'INSERT INTO produtos (ReferenciaID, Nome, Link, DataLimite, LojaId, PrecoAlvo, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [referenciaID, safeNome, normalizedLink, null, lojaId, price]
        );

        const productId = result.insertId;

        await connection.execute(
            `INSERT INTO preferenciasnotificacao (ReferenciaID, Tipo, Ativo)
             VALUES (?, 'discord', 1)
             ON CONFLICT (ReferenciaID, Tipo) DO UPDATE SET Ativo = EXCLUDED.Ativo`,
            [referenciaID]
        );

        return {
            ok: true,
            product: {
                Id: productId,
                Nome: safeNome,
                Link: normalizedLink,
                PrecoAlvo: price,
                Loja: store.name,
            },
            limite,
            total: total + 1,
        };
    });
}

module.exports = {
    getDbConfig,
    isAllowedProductUrl,
    detectStore,
    parsePrice,
    formatVerificationInterval,
    getLinkedUser,
    getUserPlanSummary,
    setDiscordNotificationPreference,
    addProductForUser,
};
