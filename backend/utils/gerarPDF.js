// ================== UTILITÁRIO PARA GERAR PDF ==================

import PDFDocument from "pdfkit";

/**
 * Gerar arquivo PDF com dados de produtos
 * @param {Array} produtos - Array de produtos
 * @param {Array} historico - Array de histórico de preços
 * @param {string} userPlano - Plano do usuário
 * @returns {Buffer} Buffer do arquivo PDF
 */
export async function gerarPDF(produtos, historico = [], userPlano = "Free") {
  try {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Relatório PromoPing - Produtos`,
        Author: 'PromoPing',
        Subject: `Relatório de produtos para plano ${userPlano}`,
        Creator: 'PromoPing System',
        CreationDate: new Date()
      }
    });

    return await gerarPDFProdutos(doc, produtos, historico, userPlano);
    
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    throw error;
  }
}

/**
 * Gerar PDF para produtos
 */
async function gerarPDFProdutos(doc, produtos, historico, userPlano) {
  // Cabeçalho
  doc.fontSize(24)
     .fillColor('#0984e3')
     .text('Relatório de Produtos Monitorizados', { align: 'center' });
  
  doc.fontSize(16)
     .fillColor('#2d3436')
     .text('PromoPing', { align: 'center' });
  
  doc.moveDown(2);

  // Informações do relatório
  const totalRegistrosHistorico = historico.reduce((acc, h) => acc + h.totalRegistros, 0);
  const resumoHistorico = userPlano === "Premium" 
    ? "Exportação completa com histórico e estatísticas"
    : userPlano === "Standard"
    ? "Exportação completa com histórico"
    : userPlano === "Basic"
    ? "Exportação simplificada (últimos 30 dias)"
    : "Exportação básica sem histórico";

  doc.fontSize(12)
     .fillColor('#636e72')
     .text(`Plano: ${userPlano}`, { align: 'left' })
     .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'left' })
     .text(`Total de produtos: ${produtos.length}`, { align: 'left' })
     .text(`Registros de histórico: ${totalRegistrosHistorico}`, { align: 'left' })
     .text(`Tipo: ${resumoHistorico}`, { align: 'left' });
  
  doc.moveDown(2);

  // Lista de produtos com histórico
  produtos.forEach((produto, index) => {
    // Verificar se precisa de nova página
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    }

    // Cabeçalho do produto
    doc.fontSize(14)
       .fillColor('#2d3436')
       .text(`${index + 1}. ${produto.Nome}`, { underline: true });
    
    doc.moveDown(0.5);
    
    // Informações básicas do produto
    doc.fontSize(11)
       .fillColor('#333')
       .text(`Loja: ${produto.Loja}`)
       .text(`Preço Atual: €${produto.PrecoAtual || '—'}`)
       .text(`Preço Alvo: €${produto.PrecoAlvo || '—'}`)
       .text(`Status: ${produto.Status || 'Ativo'}`)
       .text(`Link: ${produto.Link}`)
       .text(`Data de Registo: ${new Date(produto.DataCriacao).toLocaleDateString('pt-BR')}`);
    
    doc.moveDown(0.5);

    // Histórico de preços se disponível
    const hist = historico.find((h) => h.produtoId === produto.Id);
    if (hist && hist.registos.length > 0) {
      doc.fontSize(12)
         .fillColor('#703F00')
         .text(`Histórico de Preços (${hist.totalRegistros} registros):`);
      
      // Mostrar apenas os primeiros 10 registros para não sobrecarregar o PDF
      const registrosParaMostrar = hist.registos.slice(0, 10);
      
      registrosParaMostrar.forEach((registro) => {
        doc.fontSize(10)
           .fillColor('#555')
           .text(`  • ${new Date(registro.Data).toLocaleDateString('pt-BR')}: €${parseFloat(registro.Preco).toFixed(2)} (${registro.Loja || produto.Loja})`);
      });
      
      if (hist.registos.length > 10) {
        doc.fontSize(9)
           .fillColor('#999')
           .text(`  ... e mais ${hist.registos.length - 10} registros`);
      }
    } else {
      doc.fontSize(10)
         .fillColor('#999')
         .text('Sem histórico de preços disponível');
    }
    
    doc.moveDown(1);
  });

  // Rodapé com informações do plano
  doc.moveDown(2);
  doc.fontSize(10)
     .fillColor('#777')
     .text(`Plano: ${userPlano} — ${resumoHistorico}`, { align: 'center' });
  
  doc.fontSize(8)
     .fillColor('#636e72')
     .text('Relatório gerado pelo PromoPing', { align: 'center' });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Gerar PDF para incidentes
 */
async function gerarPDFIncidentes(doc, incidentes, userPlano) {
  // Cabeçalho
  doc.fontSize(24)
     .fillColor('#00b894')
     .text('Relatório de Incidentes', { align: 'center' });
  
  doc.fontSize(16)
     .fillColor('#2d3436')
     .text('PromoPing', { align: 'center' });
  
  doc.moveDown(2);

  // Informações do relatório
  doc.fontSize(12)
     .fillColor('#636e72')
     .text(`Plano: ${userPlano}`, { align: 'left' })
     .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'left' })
     .text(`Total de incidentes: ${incidentes.length}`, { align: 'left' });
  
  doc.moveDown(2);

  // Lista de incidentes
  incidentes.forEach((incidente, index) => {
    // Verificar se precisa de nova página
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    }

    doc.fontSize(14)
       .fillColor('#2d3436')
       .text(`${index + 1}. ${incidente.Titulo}`, { underline: true });
    
    doc.moveDown(0.5);
    
    doc.fontSize(10)
       .fillColor('#636e72')
       .text(`Status: ${incidente.Status}`, { continued: true })
       .text(` | Data: ${new Date(incidente.DataInicio).toLocaleDateString('pt-BR')}`, { continued: true })
       .text(` | Componente: ${incidente.Componente || '—'}`);
    
    if (incidente.Descricao) {
      doc.moveDown(0.3);
      doc.text(`Descrição: ${incidente.Descricao}`, { width: 500 });
    }
    
    if (incidente.Impacto) {
      doc.moveDown(0.3);
      doc.text(`Impacto: ${incidente.Impacto}`, { width: 500 });
    }
    
    doc.moveDown(1);
  });

  // Rodapé
  doc.fontSize(8)
     .fillColor('#636e72')
     .text('Relatório gerado pelo PromoPing', 50, doc.page.height - 30, { align: 'center' });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Gerar PDF para relatório completo (Premium)
 */
async function gerarPDFRelatorioCompleto(doc, dados, userPlano) {
  // Cabeçalho
  doc.fontSize(24)
     .fillColor('#2d3436')
     .text('Relatório Executivo Completo', { align: 'center' });
  
  doc.fontSize(16)
     .fillColor('#0984e3')
     .text('PromoPing', { align: 'center' });
  
  doc.moveDown(2);

  // Resumo Executivo
  doc.fontSize(16)
     .fillColor('#2d3436')
     .text('Resumo Executivo', { underline: true });
  
  doc.moveDown(1);
  
  const resumoData = [
    { label: 'Total de Produtos Monitorizados', value: dados.produtos.length },
    { label: 'Total de Incidentes Registrados', value: dados.incidentes.length },
    { label: 'Uptime Geral do Sistema', value: `${dados.metricas.UptimeGeral || 0}%` },
    { label: 'Usuários Ativos', value: dados.metricas.UtilizadoresAtivos || 0 },
    { label: 'Plano de Assinatura', value: userPlano }
  ];

  resumoData.forEach(item => {
    doc.fontSize(12)
       .fillColor('#2d3436')
       .text(`${item.label}:`, { continued: true })
       .fillColor('#0984e3')
       .text(` ${item.value}`);
    doc.moveDown(0.5);
  });

  doc.moveDown(2);

  // Seção de Produtos
  doc.fontSize(16)
     .fillColor('#2d3436')
     .text('Produtos Monitorizados', { underline: true });
  
  doc.moveDown(1);

  dados.produtos.slice(0, 10).forEach((produto, index) => {
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }

    doc.fontSize(12)
       .fillColor('#2d3436')
       .text(`${index + 1}. ${produto.Nome}`);
    
    doc.fontSize(10)
       .fillColor('#636e72')
       .text(`Loja: ${produto.Loja} | Preço Atual: €${produto.PrecoAtual || '—'} | Preço Alvo: €${produto.PrecoAlvo || '—'}`);
    
    doc.moveDown(0.5);
  });

  if (dados.produtos.length > 10) {
    doc.moveDown(1);
    doc.fontSize(10)
       .fillColor('#636e72')
       .text(`... e mais ${dados.produtos.length - 10} produtos`);
  }

  doc.moveDown(2);

  // Seção de Incidentes
  doc.fontSize(16)
     .fillColor('#2d3436')
     .text('Incidentes Recentes', { underline: true });
  
  doc.moveDown(1);

  dados.incidentes.slice(0, 5).forEach((incidente, index) => {
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }

    doc.fontSize(12)
       .fillColor('#2d3436')
       .text(`${index + 1}. ${incidente.Titulo}`);
    
    doc.fontSize(10)
       .fillColor('#636e72')
       .text(`Status: ${incidente.Status} | Data: ${new Date(incidente.DataInicio).toLocaleDateString('pt-BR')}`);
    
    if (incidente.Descricao) {
      doc.text(`Descrição: ${incidente.Descricao}`, { width: 500 });
    }
    
    doc.moveDown(0.5);
  });

  // Rodapé
  doc.fontSize(8)
     .fillColor('#636e72')
     .text('Relatório Executivo gerado pelo PromoPing', 50, doc.page.height - 30, { align: 'center' });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
