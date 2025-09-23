import express from 'express';
import { scrapeProductInfo } from '../services/scrapers/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url é obrigatório' });
    const data = await scrapeProductInfo(String(url));
    res.json(data);
  } catch (err) {
    console.error('Erro no scrape:', err.message);
    res.status(500).json({ error: 'Falha ao obter dados do produto' });
  }
});

export default router;