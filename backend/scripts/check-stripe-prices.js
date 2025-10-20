import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkStripePrices() {
  try {
    console.log('🔍 Verificando Price IDs no Stripe...\n');
    
    // Listar todos os produtos
    const products = await stripe.products.list({ limit: 100 });
    
    console.log('📦 Produtos encontrados:');
    products.data.forEach(product => {
      console.log(`- ${product.name} (ID: ${product.id})`);
    });
    
    console.log('\n💰 Price IDs encontrados:');
    
    // Listar todos os preços
    const prices = await stripe.prices.list({ limit: 100 });
    
    prices.data.forEach(price => {
      const amount = price.unit_amount / 100; // Converter de centavos para euros
      const status = price.active ? '✅ Ativo' : '❌ Inativo';
      const interval = price.recurring ? `/${price.recurring.interval}` : ' (one-time)';
      
      console.log(`- ${price.id}: €${amount}${interval} - ${status}`);
      
      // Verificar se é o preço do Premium (€15.30)
      if (amount === 15.30 && price.active) {
        console.log(`🎯 ENCONTRADO! Price ID para Premium (€15.30): ${price.id}`);
      }
    });
    
    // Verificar Price IDs específicos do .env
    console.log('\n🔧 Verificando Price IDs do .env:');
    
    const envPriceIds = {
      'STRIPE_BASIC_PRICE_ID': process.env.STRIPE_BASIC_PRICE_ID,
      'STRIPE_STANDARD_PRICE_ID': process.env.STRIPE_STANDARD_PRICE_ID,
      'STRIPE_PREMIUM_PRICE_ID': process.env.STRIPE_PREMIUM_PRICE_ID
    };
    
    for (const [envVar, priceId] of Object.entries(envPriceIds)) {
      if (priceId) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount / 100;
          const status = price.active ? '✅ Ativo' : '❌ Inativo';
          console.log(`${envVar}: ${priceId} - €${amount} - ${status}`);
        } catch (error) {
          console.log(`${envVar}: ${priceId} - ❌ ERRO: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar preços:', error.message);
  }
}

checkStripePrices();
