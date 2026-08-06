const { EmbedBuilder } = require('discord.js');
const { getLinkedUser, getUserPlanSummary } = require('../../utils/discordProductService');

const PLAN_COLORS = {
    Free: 0x95a5a6,
    Basic: 0x3498db,
    Standard: 0x9b59b6,
    Premium: 0xf39c12,
    Corporate: 0xe67e22,
};

module.exports = {
    name: 'plano',
    aliases: ['plan', 'meuplano', 'subscription'],
    category: 'Conta',
    description: 'Mostra o teu plano PromoPing, limites e frequência de verificação.',
    usage: '!plano',
    execute: async (client, message) => {
        try {
            const user = await getLinkedUser(message.author.id);
            if (!user) {
                return message.reply('**Não estás ligado ao PromoPing.** Usa `!login` para conectar a tua conta.');
            }

            const plan = await getUserPlanSummary(user.ReferenciaID);
            const planName = plan.planoNome || 'Free';
            const color = PLAN_COLORS[planName] || 0x5865f2;
            const precoLabel = Number(plan.planoPreco) > 0
                ? `€${Number(plan.planoPreco).toFixed(2)}/mês`
                : 'Gratuito';

            const embed = new EmbedBuilder()
                .setTitle(`Plano ${planName}`)
                .setDescription(`Conta: **${user.Email || 'ligada'}**`)
                .setColor(color)
                .addFields(
                    {
                        name: 'Subscrição',
                        value: `${precoLabel}`,
                        inline: true,
                    },
                    {
                        name: 'Produtos',
                        value: `${plan.totalProdutos}/${plan.limite} (${plan.restantes} restantes)`,
                        inline: true,
                    },
                    {
                        name: 'Verificação',
                        value: `A cada ${plan.intervaloLabel}`,
                        inline: true,
                    },
                    {
                        name: 'Histórico',
                        value: plan.historicoLabel,
                        inline: true,
                    },
                    {
                        name: 'Relatórios',
                        value: plan.relatoriosAtivos ? 'Ativos' : 'Não incluídos',
                        inline: true,
                    },
                    {
                        name: 'Alertas Discord',
                        value: plan.discordAtivo ? 'Ativos' : 'Desativados (`!iniciar` para ativar)',
                        inline: true,
                    },
                    {
                        name: 'Gerir plano',
                        value: '[Ver planos no site](https://promoping.pt/dashboard/subscription-plans.html)',
                        inline: false,
                    }
                )
                .setFooter({ text: '© PromoPing • Monitorização automática pela plataforma' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[DISCORD] Erro no comando plano:', error);
            return message.reply('**Erro interno.** Tenta novamente dentro de alguns minutos.');
        }
    },
};
