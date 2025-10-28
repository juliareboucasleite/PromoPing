#!/usr/bin/env node

/**
 * Script para validar a configuração dos planos
 * Verifica se todas as configurações necessárias estão presentes
 */

import dotenv from 'dotenv';
import Stripe from 'stripe';

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Stripe apenas se a chave estiver configurada
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key_here')) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Planos esperados
const PLANOS_ESPERADOS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID,
  standard: process.env.STRIPE_STANDARD_PRICE_ID,
  premium: process.env.STRIPE_PREMIUM_PRICE_ID
};

async function validarConfiguracao() {
  console.log(' Validando configuração dos planos...');
  console.log('=====================================');
  
  let erros = [];
  let avisos = [];
  
  // Verificar chave do Stripe
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key_here')) {
    erros.push(' STRIPE_SECRET_KEY não configurada no .env');
  } else {
    console.log(' STRIPE_SECRET_KEY configurada');
  }
  
  // Verificar Price IDs
  console.log('\n Verificando Price IDs dos planos:');
  
  for (const [plano, priceId] of Object.entries(PLANOS_ESPERADOS)) {
    if (!priceId || priceId.includes('your_') || priceId.includes('_here')) {
      erros.push(` STRIPE_${plano.toUpperCase()}_PRICE_ID não configurado`);
    } else {
      console.log(` ${plano.toUpperCase()}: ${priceId}`);
      
      // Verificar se o Price ID existe no Stripe
      if (stripe) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          console.log(`    Preço: €${(price.unit_amount / 100).toFixed(2)}/${price.recurring.interval}`);
          
          // Verificar produto associado
          const produto = await stripe.products.retrieve(price.product);
          console.log(`     Produto: ${produto.name}`);
          
        } catch (error) {
          avisos.push(`  Price ID ${priceId} não encontrado no Stripe: ${error.message}`);
        }
      } else {
        avisos.push(`  Stripe não configurado - não foi possível validar Price ID ${priceId}`);
      }
    }
  }
  
  // Verificar outras configurações importantes
  console.log('\n Verificando outras configurações:');
  
  const configs = [
    { key: 'JWT_SECRET', nome: 'JWT Secret' },
    { key: 'DB_HOST', nome: 'Host do Banco' },
    { key: 'DB_USER', nome: 'Usuário do Banco' },
    { key: 'DB_NAME', nome: 'Nome do Banco' },
    { key: 'GOOGLE_CLIENT_ID', nome: 'Google Client ID' },
    { key: 'DISCORD_BOT_TOKEN', nome: 'Discord Bot Token' }
  ];
  
  configs.forEach(config => {
    if (!process.env[config.key] || process.env[config.key].includes('your_') || process.env[config.key].includes('_here')) {
      avisos.push(`  ${config.nome} não configurado (${config.key})`);
    } else {
      console.log(` ${config.nome}: configurado`);
    }
  });
  
  // Resumo
  console.log('\n RESUMO DA VALIDAÇÃO:');
  console.log('======================');
  
  if (erros.length === 0) {
    console.log(' Configuração básica dos planos está correta!');
  } else {
    console.log(' Problemas encontrados:');
    erros.forEach(erro => console.log(`   ${erro}`));
  }
  
  if (avisos.length > 0) {
    console.log('\n  Avisos:');
    avisos.forEach(aviso => console.log(`   ${aviso}`));
  }
  
  // Instruções
  console.log('\n PRÓXIMOS PASSOS:');
  console.log('===================');
  
  if (erros.length > 0) {
    console.log('1. Configure as variáveis de ambiente faltantes no arquivo .env');
    console.log('2. Execute: node scripts/setup-stripe-plans.js para criar produtos no Stripe');
    console.log('3. Execute novamente este script para validar');
  } else {
    console.log('1.  Configuração dos planos está pronta!');
    console.log('2. Execute: node backend/scripts/setup-planos.js para configurar o banco');
    console.log('3. Inicie o servidor: npm start');
  }
  
  return erros.length === 0;
}

// Executar validação
validarConfiguracao().catch(error => {
  console.error(' Erro na validação:', error);
  process.exit(1);
});
