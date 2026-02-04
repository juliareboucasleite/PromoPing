import { gerarHistoricoPdf } from "../services/historicoService.js";

export async function gerarHistoricoPdfRoute(req, res) {
    try {
        const referenciaID = req && req.user ? req.user.ReferenciaID : undefined;
        if (!referenciaID) {
            return res.status(401).json({ status: "error", error: "Utilizador nao autenticado" });
        }

        const { data_inicio, data_fim } = req.query;
        if (!data_inicio || !data_fim) {
            return res.status(400).json({ status: "error", error: "Parametros data_inicio e data_fim sao obrigatorios" });
        }

        const { buffer, periodo } = await gerarHistoricoPdf({
            referenciaID,
            dataInicio: data_inicio,
            dataFim: data_fim
        });

        const inicioStr = periodo.inicio.toISOString().slice(0, 10);
        const fimStr = periodo.fim.toISOString().slice(0, 10);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=historico-promoping-${inicioStr}-${fimStr}.pdf`);
        res.setHeader("Content-Length", buffer.length);
        return res.send(buffer);
    } catch (error) {
        const message = error && error.message ? error.message : "Erro ao gerar historico";
        const lowerMsg = message.toLowerCase();
        const isClientError = lowerMsg.includes("data") || lowerMsg.includes("parametro") || lowerMsg.includes("nenhum produto");
        const statusCode = isClientError ? 400 : 500;

        console.error("Erro ao gerar historico PDF:", error);
        return res.status(statusCode).json({
            status: "error",
            error: message
        });
    }
}
