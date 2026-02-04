import { gerarRelatorioEconomia } from "../services/relatorioService.js";

export async function gerarRelatorioPdf(req, res) {
    try {
        const referenciaID = req && req.user ? req.user.ReferenciaID : undefined;
        if (!referenciaID) {
            return res.status(401).json({ status: "error", error: "Utilizador nao autenticado" });
        }

        const { data_inicio, data_fim } = req.query;
        if (!data_inicio || !data_fim) {
            return res.status(400).json({ status: "error", error: "Parametros data_inicio e data_fim sao obrigatorios" });
        }

        const { buffer, ref, totais, periodo } = await gerarRelatorioEconomia({
            referenciaID,
            dataInicio: data_inicio,
            dataFim: data_fim
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=relatorio-promoping-${ref}.pdf`);
        res.setHeader("X-Relatorio-Ref", ref);
        res.setHeader("X-Relatorio-Periodo", `${periodo.inicio.toISOString()}|${periodo.fim.toISOString()}`);
        res.setHeader("Content-Length", buffer.length);
        return res.send(buffer);
    } catch (error) {
        const message = error && error.message ? error.message : "Erro ao gerar relatorio";
        const lowerMsg = message.toLowerCase();
        const isClientError = lowerMsg.includes("data") || lowerMsg.includes("parametro") || lowerMsg.includes("nenhum produto");
        const statusCode = isClientError ? 400 : 500;

        console.error("Erro ao gerar relatorio PDF:", error);
        return res.status(statusCode).json({
            status: "error",
            error: message
        });
    }
}