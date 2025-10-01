import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

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
    limite_produtos: 5,
    verificacao_intervalo: 24,
    permite_sms: false,
    relatorios: false
  },
  2: { // BASIC
    nome: 'Basic',
    preco: 9.99,
    stripe_price_id: process.env.STRIPE_BASIC_PRICE_ID, // Configurar no .env
    limite_produtos: 25,
    verificacao_intervalo: 4,
    permite_sms: true,
    relatorios: true
  },
  3: { // PREMIUM
    nome: 'Premium',
    preco: 9.99,
    stripe_price_id: process.env.STRIPE_PREMIUM_PRICE_ID, // Configurar no .env
    limite_produtos: 9999, // Ilimitado
    verificacao_intervalo: 1,
    permite_sms: true,
    relatorios: true
  }
};

export default stripe;
