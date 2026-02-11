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

/**
 * Gerar PDF para utilizadores (admin) - Versão profissional
 */
export async function gerarPDFUtilizadores(utilizadores) {
  try {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: `Relatório PromoPing - Utilizadores`,
        Author: 'PromoPing Admin',
        Subject: `Relatório de utilizadores ativos`,
        Creator: 'PromoPing Admin System',
        CreationDate: new Date()
      }
    });

    // Tentar carregar a logo
    let logoPath = path.join(__dirname, '../../admin.promoping/assets/images/PromoPing.png');
    if (!fs.existsSync(logoPath)) {
      logoPath = path.join(__dirname, '../../frontend/pages/build/assets/images/PromoPing.png');
    }

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    let yPosition = margin;

    // Logo e título
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, margin, yPosition, { 
          width: 60,
          height: 60,
          fit: [60, 60]
        });
      } catch (err) {
        console.warn("Erro ao carregar logo:", err.message);
      }
    }

    // Título principal
    doc.fontSize(28)
       .fillColor('#f39c12')
       .font('Helvetica-Bold')
       .text('Relatório de Utilizadores', margin + 70, yPosition + 10, {
         width: contentWidth - 70,
         align: 'left'
       });

    doc.fontSize(14)
       .fillColor('#636e72')
       .font('Helvetica')
       .text('PromoPing Admin', margin + 70, yPosition + 40, {
         width: contentWidth - 70,
         align: 'left'
       });

    yPosition += 80;

    // Linha separadora
    drawLine(doc, yPosition, contentWidth);
    yPosition += 20;

    const infoBoxY = yPosition;
    doc.rect(margin, infoBoxY, contentWidth, 60)
       .fillColor('#f8f9fa')
       .fill()
       .strokeColor('#e0e0e0')
       .lineWidth(1)
       .stroke();

    const dataGeracao = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    doc.fontSize(11)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text('Informações do Relatório', margin + 15, infoBoxY + 10);

    doc.fontSize(10)
       .fillColor('#636e72')
       .font('Helvetica')
       .text(`Data de Geração: ${dataGeracao}`, margin + 15, infoBoxY + 30)
       .text(`Total de Utilizadores: ${utilizadores.length}`, margin + 15, infoBoxY + 45);

    doc.text(`Status: Todos Ativos`, margin + 300, infoBoxY + 30)
       .text(`Versão: 1.0`, margin + 300, infoBoxY + 45);

    yPosition += 90;

    const tableStartY = yPosition;
    const rowHeight = 30;
    const headerHeight = 35;
    // Ajustar larguras para caber em A4 (contentWidth = 495)
    const colWidths = {
      ref: 75,
      nome: 90,
      email: 110,
      data: 65,
      produtos: 45,
      notificacoes: 55,
      status: 55
    };
    
    // Verificar se a soma das colunas cabe
    const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
    if (totalWidth > contentWidth) {
      // Ajustar proporcionalmente se necessário
      const scale = contentWidth / totalWidth;
      Object.keys(colWidths).forEach(key => {
        colWidths[key] = Math.floor(colWidths[key] * scale);
      });
    }

    // Cabeçalho da tabela
    let xPos = margin;
    doc.rect(xPos, tableStartY, contentWidth, headerHeight)
       .fillColor('#0984e3')
       .fill()
       .strokeColor('#0984e3')
       .lineWidth(1)
       .stroke();

    drawTableCell(doc, xPos, tableStartY, colWidths.ref, headerHeight, 'Ref.', {
      align: 'center',
      fontSize: 10,
      fillColor: '#ffffff',
      bold: true
    });
    xPos += colWidths.ref;

    drawTableCell(doc, xPos, tableStartY, colWidths.nome, headerHeight, 'Nome', {
      align: 'left',
      fontSize: 10,
      fillColor: '#ffffff',
      bold: true
    });
    xPos += colWidths.nome;

    drawTableCell(doc, xPos, tableStartY, colWidths.email, headerHeight, 'Email', {
      align: 'left',
      fontSize: 10,
      fillColor: '#ffffff',
      bold: true
    });
    xPos += colWidths.email;

    drawTableCell(doc, xPos, tableStartY, colWidths.data, headerHeight, 'Data', {
      align: 'center',
      fontSize: 10,
      fillColor: '#ffffff',
      bold: true
    });
    xPos += colWidths.data;

    drawTableCell(doc, xPos, tableStartY, colWidths.produtos, headerHeight, 'Prod.', {
      align: 'center',
      fontSize: 10,
      fillColor: '#ffffff',
      bold: true
    });
    xPos += colWidths.produtos;

    drawTableCell(doc, xPos, tableStartY, colWidths.notificacoes, headerHeight, 'Notif.', {
      align: 'center',
      fontSize: 11,
      fillColor: '#ffffff',
      bold: true
    });
    xPos += colWidths.notificacoes;

    drawTableCell(doc, xPos, tableStartY, colWidths.status, headerHeight, 'Status', {
      align: 'center',
      fontSize: 11,
      fillColor: '#ffffff',
      bold: true
    });

    // Linhas da tabela
    let currentY = tableStartY + headerHeight;
    utilizadores.forEach((user, index) => {
      // Verificar se precisa de nova página
      if (currentY + rowHeight > pageHeight - 80) {
        doc.addPage();
        currentY = margin;
        
        // Redesenhar cabeçalho da tabela
        xPos = margin;
        doc.rect(xPos, currentY, contentWidth, headerHeight)
           .fillColor('#0984e3')
           .fill()
           .strokeColor('#0984e3')
           .lineWidth(1)
           .stroke();

        drawTableCell(doc, xPos, currentY, colWidths.ref, headerHeight, 'Ref.', {
          align: 'center',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });
        xPos += colWidths.ref;

        drawTableCell(doc, xPos, currentY, colWidths.nome, headerHeight, 'Nome', {
          align: 'left',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });
        xPos += colWidths.nome;

        drawTableCell(doc, xPos, currentY, colWidths.email, headerHeight, 'Email', {
          align: 'left',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });
        xPos += colWidths.email;

        drawTableCell(doc, xPos, currentY, colWidths.data, headerHeight, 'Data', {
          align: 'center',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });
        xPos += colWidths.data;

        drawTableCell(doc, xPos, currentY, colWidths.produtos, headerHeight, 'Prod.', {
          align: 'center',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });
        xPos += colWidths.produtos;

        drawTableCell(doc, xPos, currentY, colWidths.notificacoes, headerHeight, 'Notif.', {
          align: 'center',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });
        xPos += colWidths.notificacoes;

        drawTableCell(doc, xPos, currentY, colWidths.status, headerHeight, 'Status', {
          align: 'center',
          fontSize: 10,
          fillColor: '#ffffff',
          bold: true
        });

        currentY += headerHeight;
      }

      // Alternar cor de fundo das linhas
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
      
      xPos = margin;
      // Truncar referência se necessário
      const ref = user.ReferenciaID || 'N/A';
      const refDisplay = ref.length > 12 ? ref.substring(0, 9) + '...' : ref;
      drawTableCell(doc, xPos, currentY, colWidths.ref, rowHeight, refDisplay, {
        align: 'center',
        fontSize: 8,
        backgroundColor: bgColor
      });
      xPos += colWidths.ref;

      // Truncar nome se necessário
      const nome = user.Nome || 'N/A';
      const nomeDisplay = nome.length > 15 ? nome.substring(0, 12) + '...' : nome;
      drawTableCell(doc, xPos, currentY, colWidths.nome, rowHeight, nomeDisplay, {
        align: 'left',
        fontSize: 8,
        backgroundColor: bgColor
      });
      xPos += colWidths.nome;

      // Truncar email se muito longo (ajustado para coluna menor)
      const email = user.Email || 'N/A';
      const emailDisplay = email.length > 18 ? email.substring(0, 15) + '...' : email;
      drawTableCell(doc, xPos, currentY, colWidths.email, rowHeight, emailDisplay, {
        align: 'left',
        fontSize: 8,
        backgroundColor: bgColor
      });
      xPos += colWidths.email;

      // Data formatada de forma mais compacta
      const dataRegisto = user.DataRegisto 
        ? new Date(user.DataRegisto).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : 'N/A';
      drawTableCell(doc, xPos, currentY, colWidths.data, rowHeight, dataRegisto, {
        align: 'center',
        fontSize: 8,
        backgroundColor: bgColor
      });
      xPos += colWidths.data;

      drawTableCell(doc, xPos, currentY, colWidths.produtos, rowHeight, String(user.produtosCount || 0), {
        align: 'center',
        fontSize: 8,
        backgroundColor: bgColor
      });
      xPos += colWidths.produtos;

      drawTableCell(doc, xPos, currentY, colWidths.notificacoes, rowHeight, String(user.notificacoesCount || 0), {
        align: 'center',
        fontSize: 8,
        backgroundColor: bgColor
      });
      xPos += colWidths.notificacoes;

      const statusText = user.Ativo ? 'Ativo' : 'Inativo';
      const statusColor = user.Ativo ? '#10b981' : '#ef4444';
      drawTableCell(doc, xPos, currentY, colWidths.status, rowHeight, statusText, {
        align: 'center',
        fontSize: 8,
        fillColor: statusColor,
        backgroundColor: bgColor,
        bold: true
      });

      currentY += rowHeight;
    });

    const footerY = pageHeight - 50;
    drawLine(doc, footerY - 20, contentWidth);
    
    doc.fontSize(9)
       .fillColor('#636e72')
       .font('Helvetica')
       .text(`Total de ${utilizadores.length} utilizadores ativos`, margin, footerY - 10, {
         width: contentWidth,
         align: 'left'
       });

    doc.fontSize(8)
       .fillColor('#999')
       .text('Relatório gerado automaticamente pelo PromoPing Admin', margin, footerY, {
         width: contentWidth,
         align: 'right'
       });

    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
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
