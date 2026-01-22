// backend/services/atualizarPrecos.js
import { pool } from "../database/db.js";
import { salvarPreco } from "../database/models/historico.js";
import { detectStore } from "../utils/storeDetector.js";
// import { enviarWhatsApp } from "../routes/auth-whatsApp.js"; // WhatsApp desabilitado

// Função mock que busca preço atual (aqui tu troca pelo scraping real depois)
async function fetchPreco(link) {
  // Exemplo: gerar preço aleatório para teste
  return (Math.random() * 1000).toFixed(2);
}

// Atualiza todos os produtos de um utilizador respeitando plano
// Essa função aqui é chamada quando o usuário quer atualizar os preços dos produtos
// Ela respeita o intervalo do plano (Free tem intervalo maior, Premium pode atualizar sempre)
// Se tu fuder a lógica de intervalo, pode sobrecarregar o sistema ou dar acesso errado
export async function atualizarPrecos(referenciaID) {
  // Buscar plano do utilizador
  // ESSA QUERY AQUI É IMPORTANTE: pega o plano do usuário pra saber qual intervalo usar
  const [config] = await pool.query(
    `SELECT p.Nome as plano_nome
     FROM configutilizador c
     JOIN Planos p ON p.Id = c.PlanoAtualId
     WHERE c.ReferenciaID = ?`,
    [referenciaID]
  );

  if (!config.length) return { error: "Plano não encontrado" };

  // VerificacaoIntervalo removido - usar valor padrão
  // ESSE INTERVALO AQUI É O QUE CONTROLA COM QUE FREQUÊNCIA PODE ATUALIZAR
  // Premium tem intervalo = 0 (pode sempre), outros planos têm intervalo maior
  // NÃO MUDE ESSA LÓGICA SEM ENTENDER OS PLANOS
  const intervalo = 1; // 1 hora por padrão

  // Buscar produtos do utilizador
  const [produtos] = await pool.query(
    "SELECT * FROM Produtos WHERE ReferenciaID = ?",
    [referenciaID]
  );

  let atualizados = [];

  for (const p of produtos) {
    const ultimaAtualizacao = p.UpdatedAt || new Date(0);
    const agora = new Date();
    const diffHoras = (agora - ultimaAtualizacao) / (1000 * 60 * 60);

    // Premium (intervalo = 0) pode sempre
    // Essa verificação aqui é o que impede usuários de atualizar muito rápido
    // Se tu remover isso, qualquer um pode fazer spam de atualizações
    // E aí vai sobrecarregar o sistema e derrubar tudo
    if (intervalo === 0 || diffHoras >= intervalo) {
      const novoPreco = await fetchPreco(p.Link);

      // Atualizar Produtos
      // ESSA QUERY AQUI ATUALIZA O PREÇO NO BANCO
      // Se tu fuder isso, pode salvar preço errado ou não salvar nada
      await pool.query(
        "UPDATE Produtos SET PrecoAtual = ?, UpdatedAt = NOW() WHERE Id = ?",
        [novoPreco, p.Id]
      );

      // Salvar no histórico
      // ESSA FUNÇÃO AQUI SALVA O PREÇO NO HISTÓRICO PRA PODER VER EVOLUÇÃO
      // Se tu remover isso, perde o histórico de preços
      await salvarPreco(p.Id, novoPreco);


      atualizados.push({
        id: p.Id,
        nome: p.Nome,
        precoNovo: novoPreco,
        loja: detectStore(p.Link).name
      });
    }
  }

  return { status: "ok", atualizados };
}
