/**
 * Utilitário para enviar notificações ao Discord
 * Usa o servidor HTTP interno do bot (porta 3001)
 */

/**
 * Envia um bug resolvido para o canal de known-bugs no Discord
 * @param {Object} bug - Objeto com dados do bug
 * @returns {Promise<boolean>} - True se enviado com sucesso
 */
export async function sendResolvedBugToDiscord(bug) {
    try {
        const knownBugsChannelId = process.env.DISCORD_KNOWN_BUGS_CHANNEL_ID;
        
        if (!knownBugsChannelId) {
            console.log('[DISCORD] DISCORD_KNOWN_BUGS_CHANNEL_ID não configurado, pulando notificação');
            return false;
        }

        // Criar embed para o bug resolvido
        const embed = {
            title: `Bug Resolvido: ${bug.Titulo || 'Sem título'}`,
            description: (bug.Descricao || 'Sem descrição').substring(0, 2000),
            color: 0x4CAF50, // Verde
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: 'ID do Bug',
                    value: `#${bug.Id}`,
                    inline: true
                },
                {
                    name: 'Tipo',
                    value: bug.Tipo || 'bug',
                    inline: true
                },
                {
                    name: 'Prioridade',
                    value: bug.Prioridade || 'medium',
                    inline: true
                },
                {
                    name: 'Criado em',
                    value: bug.DataCriacao ? new Date(bug.DataCriacao).toLocaleDateString('pt-PT') : 'N/A',
                    inline: true
                },
                {
                    name: 'Resolvido em',
                    value: new Date().toLocaleDateString('pt-PT'),
                    inline: true
                }
            ],
            footer: {
                text: 'PromoPing • Bug Resolvido'
            }
        };

        // Enviar para o servidor interno do bot
        const response = await fetch('http://127.0.0.1:3001/internal/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                channelId: knownBugsChannelId,
                embed: embed
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('[DISCORD] Erro ao enviar bug resolvido:', errorData);
            return false;
        }

        console.log(`[DISCORD] Bug #${bug.Id} enviado para o canal de known-bugs`);
        return true;
    } catch (error) {
        console.error('[DISCORD] Erro ao enviar bug resolvido para Discord:', error);
        return false;
    }
}
