import { pool } from '../database/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'https://api.apileague.com/retrieve-random-meme';

class MemeService {
    constructor() {
        this.apiKey = process.env.API_LEAGUE_API_KEY || process.env.APILEAGUE_API_KEY || '';
        this.apiUnavailableLoggedAt = 0;
    }

    hasApiKey() {
        return Boolean(this.apiKey && this.apiKey !== 'your-api-key-here');
    }

    async fetchRandomMeme(options = {}) {
        if (!this.hasApiKey()) {
            if (Date.now() - this.apiUnavailableLoggedAt > 3600000) {
                console.warn('[MEME] API_LEAGUE_API_KEY not configured');
                this.apiUnavailableLoggedAt = Date.now();
            }
            return null;
        }

        const params = new URLSearchParams();
        params.set('media-type', options.mediaType || 'image');
        params.set('max-age-days', String(options.maxAgeDays ?? 30));
        if (options.keywords) {
            params.set('keywords', options.keywords);
        }

        const url = `${API_BASE}?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'x-api-key': this.apiKey,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(25000),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                console.warn(`[MEME] API error ${response.status}: ${text.substring(0, 200)}`);
                return null;
            }

            const data = await response.json();
            if (!data?.url) return null;

            return {
                url: data.url,
                description: data.description || '',
                type: data.type || 'image',
                width: data.width,
                height: data.height,
                ratio: data.ratio,
            };
        } catch (error) {
            console.warn('[MEME] Fetch failed:', error.message);
            return null;
        }
    }

    async ensureMemesSentTable() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS memes_sent (
                Id SERIAL PRIMARY KEY,
                Url TEXT NOT NULL,
                Description TEXT,
                SentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_memes_sent_url ON memes_sent (Url)
        `).catch(() => {});
    }

    async isMemeAlreadySent(url) {
        if (!url) return true;
        await this.ensureMemesSentTable();
        const [rows] = await pool.query(
            'SELECT Id FROM memes_sent WHERE Url = ? LIMIT 1',
            [url]
        );
        return rows.length > 0;
    }

    async markMemeAsSent(meme) {
        if (!meme?.url) return;
        await this.ensureMemesSentTable();
        await pool.query(
            'INSERT INTO memes_sent (Url, Description) VALUES (?, ?)',
            [meme.url, (meme.description || '').substring(0, 500)]
        );
    }
}

export default new MemeService();
