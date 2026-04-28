import PDFDocument from "pdfkit";
import { pool } from "../database/db.js";
import { obterDadosRelatorio } from "./relatorioData.js";

const ACCENT = "#f39c12";
const TEXT_PRIMARY = "#1f2d3d";
const TEXT_MUTED = "#6c7a89";
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

function padSequence(value) {
    return String(value).padStart(4, "0");
}

async function gerarReferenciaRelatorio(conn, year) {
    const prefix = `REF-PP-${year}-`;
    const [rows] = await conn.query(
        "SELECT ref FROM relatorios WHERE ref LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE", [`${prefix}%`]
    );

    let next = 1;
    if (rows.length > 0 && rows[0].ref) {
        const parts = rows[0].ref.split("-");
        const last = parseInt(parts[parts.length - 1], 10);
        if (!Number.isNaN(last)) {
            next = last + 1;
        }
    }

    return `${prefix}${padSequence(next)}`;
}

// Escreve uma linha de texto em colunas (sem bordas de células). Estilo fatura: só linhas horizontais.
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

// Desenha um gráfico de barras horizontais (poupança por produto). Estilo limpo, sem eixos pesados.
function desenharGraficoPoupanca(doc, x, y, produtos, maxBarWidth, rowHeight) {
    const maxPoupanca = Math.max(
        0.01,
        ...produtos.map((p) => Number(p.poupanca) || 0)
    );
    const labelWidth = 140;
    const barStart = x + labelWidth + 6;
    const barWidth = maxBarWidth;

    produtos.forEach((p, idx) => {
        const nome = (p.nome || "—").substring(0, 28);
        const val = Number(p.poupanca) || 0;
        const ratio = maxPoupanca > 0 ? val / maxPoupanca : 0;
        const w = Math.round(ratio * barWidth);

        doc.font("Helvetica").fontSize(9).fillColor(TEXT_PRIMARY);
        doc.text(nome, x, y + 2, { width: labelWidth });
        doc.rect(barStart, y, barWidth, rowHeight - 4).fillAndStroke("#f0f0f0", "#e0e0e0");
        if (w > 0) {
            doc.rect(barStart, y, w, rowHeight - 4).fill(ACCENT);
        }
        doc.fillColor(TEXT_PRIMARY).fontSize(9);
        doc.text(formatCurrency(val), barStart + barWidth + 8, y + 2, { width: 70, align: "right" });
        y += rowHeight;
    });
}

/**
 * Gera PDF em estilo fatura PromoPing (modelo oficial).
 * Estrutura: Relatório | PromoPing → Número da fatura, Período → Empresa | Conta para → Valor poupado → Itens (Descrição, Qtd., Preço unitário, Montante) → Subtotal/Total/Montante devido → Rodapé e linha final.
 */
