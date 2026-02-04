/**
 * Serviço de PDF de Histórico: documento simples, sem gráficos.
 * Usa os mesmos dados que o relatório (relatorioData) mas com layout reduzido.
 */

import PDFDocument from "pdfkit";
import { obterDadosRelatorio } from "./relatorioData.js";

const TEXT_PRIMARY = "#1f2d3d";
const TEXT_MUTED = "#6c7a89";
const ACCENT = "#f39c12";
const COMPANY = {
    name: "PromoPing",
    address: "Europa\n3030-243 Coimbra, Distrito de Coimbra\nPortugal",
    phone: "+351 933 992 199"
};

function formatCurrency(amount) {
    const val = Number(amount) || 0;
    return val.toFixed(2).replace(".", ",") + " €";
}

function formatDatePt(date) {
    return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatRange(start, end) {
    return `${formatDatePt(start)} a ${formatDatePt(end)}`;
}

function escreverLinha(doc, x, y, larguras, textos, options = {}) {
    const { bold = false, cor = TEXT_PRIMARY } = options;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(cor);
    let cx = x;
    textos.forEach((txt, i) => {
        const w = larguras[i];
        const align = i === textos.length - 1 ? "right" : "left";
        doc.text(String(txt), cx, y + 2, { width: w, align });
        cx += w;
    });
}

function linhaHorizontal(doc, x, y, largura) {
    doc.moveTo(x, y).lineTo(x + largura, y).strokeColor("#000").lineWidth(0.5).stroke();
}

/**
 * Gera PDF de Histórico: título "Histórico", sem resumo em caixas e sem gráficos.
 * Apenas cabeçalho, dados, valor poupado, tabela de itens e totais.
 */
function criarPdfHistorico({ user, periodo, produtos, totais }) {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const m = doc.page.margins.left;
    const pageWidth = doc.page.width - m - doc.page.margins.right;
    const dataEmissao = formatDatePt(new Date());
    const periodoStr = formatRange(periodo.inicio, periodo.fim);
    const valorPoupadoStr = formatCurrency(totais.poupado);

    // —— Cabeçalho: Histórico (esquerda) | PromoPing (direita) ——
    doc.font("Helvetica-Bold").fontSize(28).fillColor(TEXT_PRIMARY);
    doc.text("Histórico", m, 50);
    doc.font("Helvetica").fontSize(12).fillColor(TEXT_MUTED);
    doc.text(COMPANY.name, m + pageWidth - 80, 50, { width: 80, align: "right" });

    // —— Detalhes ——
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text("Data de emissão: " + dataEmissao, m, 88);
    doc.text("Período analisado: " + periodoStr, m, 104);

    // —— Empresa (esquerda) | Conta para (direita) ——
    const col1X = m;
    const col2X = m + pageWidth * 0.5;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text(COMPANY.name, col1X, 140);
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.text(COMPANY.address, col1X, 155, { width: 220 });
    doc.text(COMPANY.phone, col1X, 200);

    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text("Conta para", col2X, 140);
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_PRIMARY);
    doc.text(user.nome || "—", col2X, 155, { width: 220 });
    doc.text(user.email || "—", col2X, 170, { width: 220 });
    doc.text("Plano: " + (user.plano || "—"), col2X, 185, { width: 220 });
    doc.text("Membro desde: " + formatDatePt(user.membroDesde), col2X, 200, { width: 220 });

    // —— Valor poupado (destaque) ——
    doc.font("Helvetica-Bold").fontSize(14).fillColor(TEXT_PRIMARY);
    doc.text(valorPoupadoStr + " poupado no período (" + periodoStr + ")", m, 240, { width: pageWidth });

    // —— Nota ——
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.text("Histórico de monitorização de preços no PromoPing. Para esclarecimentos: corporation.promoping@gmail.com", m, 258, { width: pageWidth });

    linhaHorizontal(doc, m, 282, pageWidth);

    // —— Tabela de itens (sem gráficos, sem resumo em caixas) ——
    let y = 298;
    const colWidths = [220, 50, 90, 95];
    const lineHeight = 20;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    escreverLinha(doc, m, y, colWidths, ["Descrição", "Qtd.", "Preço unitário", "Montante"], { bold: true });
    y += lineHeight;
    linhaHorizontal(doc, m, y, pageWidth);
    y += 14;

    produtos.forEach((p) => {
        if (y > doc.page.height - 120) {
            doc.addPage();
            y = m + 10;
        }
        const desc = (p.nome || "—") + " (" + (p.loja || "—") + ")";
        escreverLinha(doc, m, y, colWidths, [desc, "1", formatCurrency(p.precoAtual), formatCurrency(p.poupanca)]);
        y += lineHeight;
    });

    linhaHorizontal(doc, m, y + 6, pageWidth);

    // —— Totais ——
    const totalsX = m + pageWidth - 200;
    let totalsY = y + 28;
    if (totalsY > doc.page.height - 140) {
        doc.addPage();
        totalsY = m + 20;
    }
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_MUTED);
    doc.text("Subtotal:", totalsX, totalsY, { width: 90 });
    doc.text(valorPoupadoStr, totalsX + 100, totalsY, { width: 100, align: "right" });
    totalsY += 18;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text("Total poupado:", totalsX, totalsY, { width: 90 });
    doc.fillColor(ACCENT);
    doc.text(valorPoupadoStr, totalsX + 100, totalsY, { width: 100, align: "right" });

    // —— Rodapé ——
    const footerY = doc.page.height - 72;
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.fillColor(TEXT_MUTED);
    doc.text("Obrigado por utilizar o PromoPing.", m, footerY, { width: pageWidth, align: "center" });
    doc.text("Monitorização inteligente de preços para consumidores em Portugal.", m, footerY + 12, { width: pageWidth, align: "center" });
    doc.text("Documento gerado eletronicamente.", m, footerY + 24, { width: pageWidth, align: "center" });

    doc.font("Helvetica").fontSize(8).fillColor(TEXT_MUTED);
    doc.text("Histórico · " + valorPoupadoStr + " poupado no período " + periodoStr, m, doc.page.height - 28, { width: pageWidth, align: "center" });

    return new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", reject);
        doc.end();
    });
}

/**
 * Gera o PDF de histórico para o utilizador (sem gráficos, sem registo na tabela relatorios).
 */
export async function gerarHistoricoPdf({ referenciaID, dataInicio, dataFim }) {
    const dados = await obterDadosRelatorio({ referenciaID, dataInicio, dataFim });
    const buffer = await criarPdfHistorico(dados);
    return {
        buffer,
        periodo: dados.periodo
    };
}
