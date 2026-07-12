// backend/database/models/historico.js
import { pool } from "../db.js";
import { processAlerts } from "../../services/alerts.js";
import { isPlausiblePrice, describePriceRejection } from "../../utils/priceValidation.js";

// Essa função aqui salva o preço no histórico E processa alertas
// pode perder histórico de preços ou não enviar notificações
// A ordem das operações é importante: primeiro busca preço anterior, depois salva novo
export async function salvarPreco(produtoId, preco) {
  // Buscar preço anterior antes de inserir o novo
  // ESSA QUERY AQUI É IMPORTANTE: pega o preço anterior pra comparar depois
  // Se tu mudar isso, pode quebrar a lógica de alertas (que precisa saber se o preço mudou)
  const [produtoRows] = await pool.query(
    `SELECT p.*, 
     (SELECT Preco FROM historicoprecos WHERE ProdutoId = p.Id ORDER BY DataRegisto DESC LIMIT 1) as PrecoAnterior
     FROM Produtos p WHERE p.Id = ?`,
    [produtoId]
  );

  const produto = produtoRows[0];
  const precoAnterior = produto?.PrecoAnterior || produto?.PrecoAtual || null;

  if (!isPlausiblePrice(preco, precoAnterior)) {
    console.warn(
      `[HISTORICO] Preço ignorado para produto ${produtoId}: ${describePriceRejection(preco, precoAnterior)}`
    );
    return { skipped: true, reason: "implausible_price" };
  }

  // Inserir novo preço no histórico
  // ESSA QUERY AQUI SALVA O PREÇO NO HISTÓRICO
  // perde o histórico de preços e não consegue ver evolução
  await pool.query(
    `INSERT INTO historicoprecos (ProdutoId, Preco, DataRegisto) 
     VALUES (?, ?, NOW())`,
    [produtoId, preco]
  );

  // Atualizar preço atual do produto
  // ESSA QUERY AQUI ATUALIZA O PREÇO ATUAL NA TABELA DE PRODUTOS
  // Se tu remover isso, o preço fica desatualizado na tabela principal
  await pool.query(
    `UPDATE Produtos SET PrecoAtual = ?, UpdatedAt = NOW() WHERE Id = ?`,
    [preco, produtoId]
  );

  // Processar alertas se houver produto encontrado
  // ESSA PARTE AQUI É CRÍTICA: processa alertas quando o preço muda
  // Se tu remover isso, usuários não recebem notificações quando o preço baixa
  // E aí o sistema não serve pra nada, porque o objetivo é avisar quando tem promoção
  // O try/catch aqui é importante: se os alertas falharem, não deve quebrar o salvamento do preço
  if (produto) {
    try {
      await processAlerts(produto, preco, precoAnterior);
    } catch (error) {
      console.error(`[HISTORICO] Erro ao processar alertas para produto ${produtoId}:`, error);
      // Não falhar a inserção se os alertas falharem
      // ESSA DECISão AQUI É IMPORTANTE: prefere salvar o preço mesmo se alerta falhar
      // Porque é melhor ter preço salvo sem notificação do que perder o preço
    }
  }

  return { skipped: false };
}

export async function ultimoPreco(produtoId) {
  const [rows] = await pool.query(
    `SELECT Preco 
     FROM historicoprecos 
     WHERE ProdutoId = ? 
     ORDER BY DataRegisto DESC 
     LIMIT 1`,
    [produtoId]
  );
  return rows.length ? rows[0].Preco : null;
}
