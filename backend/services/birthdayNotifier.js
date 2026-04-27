/**
 * Envia parabéns por email e Discord no dia do aniversário do utilizador.
 * Executa uma vez por dia (verifica utilizadores com DataNascimento = hoje).
 */

import { pool } from '../database/db.js';
import { sendEmail } from './notify.js';

const DISCORD_INTERNAL_URL = process.env.DISCORD_INTERNAL_URL || 'http://127.0.0.1:3001';
const BIRTHDAY_EMAIL_FROM = process.env.EMAIL_USER || 'noreply@promoping.pt';

/**
 * Retorna utilizadores que fazem anos hoje (mês e dia = hoje).
 */
async function getUsersWithBirthdayToday() {
  const [rows] = await pool.query(
    `SELECT ReferenciaID, Nome, Email, discord_id, DataNascimento
     FROM utilizadores
     WHERE DataNascimento IS NOT NULL
       AND EXTRACT(MONTH FROM DataNascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM DataNascimento) = EXTRACT(DAY FROM CURRENT_DATE)
       AND (Ativo = 1 OR Ativo IS NULL)
       AND Email IS NOT NULL AND Email != ''`
  );
  return rows;
}

/**
 * Envia email de parabéns.
 */
async function sendBirthdayEmail(email, nome) {
  const firstName = (nome || 'Utilizador').trim().split(/\s+/)[0] || 'Utilizador';
  const subject = '🎂 Parabéns da equipa PromoPing!';
  const html = `
    <p>Olá <strong>${escapeHtml(firstName)}</strong>,</p>
    <p>A equipa PromoPing deseja-te um <strong>feliz aniversário</strong>! 🎉</p>
    <p>Obrigado por fazeres parte da nossa comunidade. Que este dia seja repleto de boas surpresas.</p>
    <p>Com os melhores cumprimentos,<br><strong>Equipa PromoPing</strong></p>
  `;
  await sendEmail(email, subject, html);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Envia DM de parabéns no Discord (via servidor interno do bot).
 */
async function sendBirthdayDiscordDM(discordId, nome) {
  if (!discordId || !String(discordId).trim()) return;
  const firstName = (nome || 'Utilizador').trim().split(/\s+/)[0] || 'Utilizador';
  try {
    const res = await fetch(`${DISCORD_INTERNAL_URL}/internal/send-dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discordUserId: String(discordId).trim(),
        embed: {
          title: '🎂 Feliz aniversário!',
          description: [
            `Olá **${firstName}**!`,
            '',
            'A equipa PromoPing quer celebrar contigo este dia especial. 🎉',
            '',
            'Obrigado por fazeres parte da nossa comunidade — desejamos-te um ano cheio de boas surpresas e ótimas poupanças nos preços.',
            '',
            '*Com os melhores cumprimentos,*',
            '**Equipa PromoPing**'
          ].join('\n'),
          color: 0xffc72d,
          timestamp: new Date().toISOString(),
          footer: { text: 'PromoPing • Obrigado por estares connosco' },
          fields: [
            { name: '🎁', value: 'Continua a acompanhar os teus produtos favoritos e a poupar com as nossas notificações.', inline: false }
          ]
        }
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[BIRTHDAY] Discord DM falhou para', discordId, res.status, errText);
    }
  } catch (err) {
    console.warn('[BIRTHDAY] Erro ao enviar DM Discord:', err.message);
  }
}

/**
 * Verifica aniversariantes do dia e envia email + Discord.
 */
export async function checkAndSendBirthdayGreetings() {
  try {
    const users = await getUsersWithBirthdayToday();
    if (users.length === 0) return { sent: 0 };

    let emailOk = 0;
    let discordOk = 0;

    for (const u of users) {
      try {
        if (u.Email) {
          await sendBirthdayEmail(u.Email, u.Nome);
          emailOk++;
        }
      } catch (e) {
        console.error('[BIRTHDAY] Erro email para', u.ReferenciaID, e.message);
      }

      if (u.discord_id) {
        await sendBirthdayDiscordDM(u.discord_id, u.Nome);
        discordOk++;
      }
    }

    if (users.length > 0) {
      console.log(`[BIRTHDAY] Enviados parabéns a ${users.length} utilizador(es) (email: ${emailOk}, Discord: ${discordOk})`);
    }
    return { sent: users.length, email: emailOk, discord: discordOk };
  } catch (err) {
    console.error('[BIRTHDAY] Erro ao processar aniversários:', err);
    throw err;
  }
}

/**
 * Inicia a verificação diária (uma vez a cada 24h, com primeira execução ao subir).
 */
let lastRunDate = null;

export function startBirthdayNotifier() {
  (async () => {
    const run = async () => {
      const today = new Date().toDateString();
      if (lastRunDate === today) return;
      lastRunDate = today;
      try {
        await checkAndSendBirthdayGreetings();
      } catch (e) {
        console.error('[BIRTHDAY] Erro na verificação diária:', e);
      }
    };
    setInterval(run, 24 * 60 * 60 * 1000);
    await run();
    console.log('[BIRTHDAY] Notificador de aniversários iniciado (verificação diária)');
  })().catch((e) => console.error('[BIRTHDAY] Erro ao iniciar:', e));
}
