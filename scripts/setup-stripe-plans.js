#!/usr/bin/env node

/**
 * Script para configurar os planos do Stripe
 * Este script ajuda a criar produtos e preços no Stripe para os planos do PromoPing
 */

import dotenv from 'dotenv';
import Stripe from 'stripe';
import readline from 'readline';

// Carregar variáveis de ambiente
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Planos configurados no sistema
const PLANOS = {
  1: { nome: 'Free', preco: 0, descricao: 'Plano gratuito com limitações básicas' },
  2: { nome: 'Basic', preco: 4.99, descricao: 'Plano básico para usuários iniciantes' },
  3: { nome: 'Standard', preco: 12.99, descricao: 'Plano padrão para uso profissional' },
  4: { nome: 'Premium', preco: 15.30, descricao: 'Plano premium com recursos avançados' }
};

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function criarProdutoStripe(plano) {
  try {
    console.log(`\n  Criando produto para ${plano.nome}...`);
    
    const produto = await stripe.products.create({
      name: `PromoPing ${plano.nome}`,
      description: plano.descricao,
      metadata: {
        plano_id: Object.keys(PLANOS).find(key => PLANOS[key].nome === plano.nome),
        sistema: 'promoping'
      }
    });
    
    console.log(` Produto criado: ${produto.id}`);
    return produto;
  } catch (error) {
    console.error(` Erro ao criar produto:`, error.message);
    return null;
  }
}

async function criarPrecoStripe(produtoId, plano) {
  try {
    console.log(` Criando preço para ${plano.nome} (€${plano.preco})...`);
    
    const preco = await stripe.prices.create({
      product: produtoId,
      unit_amount: Math.round(plano.preco * 100), // Converter para centavos
      currency: 'eur',
      recurring: {
        interval: 'month'
      },
      metadata: {
        plano_id: Object.keys(PLANOS).find(key => PLANOS[key].nome === plano.nome),
        sistema: 'promoping'
      }
    });
    
    console.log(` Preço criado: ${preco.id}`);
    return preco;
  } catch (error) {
    console.error(` Erro ao criar preço:`, error.message);
    return null;
  }
}

async function listarProdutosExistentes() {
  try {
    console.log('\n Produtos existentes no Stripe:');
    const produtos = await stripe.products.list({ limit: 10 });
    
    produtos.data.forEach(produto => {
      console.log(`  - ${produto.name} (ID: ${produto.id})`);
    });
    
    return produtos.data;
  } catch (error) {
    console.error(' Erro ao listar produtos:', error.message);
    return [];
  }
}

async function main() {
  console.log(' Configuração dos Planos Stripe para PromoPing');
  console.log('================================================');
  
  // Verificar se a chave do Stripe está configurada
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key_here')) {
    console.log(' Configure primeiro STRIPE_SECRET_KEY no arquivo .env');
    console.log('   Obtenha sua chave em: https://dashboard.stripe.com/apikeys');
    process.exit(1);
  }
  
  console.log('\n Planos configurados no sistema:');
  Object.entries(PLANOS).forEach(([id, plano]) => {
    console.log(`  ${id}. ${plano.nome} - €${plano.preco}/mês`);
  });
  
  const resposta = await question('\n Deseja criar produtos e preços no Stripe? (s/n): ');
  
  if (resposta.toLowerCase() !== 's') {
    console.log(' Operação cancelada.');
    rl.close();
    return;
  }
  
  // Listar produtos existentes
  await listarProdutosExistentes();
  
  const criarNovos = await question('\n Deseja criar novos produtos? (s/n): ');
  
  if (criarNovos.toLowerCase() === 's') {
    console.log('\n Criando produtos e preços...');
    
    const resultados = {};
    
    for (const [id, plano] of Object.entries(PLANOS)) {
      if (plano.preco === 0) {
        console.log(`\n  Pulando ${plano.nome} (plano gratuito)`);
        continue;
      }
      
      const produto = await criarProdutoStripe(plano);
      if (produto) {
        const preco = await criarPrecoStripe(produto.id, plano);
        if (preco) {
          resultados[plano.nome.toLowerCase()] = {
            produto_id: produto.id,
            price_id: preco.id
          };
        }
      }
    }
    
    console.log('\n Configurações para o arquivo .env:');
    console.log('=====================================');
    
    if (resultados.basic) {
      console.log(`STRIPE_BASIC_PRICE_ID=${resultados.basic.price_id}`);
    }
    if (resultados.standard) {
      console.log(`STRIPE_STANDARD_PRICE_ID=${resultados.standard.price_id}`);
    }
    if (resultados.premium) {
      console.log(`STRIPE_PREMIUM_PRICE_ID=${resultados.premium.price_id}`);
    }
    
    console.log('\n Copie essas linhas para o seu arquivo .env');
  }
  
  console.log('\n Configuração concluída!');
  rl.close();
}

// Executar o script
main().catch(error => {
  console.error(' Erro fatal:', error);
  process.exit(1);
});
