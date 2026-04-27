// Script para inserir lojas na base de dados
import { pool } from '../database/db.js';
import dotenv from 'dotenv';

dotenv.config();

const lojas = [
  { id: 1, nome: 'Amazon', dominio: 'amazon.com', css_selector_preco: '.a-price-whole, .a-price-fraction, .a-offscreen, [data-asin-price], .a-price .a-offscreen' },
  { id: 2, nome: 'Amazon', dominio: 'amazon.es', css_selector_preco: '.a-price-whole, .a-price-fraction, .a-offscreen, [data-asin-price], .a-price .a-offscreen' },
  { id: 3, nome: 'Worten', dominio: 'worten.pt', css_selector_preco: 'span.value, sup.decimal, .current-price, .product-price' },
  { id: 4, nome: 'FNAC', dominio: 'fnac.pt', css_selector_preco: '.f-priceBox__price, .f-priceBox-price, .price, .userPrice.checked' },
  { id: 5, nome: 'Continente', dominio: 'continente.pt', css_selector_preco: 'span.ct-price-formatted, .price, .product-price, .current-price' },
  { id: 6, nome: 'PCDiga', dominio: 'pcdiga.com', css_selector_preco: '.product-price, .price, .current-price, [data-testid="price"]' },
  { id: 7, nome: 'GlobalData', dominio: 'globaldata.pt', css_selector_preco: '.price, .current-price, .product-price, [data-testid="price"]' },
  { id: 8, nome: 'Radio Popular', dominio: 'radiopopular.pt', css_selector_preco: '.sales, .price, .product-price, .current-price' },
  { id: 9, nome: 'MediaMarkt', dominio: 'mediamarkt.pt', css_selector_preco: '.Price.price, .price, .current-price, [data-testid="price"]' },
  { id: 10, nome: 'IKEA', dominio: 'ikea.pt', css_selector_preco: 'span.product-pip__price__value, .pip-price__integer, .pip-price__integer--medium' },
  { id: 11, nome: 'Leroy Merlin', dominio: 'leroymerlin.pt', css_selector_preco: 'span.m-price__line, .price, .product-price, .current-price' },
  { id: 12, nome: 'Zara', dominio: 'zara.com', css_selector_preco: '.price._product-price, .money-amount' },
  { id: 13, nome: 'H&M', dominio: 'hm.com', css_selector_preco: 'span.price-value, .price, .new-price' }
];

async function insertLojas() {
  try {
    console.log('Iniciando inserção de lojas na base de dados...');

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const loja of lojas) {
      try {
        // Usar INSERT ... ON CONFLICT DO UPDATE para inserir ou atualizar
        const [result] = await pool.query(
          `INSERT INTO lojas (Id, Nome, Dominio, CssSelectorPreco, CreatedAt)
           VALUES (?, ?, ?, ?, '2025-10-08 19:52:46')
           ON CONFLICT (Id) DO UPDATE SET
             Nome = EXCLUDED.Nome,
             Dominio = EXCLUDED.Dominio,
             CssSelectorPreco = EXCLUDED.CssSelectorPreco`,
          [loja.id, loja.nome, loja.dominio, loja.css_selector_preco]
        );

        if (result.affectedRows === 1) {
          inserted++;
          console.log(`Inserido: ${loja.nome} (${loja.dominio})`);
        } else if (result.affectedRows === 2) {
          updated++;
          console.log(`Atualizado: ${loja.nome} (${loja.dominio})`);
        } else {
          skipped++;
          console.log(`Ignorado: ${loja.nome} (${loja.dominio})`);
        }
      } catch (error) {
        console.error(`Erro ao inserir ${loja.nome}:`, error.message);
      }
    }

    console.log(`\nProcesso concluído!`);
    console.log(`- Inseridos: ${inserted}`);
    console.log(`- Atualizados: ${updated}`);
    console.log(`- Ignorados: ${skipped}`);
    console.log(`- Total processado: ${lojas.length}`);

    await pool.end();
  } catch (error) {
    console.error('Erro ao inserir lojas:', error);
    await pool.end();
    process.exit(1);
  }
}

insertLojas();
