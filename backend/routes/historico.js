import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { gerarHistoricoPdfRoute } from "../controllers/historicoController.js";

const router = express.Router();

router.get("/pdf", verifyToken, gerarHistoricoPdfRoute);

export default router;