function criarPdf({ ref, user, periodo, produtos, totais }) {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const m = doc.page.margins.left;
    const pageWidth = doc.page.width - m - doc.page.margins.right;
    const dataEmissao = formatDatePt(new Date());
    const periodoStr = formatRange(periodo.inicio, periodo.fim);
    const valorPoupadoStr = formatCurrency(totais.poupado);

    // —— Cabeçalho: Relatório (esquerda) | PromoPing (direita) ——
    doc.font("Helvetica-Bold").fontSize(28).fillColor(TEXT_PRIMARY);
    doc.text("Relatório", m, 50);
    doc.font("Helvetica").fontSize(12).fillColor(TEXT_MUTED);
    doc.text(COMPANY.name, m + pageWidth - 80, 50, { width: 80, align: "right" });

    // —— Detalhes da fatura (esquerda) ——
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text("Número da fatura: " + ref, m, 88);
    doc.text("Data de emissão: " + dataEmissao, m, 104);
    doc.text("Período analisado: " + periodoStr, m, 120);

    // —— Empresa (esquerda) | Conta para (direita) ——
    const col1X = m;
    const col2X = m + pageWidth * 0.5;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text(COMPANY.name, col1X, 155);
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.text(COMPANY.address, col1X, 170, { width: 220 });
    doc.text(COMPANY.phone, col1X, 218);

    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text("Conta para", col2X, 155);
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_PRIMARY);
    doc.text(user.nome || "—", col2X, 170, { width: 220 });
    doc.text(user.email || "—", col2X, 185, { width: 220 });
    doc.text("Plano: " + (user.plano || "—"), col2X, 200, { width: 220 });
    doc.text("Membro desde: " + formatDatePt(user.membroDesde), col2X, 215, { width: 220 });

    // —— Valor poupado (destaque, como na fatura "X € até data") ——
    doc.font("Helvetica-Bold").fontSize(14).fillColor(TEXT_PRIMARY);
    doc.text(valorPoupadoStr + " poupado no período (" + periodoStr + ")", m, 255, { width: pageWidth });

    // —— Nota (estilo fatura) ——
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.text("Este relatório refere-se ao histórico de monitorização de preços no PromoPing.", m, 272, { width: pageWidth });
    doc.text("Para esclarecimentos: suporte@promoping.pt", m, 284, { width: pageWidth });

    // —— Linha separadora ——
    linhaHorizontal(doc, m, 298, pageWidth);

    // —— Resumo do período (métricas em caixas, estilo relatório profissional) ——
    let y = 310;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT_PRIMARY);
    doc.text("Resumo do período", m, y);
    y += 22;

    const boxWidth = (pageWidth - 24) / 3;
    const boxHeight = 44;
    const metrics = [
        { label: "Produtos monitorizados", value: String(totais.produtos) },
        { label: "Alertas enviados", value: String(totais.alertas) },
        { label: "Poupança total", value: valorPoupadoStr }
    ];
    metrics.forEach((item, i) => {
        const bx = m + i * (boxWidth + 12);
        doc.rect(bx, y, boxWidth, boxHeight).fillAndStroke("#f8f9fa", "#e0e0e0");
        doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
        doc.text(item.label, bx + 10, y + 10, { width: boxWidth - 20 });
        doc.font("Helvetica-Bold").fontSize(12).fillColor(i === 2 ? ACCENT : TEXT_PRIMARY);
        doc.text(item.value, bx + 10, y + 24, { width: boxWidth - 20 });
    });
    y += boxHeight + 20;

    // —— Gráfico: Poupança por produto (barras horizontais) ——
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT_PRIMARY);
    doc.text("Poupança por produto", m, y);
    y += 18;

    const chartBarWidth = 180;
    const chartRowHeight = 18;
    if (produtos.length > 0) {
        desenharGraficoPoupanca(doc, m, y, produtos, chartBarWidth, chartRowHeight);
        y += produtos.length * chartRowHeight + 16;
    } else {
        doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
        doc.text("Sem produtos no período.", m, y);
        y += 24;
    }

    // Linha antes da tabela de itens
    linhaHorizontal(doc, m, y, pageWidth);
    y += 16;

    // —— Secção de itens: Descrição, Qtd., Preço unitário, Montante (como na fatura) ——
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

    // —— Totais à direita (Subtotal, Total, Montante devido) ——
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
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.text("O cliente está isento de impostos.", totalsX, totalsY, { width: 200 });
    totalsY += 16;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_PRIMARY);
    doc.text("Total:", totalsX, totalsY, { width: 90 });
    doc.text(valorPoupadoStr, totalsX + 100, totalsY, { width: 100, align: "right" });
    totalsY += 18;
    doc.text("Montante devido:", totalsX, totalsY, { width: 90 });
    doc.fillColor(ACCENT);
    doc.text(valorPoupadoStr, totalsX + 100, totalsY, { width: 100, align: "right" });

    // —— Rodapé (igual ao modelo da fatura) ——
    const footerY = doc.page.height - 72;
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
    doc.text("Obrigado por utilizar o PromoPing.", m, footerY, { width: pageWidth, align: "center" });
    doc.text("Monitorização inteligente de preços para consumidores em Portugal.", m, footerY + 12, { width: pageWidth, align: "center" });
    doc.text("Este documento foi gerado eletronicamente e é válido sem assinatura.", m, footerY + 24, { width: pageWidth, align: "center" });

    // —— Linha final (ref · valor até período) ——
    doc.font("Helvetica").fontSize(8).fillColor(TEXT_MUTED);
    doc.text(ref + " · " + valorPoupadoStr + " poupado no período " + periodoStr, m, doc.page.height - 28, { width: pageWidth, align: "center" });

    return new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", reject);
        doc.end();
    });
}

export async function gerarRelatorioEconomia({ referenciaID, dataInicio, dataFim }) {
    const { user, produtos, totais, periodo } = await obterDadosRelatorio({ referenciaID, dataInicio, dataFim });
    const { inicio, fim } = periodo;

    const conn = await pool.getConnection();
    let ref;
    try {
        await conn.beginTransaction();
        ref = await gerarReferenciaRelatorio(conn, fim.getFullYear());
        await conn.query(
            `INSERT INTO relatorios (ref, user_id, data_inicio, data_fim, total_produtos, total_alertas, total_poupado, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [ref, referenciaID, inicio, fim, totais.produtos, totais.alertas, totais.poupado]
        );
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }

    const buffer = await criarPdf({
        ref,
        user,
        periodo,
        produtos,
        totais
    });

    return { buffer, ref, totais, periodo };
}