import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
     .fillColor('#f39c12')
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
 * Função auxiliar para desenhar uma linha horizontal
 */
function drawLine(doc, y, width = 495) {
  doc.strokeColor('#e0e0e0')
     .lineWidth(1)
     .moveTo(50, y)
     .lineTo(50 + width, y)
     .stroke();
}

/**
 * Função auxiliar para desenhar uma célula de tabela
 */
function drawTableCell(doc, x, y, width, height, text, options = {}) {
  const {
    align = 'left',
    fontSize = 10,
    fillColor = '#2d3436',
    backgroundColor = null,
    bold = false
  } = options;

  // Desenhar fundo se especificado
  if (backgroundColor) {
    doc.rect(x, y, width, height)
       .fillColor(backgroundColor)
       .fill();
  }

  // Desenhar borda
  doc.rect(x, y, width, height)
     .strokeColor('#e0e0e0')
     .lineWidth(0.5)
     .stroke();

  // Adicionar texto
  doc.fontSize(fontSize)
     .fillColor(fillColor);
  
  if (bold) {
    doc.font('Helvetica-Bold');
  } else {
    doc.font('Helvetica');
  }

  const padding = 8;
  const textY = y + (height / 2) - (fontSize / 3);
  
  if (align === 'center') {
    doc.text(text, x + padding, textY, {
      width: width - (padding * 2),
      align: 'center'
    });
  } else if (align === 'right') {
    doc.text(text, x + padding, textY, {
      width: width - (padding * 2),
      align: 'right'
    });
  } else {
    doc.text(text, x + padding, textY, {
      width: width - (padding * 2),
      align: 'left'
    });
  }
}

/** Cores e estilo alinhados ao relatório e histórico PromoPing */
const PDF_STYLE = {
  TEXT_PRIMARY: "#1f2d3d",
  TEXT_MUTED: "#6c7a89",
  ACCENT: "#f39c12",
  COMPANY_NAME: "PromoPing"
};

function formatDatePt(date) {
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pdfLinhaHorizontal(doc, x, y, largura) {
  doc.moveTo(x, y).lineTo(x + largura, y).strokeColor("#000").lineWidth(0.5).stroke();
}

function pdfEscreverLinha(doc, x, y, larguras, textos, options = {}) {
  const { bold = false, cor = PDF_STYLE.TEXT_PRIMARY } = options;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(cor);
  let cx = x;
  textos.forEach((txt, i) => {
    const w = larguras[i];
    const align = i === textos.length - 1 ? "right" : "left";
    doc.text(String(txt), cx, y + 2, { width: w, align });
    cx += w;
  });
}

/**
 * Gerar PDF para utilizadores (admin) — mesmo estilo do relatório e histórico PromoPing
 */
export async function gerarPDFUtilizadores(utilizadores) {
  try {
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      info: {
        Title: "PromoPing - Utilizadores",
        Author: PDF_STYLE.COMPANY_NAME,
        Subject: "Relatório de utilizadores",
        Creator: "PromoPing",
        CreationDate: new Date()
      }
    });

    const m = doc.page.margins.left;
    const pageWidth = doc.page.width - m - doc.page.margins.right;
    const pageHeight = doc.page.height;
    const dataEmissao = formatDatePt(new Date());

    // —— Cabeçalho: Utilizadores (esquerda) | PromoPing (direita) ——
    doc.font("Helvetica-Bold").fontSize(28).fillColor(PDF_STYLE.TEXT_PRIMARY);
    doc.text("Utilizadores", m, 50);
    doc.font("Helvetica").fontSize(12).fillColor(PDF_STYLE.TEXT_MUTED);
    doc.text(PDF_STYLE.COMPANY_NAME, m + pageWidth - 80, 50, { width: 80, align: "right" });

    // —— Detalhes ——
    doc.font("Helvetica").fontSize(10).fillColor(PDF_STYLE.TEXT_PRIMARY);
    doc.text("Data de emissão: " + dataEmissao, m, 88);
    doc.text("Total de utilizadores: " + utilizadores.length, m, 104);

    // —— Linha separadora ——
    pdfLinhaHorizontal(doc, m, 128, pageWidth);

    // —— Tabela: cabeçalho + linhas (estilo relatório/histórico, sem bordas de células) ——
    const colWidths = [70, 95, 130, 60, 42, 48, 50];
    const lineHeight = 20;
    let y = 148;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_STYLE.TEXT_PRIMARY);
    pdfEscreverLinha(doc, m, y, colWidths, ["Ref.", "Nome", "Email", "Data", "Prod.", "Notif.", "Status"], { bold: true });
    y += lineHeight;
    pdfLinhaHorizontal(doc, m, y, pageWidth);
    y += 14;

    utilizadores.forEach((user) => {
      if (y > pageHeight - 100) {
        doc.addPage();
        y = m + 20;
        pdfEscreverLinha(doc, m, y, colWidths, ["Ref.", "Nome", "Email", "Data", "Prod.", "Notif.", "Status"], { bold: true });
        y += lineHeight;
        pdfLinhaHorizontal(doc, m, y, pageWidth);
        y += 14;
      }

      const ref = (user.ReferenciaID || "—").substring(0, 12);
      const nome = (user.Nome || "—").substring(0, 22);
      const email = (user.Email || "—").substring(0, 28);
      const data = user.DataRegisto ? formatDatePt(new Date(user.DataRegisto)) : "—";
      const prod = String(user.produtosCount ?? 0);
      const notif = String(user.notificacoesCount ?? 0);
      const status = user.Ativo ? "Ativo" : "Inativo";

      doc.font("Helvetica").fontSize(9).fillColor(PDF_STYLE.TEXT_PRIMARY);
      pdfEscreverLinha(doc, m, y, colWidths, [ref, nome, email, data, prod, notif, status]);
      y += lineHeight;
    });

    pdfLinhaHorizontal(doc, m, y + 6, pageWidth);

    // —— Rodapé (igual ao relatório e histórico) ——
    const footerY = pageHeight - 72;
    doc.font("Helvetica").fontSize(9).fillColor(PDF_STYLE.TEXT_MUTED);
    doc.text("Obrigado por utilizar o PromoPing.", m, footerY, { width: pageWidth, align: "center" });
    doc.text("Monitorização inteligente de preços para consumidores em Portugal.", m, footerY + 12, { width: pageWidth, align: "center" });
    doc.text("Documento gerado eletronicamente.", m, footerY + 24, { width: pageWidth, align: "center" });

    doc.font("Helvetica").fontSize(8).fillColor(PDF_STYLE.TEXT_MUTED);
    doc.text("Utilizadores · " + utilizadores.length + " utilizadores · " + dataEmissao, m, pageHeight - 28, { width: pageWidth, align: "center" });

    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  } catch (error) {
    console.error("Erro ao gerar PDF de utilizadores:", error);
    throw error;
  }
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
