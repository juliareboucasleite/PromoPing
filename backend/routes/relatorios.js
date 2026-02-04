import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { gerarRelatorioPdf } from "../controllers/relatorioController.js";

const router = express.Router();

router.get("/pdf", verifyToken, gerarRelatorioPdf);

export default router;