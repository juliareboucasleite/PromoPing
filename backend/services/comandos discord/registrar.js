import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import DiscordSyncService from '../backend/services/discord-sync.js';

export const data = new SlashCommandBuilder()
    .setName('registrar')
    .setDescription('Registra uma conta no PromoPing usando seu Discord')
    .addStringOption(option =>
        option.setName('email')
            .setDescription('Seu email (opcional - será usado para sincronização)')
            .setRequired(false)
    );

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const email = interaction.options.getString('email');
        const discordUser = {
            id: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            avatar: interaction.user.avatarURL()
        };
        
        // Verificar se email já está em uso (se fornecido)
        if (email && !(await DiscordSyncService.isEmailAvailable(email))) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Email já em uso')
                .setDescription('Este email já está registrado no PromoPing. Use `/sincronizar` para vincular sua conta Discord.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Registrar ou atualizar usuário
        const result = await DiscordSyncService.registerOrUpdateDiscordUser(discordUser, email);
        
        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Erro no registro')
                .setDescription('Ocorreu um erro ao registrar sua conta. Tente novamente mais tarde.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Gerar token
        const token = DiscordSyncService.generateDiscordToken(result.user);
        
        const embed = new EmbedBuilder()
            .setColor('#51cf66')
            .setTitle('✅ Conta registrada com sucesso!')
            .setDescription(
                `Bem-vindo ao PromoPing, **${result.user.nome}**!\n\n` +
                `🔗 **Sincronização:** ${email ? 'Conta vinculada ao email' : 'Conta Discord criada'}\n` +
                `📧 **Email:** ${result.user.email}\n` +
                `🆔 **ID:** ${result.user.id}\n\n` +
                `**Próximos passos:**\n` +
                `• Use \`/meus-produtos\` para ver seus produtos\n` +
                `• Use \`/adicionar-produto\` para monitorar preços\n` +
                `• Acesse o site: https://promoping.com\n\n` +
                `**Token de acesso:** \`${token}\``
            )
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp()
            .setFooter({ text: 'Guarde este token para usar no site!' });
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erro no comando registrar:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}
