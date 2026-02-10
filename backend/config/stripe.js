import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ silent: true, debug: false, override: false, quiet: true });

// Configuração do Stripe com fallback para desenvolvimento
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

// Configuração dos planos
export const PLANOS_STRIPE = {
  1: { // FREE
    nome: 'Free',
    preco: 0,
    stripe_price_id: null, // Plano gratuito não precisa de price ID
    stripe_checkout_url: null, // Plano gratuito não precisa de checkout
    limite_produtos: 5,
    verificacao_intervalo: 24,
    relatorios: false
  },
  2: { // BASIC
    nome: 'Basic',
    preco: 4.99,
    stripe_price_id: process.env.STRIPE_BASIC_PRICE_ID, // Configurar no .env
    stripe_checkout_url: process.env.STRIPE_BASIC_CHECKOUT_URL || 'https://buy.stripe.com/eVqcN587y8IG3IM1dleZ201', // Link direto do Stripe
    limite_produtos: 25,
    verificacao_intervalo: 4,
    relatorios: true
  },
  3: { // STANDARD
    nome: 'Standard',
    preco: 12.99,
    stripe_price_id: process.env.STRIPE_STANDARD_PRICE_ID, // Price ID específico para Standard
    stripe_checkout_url: process.env.STRIPE_STANDARD_CHECKOUT_URL || 'https://buy.stripe.com/dRm3cv73u8IG4MQ2hpeZ202', // Link direto do Stripe
    limite_produtos: 50, // Ilimitado
    verificacao_intervalo: 0.5, // 30 minutos
    relatorios: true
  },
  4: { // PREMIUM
    nome: 'Premium',
    preco: 15.30,
    stripe_price_id: process.env.STRIPE_PREMIUM_PRICE_ID, // Configurar no .env
    stripe_checkout_url: process.env.STRIPE_PREMIUM_CHECKOUT_URL || 'https://buy.stripe.com/aFa14ncnO6Ay0wA7BJeZ203', // Link direto do Stripe
    limite_produtos: 100, // Ilimitado
    verificacao_intervalo: 0.083, // 5 minutos
    relatorios: true
  }
};

export default stripe;
