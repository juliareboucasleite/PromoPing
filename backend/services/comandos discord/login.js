import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import DiscordSyncService from '../discord-sync.js';

export const data = new SlashCommandBuilder()
    .setName('login')
    .setDescription('Faz login na sua conta PromoPing');

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const discordUser = {
            id: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            avatar: interaction.user.avatarURL()
        };
        
        // Buscar usuário existente
        const user = await DiscordSyncService.getUserByDiscordId(discordUser.id);
        
        if (!user) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Conta não encontrada')
                .setDescription(
                    'Você ainda não tem uma conta no PromoPing!\n\n' +
                    '**Opções:**\n' +
                    '• Use `/registrar` para criar uma nova conta\n' +
                    '• Use `/sincronizar` se já tem conta no site'
                )
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Atualizar último login
        await DiscordSyncService.registerOrUpdateDiscordUser(discordUser, user.email);
        
        // Gerar novo token
        const token = DiscordSyncService.generateDiscordToken(user);
        
        // Buscar estatísticas do usuário
        const produtos = await DiscordSyncService.getUserProducts(user.id);
        const produtosAtivos = produtos.filter(p => p.ativo).length;
        
        const embed = new EmbedBuilder()
            .setColor('#51cf66')
            .setTitle('✅ Login realizado com sucesso!')
            .setDescription(
                `Olá novamente, **${user.nome}**!\n\n` +
                `📊 **Suas estatísticas:**\n` +
                `• Produtos monitorados: **${produtosAtivos}**\n` +
                `• Conta criada: <t:${Math.floor(new Date(user.criado_em).getTime() / 1000)}:R>\n` +
                `• Último login: <t:${Math.floor(Date.now() / 1000)}:R>\n\n` +
                `**Token de acesso:** \`${token}\``
            )
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp()
            .setFooter({ text: 'Use /meus-produtos para ver seus produtos!' });
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erro no comando login:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}