import express from "express";
import { sendEmail } from "../services/notify.js";
import { pool } from "../database/db.js";

const router = express.Router();

// Template HTML para email de confirmação
function getNewsletterConfirmationEmail(preferences) {
  const preferencesList = [];
  if (preferences.newsletter) preferencesList.push("Newsletter semanal com dicas de poupança");
  if (preferences.promotions) preferencesList.push("Alertas de promoções exclusivas");
  if (preferences.articles) preferencesList.push("Notificações de novos artigos do blog");

  return `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo à Newsletter PromoPing</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f10; color: #e6e6e6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f0f10;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #18181a; border-radius: 12px; border: 1px solid #232326;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 2px solid #2a2a2d;">
              <h1 style="margin: 0; font-size: 2rem; font-weight: 700; color: #fff; letter-spacing: -0.02em;">PromoPing</h1>
              <p style="margin: 10px 0 0; font-size: 1rem; color: #888;">Newsletter</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 1.5rem; font-weight: 600; color: #fff;">Bem-vindo à Newsletter PromoPing!</h2>
              
              <p style="margin: 0 0 20px; font-size: 1rem; line-height: 1.6; color: #bbb;">
                Obrigado por subscrever a nossa newsletter! Estamos muito felizes por teres decidido juntar-te à nossa comunidade de utilizadores que já poupam com as nossas dicas.
              </p>
              
              <div style="background-color: #1a1a1c; border: 1px solid #2a2a2d; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; font-size: 1.1rem; font-weight: 600; color: #fff;">As tuas preferências:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #bbb; line-height: 1.8;">
                  ${preferencesList.map(pref => `<li style="margin-bottom: 8px;">${pref}</li>`).join('')}
                </ul>
              </div>
              
              <p style="margin: 20px 0; font-size: 1rem; line-height: 1.6; color: #bbb;">
                A partir de agora, receberás regularmente:
              </p>
              
              <ul style="margin: 0 0 30px; padding-left: 20px; color: #bbb; line-height: 1.8;">
                <li style="margin-bottom: 10px;">Dicas exclusivas de poupança</li>
                <li style="margin-bottom: 10px;">Alertas de promoções imperdíveis</li>
                <li style="margin-bottom: 10px;">Análises de tendências de preços</li>
                <li style="margin-bottom: 10px;">Novos artigos do nosso blog</li>
              </ul>
              
              <div style="text-align: center; margin: 40px 0 30px;">
                <a href="${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://promoping.pt'}" style="display: inline-block; background-color: #fff; color: #0f0f10; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 1rem; transition: transform 0.2s ease;">Visitar PromoPing</a>
              </div>
              
              <p style="margin: 30px 0 0; font-size: 0.9rem; line-height: 1.6; color: #666; text-align: center; border-top: 1px solid #232326; padding-top: 30px;">
                Se não subscreveste esta newsletter, podes ignorar este email ou contactar-nos através do nosso suporte.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #1a1a1c; border-top: 1px solid #232326; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 10px; font-size: 0.85rem; color: #666; text-align: center;">
                <strong style="color: #888;">PromoPing</strong> - Dicas, truques e insights para maximizar as tuas poupanças
              </p>
              <p style="margin: 0; font-size: 0.8rem; color: #555; text-align: center;">
                © ${new Date().getFullYear()} PromoPing. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Subscrever newsletter
router.post("/subscribe", async (req, res) => {
  try {
    const { email, newsletter, promotions, articles } = req.body;

    // Validação
    if (!email || !email.includes("@")) {
      return res.status(400).json({ 
        success: false, 
        message: "Email inválido" 
      });
    }

    // Verificar se pelo menos uma preferência está selecionada
    if (!newsletter && !promotions && !articles) {
      return res.status(400).json({ 
        success: false, 
        message: "Selecione pelo menos uma preferência" 
      });
    }

    // Salvar no banco de dados (criar tabela se não existir)
    const connection = await pool.getConnection();
    
    try {
      // Criar tabela se não existir
      await connection.query(`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          newsletter BOOLEAN DEFAULT TRUE,
          promotions BOOLEAN DEFAULT TRUE,
          articles BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Atualizar primeiro para não depender de constraint unique já existente no schema
      const [updateResult] = await connection.query(`
        UPDATE newsletter_subscribers
        SET newsletter = ?,
            promotions = ?,
            articles = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = ?
      `, [newsletter || false, promotions || false, articles || false, email]);

      if (!updateResult || (updateResult.rowCount || 0) === 0) {
        const [nextIdRows] = await connection.query(`
          SELECT COALESCE(MAX(id), 0) + 1 AS next_id
          FROM newsletter_subscribers
        `);
        const nextId = nextIdRows?.[0]?.next_id || 1;

        await connection.query(`
          INSERT INTO newsletter_subscribers (id, email, newsletter, promotions, articles)
          VALUES (?, ?, ?, ?, ?)
        `, [nextId, email, newsletter || false, promotions || false, articles || false]);
      }

      connection.release();

      // Enviar email de confirmação
      const emailHtml = getNewsletterConfirmationEmail({
        newsletter: newsletter || false,
        promotions: promotions || false,
        articles: articles || false
      });

      let emailSent = true;
      try {
        await sendEmail(
          email,
          "Bem-vindo à Newsletter PromoPing!",
          emailHtml
        );
      } catch (emailError) {
        emailSent = false;
        console.warn("⚠️ [NEWSLETTER] Subscrição guardada, mas falhou o envio do email de confirmação:", emailError.message);
      }

      console.log(`✅ [NEWSLETTER] Nova subscrição: ${email}`);

      res.json({
        success: true,
        message: emailSent
          ? "Subscrição realizada com sucesso! Verifica o teu email para confirmar."
          : "Subscrição realizada com sucesso, mas não foi possível enviar o email de confirmação."
      });

    } catch (dbError) {
      connection.release();
      console.error("❌ [NEWSLETTER] Erro no banco de dados:", dbError);
      throw dbError;
    }

  } catch (error) {
    console.error("❌ [NEWSLETTER] Erro ao processar subscrição:", error);
    
    // Se for erro de email duplicado, retornar sucesso (já está subscrito)
    // 23505 = unique_violation em Postgres; ER_DUP_ENTRY mantido para compat com mysql2.
    if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') {
      return res.json({
        success: true,
        message: "Já estás subscrito! As tuas preferências foram atualizadas."
      });
    }

    res.status(500).json({
      success: false,
      message: "Erro ao processar subscrição. Por favor, tenta novamente mais tarde."
    });
  }
});

