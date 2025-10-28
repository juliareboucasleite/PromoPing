// ================== UTILITÁRIO PARA GERAR EXCEL ==================

import ExcelJS from "exceljs";

/**
 * Gerar arquivo Excel com dados de produtos
 * @param {Array} produtos - Array de produtos
 * @param {Array} historico - Array de histórico de preços
 * @param {string} userPlano - Plano do usuário
 * @returns {Buffer} Buffer do arquivo Excel
 */
export async function gerarExcel(produtos, historico = [], userPlano = "Free") {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Configurar propriedades do workbook
    workbook.creator = "PromoPing";
    workbook.lastModifiedBy = "PromoPing";
    workbook.created = new Date();
    workbook.modified = new Date();
    
    return await gerarExcelProdutos(workbook, produtos, historico, userPlano);
    
  } catch (error) {
    console.error(" Erro ao gerar Excel:", error);
    throw error;
  }
}

/**
 * Gerar Excel para produtos com histórico inteligente
 */
async function gerarExcelProdutos(workbook, produtos, historico, userPlano) {
  const sheet = workbook.addWorksheet("Produtos PromoPing");
  
  // Cabeçalhos principais
  sheet.columns = [
    { header: "Produto", key: "Nome", width: 35 },
    { header: "Loja", key: "Loja", width: 20 },
    { header: "Preço Atual (€)", key: "PrecoAtual", width: 18 },
    { header: "Preço Alvo (€)", key: "PrecoAlvo", width: 18 },
    { header: "Status", key: "Status", width: 15 },
    { header: "Link", key: "Link", width: 50 },
    { header: "Data Registo", key: "DataCriacao", width: 20 }
  ];

  // Adicionar dados dos produtos
  produtos.forEach((produto) => {
    sheet.addRow({
      Nome: produto.Nome,
      Loja: produto.Loja,
      PrecoAtual: produto.PrecoAtual ? `€${produto.PrecoAtual}` : "—",
      PrecoAlvo: produto.PrecoAlvo ? `€${produto.PrecoAlvo}` : "—",
      Status: produto.Status || "Ativo",
      Link: produto.Link,
      DataCriacao: new Date(produto.DataCriacao).toLocaleString("pt-BR")
    });
  });

  // Adicionar histórico se disponível
  if (historico && historico.length > 0) {
    // Quebra entre seções
    sheet.addRow([]);
    sheet.addRow(["Histórico de Preços"]);
    sheet.lastRow.font = { bold: true, size: 14, color: { argb: "FF703F" } };
    sheet.addRow([]);

    // Histórico detalhado por produto
    historico.forEach(({ produtoId, registos, totalRegistros }) => {
      const produto = produtos.find((p) => p.Id === produtoId);
      
      if (produto && registos.length > 0) {
        // Cabeçalho do produto
        sheet.addRow([` ${produto.Nome} (${totalRegistros} registros)`, "", "", "", "", "", ""]);
        sheet.lastRow.font = { bold: true, color: { argb: "FF703F" } };

        // Cabeçalho da tabela de histórico
        sheet.addRow(["Data", "Preço (€)", "Loja", "", "", "", ""]);
        sheet.lastRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.lastRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF703F" }
        };

        // Dados do histórico
        registos.forEach((registro) => {
          sheet.addRow([
            new Date(registro.Data).toLocaleDateString("pt-BR"),
            `€${parseFloat(registro.Preco).toFixed(2)}`,
            registro.Loja || produto.Loja,
            "", "", "", ""
          ]);
        });

        // Linha separadora
        sheet.addRow([]);
      }
    });
  }

  // Estilizar cabeçalho principal
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0984E3" }
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // Adicionar informações do relatório
  const totalRegistrosHistorico = historico.reduce((acc, h) => acc + h.totalRegistros, 0);
  const resumoHistorico = userPlano === "Premium" 
    ? "Exportação completa com histórico e estatísticas"
    : userPlano === "Standard"
    ? "Exportação completa com histórico"
    : userPlano === "Basic"
    ? "Exportação simplificada (últimos 30 dias)"
    : "Exportação básica sem histórico";

  const infoRow = sheet.insertRow(1, [
    `Relatório de Produtos - PromoPing`,
    `Plano: ${userPlano}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Total de produtos: ${produtos.length}`,
    `Registros de histórico: ${totalRegistrosHistorico}`,
    `Tipo: ${resumoHistorico}`
  ]);
  
  infoRow.font = { bold: true, size: 10 };
  infoRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F0F0" }
  };

  // Rodapé com informações do plano
  sheet.addRow([]);
  sheet.addRow([`Plano: ${userPlano} — ${resumoHistorico}`]);
  sheet.lastRow.font = { italic: true, color: { argb: "555555" } };

  // Aplicar bordas
  aplicarBordas(sheet);
  
  return await workbook.xlsx.writeBuffer();
}

/**
 * Gerar Excel para incidentes
 */