// Cancelar subscrição
router.post("/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ 
        success: false, 
        message: "Email inválido" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.query(`
        DELETE FROM newsletter_subscribers WHERE email = ?
      `, [email]);

      connection.release();

      console.log(`✅ [NEWSLETTER] Subscrição cancelada: ${email}`);

      res.json({
        success: true,
        message: "Subscrição cancelada com sucesso."
      });

    } catch (dbError) {
      connection.release();
      throw dbError;
    }

  } catch (error) {
    console.error("❌ [NEWSLETTER] Erro ao cancelar subscrição:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao cancelar subscrição. Por favor, tenta novamente mais tarde."
    });
  }
});

// Estatísticas públicas
router.get("/stats", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Contar subscritores da newsletter
      const [newsletterCount] = await connection.query(`
        SELECT COUNT(*) as total FROM newsletter_subscribers
      `);

      // Contar utilizadores totais (ativos)
      const [usersCount] = await connection.query(`
        SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1
      `);

      // Contar produtos monitorizados (ativos)
      const [productsCount] = await connection.query(`
        SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL
      `);

      // Contar notificações enviadas (últimos 30 dias)
      const [notificationsCount] = await connection.query(`
        SELECT COUNT(*) as total FROM Notificacoes 
        WHERE DataEnvio >= NOW() - INTERVAL '30 days'
      `);


      // Contar todas as notificações enviadas (total)
      const [totalNotificationsCount] = await connection.query(`
        SELECT COUNT(*) as total FROM Notificacoes
      `);

      // Calcular total poupado (últimos 30 dias)
      const [savingsTotal] = await connection.query(`
        SELECT COALESCE(SUM(ValorPoupado), 0) as total FROM Notificacoes 
        WHERE DataEnvio >= NOW() - INTERVAL '30 days' AND ValorPoupado IS NOT NULL
      `);

      // Calcular total poupado (todos os tempos)
      const [totalSavings] = await connection.query(`
        SELECT COALESCE(SUM(ValorPoupado), 0) as total FROM Notificacoes 
        WHERE ValorPoupado IS NOT NULL
      `);

      // Contar registos no histórico de preços (dados analisados)
      const [historyCount] = await connection.query(`
        SELECT COUNT(*) as total FROM historicoprecos
      `);

      connection.release();

      const stats = {
        newsletterSubscribers: newsletterCount[0]?.total || 0,
        totalUsers: usersCount[0]?.total || 0,
        monitoredProducts: productsCount[0]?.total || 0,
        notificationsLast30Days: notificationsCount[0]?.total || 0,
        totalNotifications: totalNotificationsCount[0]?.total || 0,
        totalSavedLast30Days: parseFloat(savingsTotal[0]?.total || 0),
        totalSaved: parseFloat(totalSavings[0]?.total || 0),
        dataAnalyzed: historyCount[0]?.total || 0
      };

      res.json({
        success: true,
        stats
      });

    } catch (dbError) {
      connection.release();
      throw dbError;
    }

  } catch (error) {
    console.error("❌ [NEWSLETTER] Erro ao buscar estatísticas:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar estatísticas."
    });
  }
});

export default router;