async function gerarExcelIncidentes(workbook, incidentes, userPlano) {
  const sheet = workbook.addWorksheet("Incidentes PromoPing");
  
  // Configurar colunas
  sheet.columns = [
    { header: "ID", key: "Id", width: 8 },
    { header: "Título", key: "Titulo", width: 35 },
    { header: "Descrição", key: "Descricao", width: 40 },
    { header: "Impacto", key: "Impacto", width: 30 },
    { header: "Data de Início", key: "DataInicio", width: 20 },
    { header: "Data de Fim", key: "DataFim", width: 20 },
    { header: "Estado", key: "Status", width: 15 },
    { header: "Componente", key: "Componente", width: 25 }
  ];

  // Adicionar dados
  incidentes.forEach((incidente) => {
    sheet.addRow({
      Id: incidente.Id,
      Titulo: incidente.Titulo,
      Descricao: incidente.Descricao || '—',
      Impacto: incidente.Impacto || '—',
      DataInicio: new Date(incidente.DataInicio).toLocaleString("pt-BR"),
      DataFim: incidente.DataFim 
        ? new Date(incidente.DataFim).toLocaleString("pt-BR")
        : "—",
      Status: incidente.Status,
      Componente: incidente.Componente || "—"
    });
  });

  // Estilizar cabeçalho
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00B894" }
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // Adicionar informações do relatório
  const infoRow = sheet.insertRow(1, [
    `Relatório de Incidentes - PromoPing`,
    `Plano: ${userPlano}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Total de incidentes: ${incidentes.length}`,
    `Período: ${incidentes.length > 0 ? 
      new Date(Math.min(...incidentes.map(i => new Date(i.DataInicio)))).toLocaleDateString("pt-BR") + 
      ' a ' + 
      new Date(Math.max(...incidentes.map(i => new Date(i.DataInicio)))).toLocaleDateString("pt-BR")
      : 'N/A'}`
  ]);
  
  infoRow.font = { bold: true, size: 10 };
  infoRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F0F0" }
  };

  // Aplicar bordas
  aplicarBordas(sheet);
  
  return await workbook.xlsx.writeBuffer();
}

/**
 * Gerar Excel para relatório completo (Premium)
 */
async function gerarExcelRelatorioCompleto(workbook, dados, userPlano) {
  // Aba 1: Resumo Executivo
  const resumoSheet = workbook.addWorksheet("Resumo Executivo");
  resumoSheet.columns = [
    { header: "Métrica", key: "metrica", width: 30 },
    { header: "Valor", key: "valor", width: 20 },
    { header: "Descrição", key: "descricao", width: 40 }
  ];

  const resumoData = [
    { metrica: "Total de Produtos", valor: dados.produtos.length, descricao: "Produtos monitorizados" },
    { metrica: "Total de Incidentes", valor: dados.incidentes.length, descricao: "Incidentes registrados" },
    { metrica: "Uptime Geral", valor: `${dados.metricas.UptimeGeral || 0}%`, descricao: "Disponibilidade do sistema" },
    { metrica: "Usuários Ativos", valor: dados.metricas.UtilizadoresAtivos || 0, descricao: "Usuários ativos no sistema" },
    { metrica: "Plano Atual", valor: userPlano, descricao: "Plano de assinatura" }
  ];

  resumoData.forEach(row => resumoSheet.addRow(row));

  // Aba 2: Produtos
  const produtosSheet = workbook.addWorksheet("Produtos");
  produtosSheet.columns = [
    { header: "Nome", key: "Nome", width: 35 },
    { header: "Loja", key: "Loja", width: 20 },
    { header: "Preço Atual", key: "PrecoAtual", width: 18 },
    { header: "Preço Alvo", key: "PrecoAlvo", width: 18 },
    { header: "Status", key: "Status", width: 15 }
  ];

  dados.produtos.forEach(produto => {
    produtosSheet.addRow({
      Nome: produto.Nome,
      Loja: produto.Loja,
      PrecoAtual: produto.PrecoAtual ? `€${produto.PrecoAtual}` : "—",
      PrecoAlvo: produto.PrecoAlvo ? `€${produto.PrecoAlvo}` : "—",
      Status: produto.Status || "Ativo"
    });
  });

  // Aba 3: Incidentes
  const incidentesSheet = workbook.addWorksheet("Incidentes");
  incidentesSheet.columns = [
    { header: "Título", key: "Titulo", width: 35 },
    { header: "Status", key: "Status", width: 15 },
    { header: "Data Início", key: "DataInicio", width: 20 },
    { header: "Componente", key: "Componente", width: 25 }
  ];

  dados.incidentes.forEach(incidente => {
    incidentesSheet.addRow({
      Titulo: incidente.Titulo,
      Status: incidente.Status,
      DataInicio: new Date(incidente.DataInicio).toLocaleString("pt-BR"),
      Componente: incidente.Componente || "—"
    });
  });

  // Estilizar todas as abas
  [resumoSheet, produtosSheet, incidentesSheet].forEach(sheet => {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2D3436" }
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    
    aplicarBordas(sheet);
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Aplicar bordas em todas as células
 */
function aplicarBordas(sheet) {
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
      if (rowNumber > 1) {
        cell.alignment = { vertical: "top", wrapText: true };
      }
    });
  });
}
