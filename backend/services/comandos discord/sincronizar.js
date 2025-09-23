import { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import DiscordSyncService from '../backend/services/discord-sync.js';
import bcrypt from 'bcrypt';

export const data = new SlashCommandBuilder()
    .setName('sincronizar')
    .setDescription('Sincroniza sua conta Discord com uma conta existente no site')
    .addStringOption(option =>
        option.setName('email')
            .setDescription('Email da sua conta no site')
            .setRequired(true)
    );

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const email = interaction.options.getString('email');
        
        // Verificar se email existe no site
        const emailDisponivel = await DiscordSyncService.isEmailAvailable(email);
        
        if (emailDisponivel) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Email não encontrado')
                .setDescription(
                    `Não foi encontrada uma conta com o email **${email}**.\n\n` +
                    '**Opções:**\n' +
                    '• Verifique se o email está correto\n' +
                    '• Use `/registrar` para criar uma nova conta\n' +
                    '• Registre-se primeiro no site: https://promoping.com'
                )
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Verificar se Discord já está vinculado a alguma conta
        const userExistente = await DiscordSyncService.getUserByDiscordId(interaction.user.id);
        
        if (userExistente) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Discord já vinculado')
                .setDescription(
                    `Seu Discord já está vinculado à conta **${userExistente.email}**.\n\n` +
                    '**Se quiser trocar de conta:**\n' +
                    '• Use `/desvincular` primeiro\n' +
                    '• Depois use `/sincronizar` novamente'
                )
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Mostrar modal para confirmar senha
        const modal = new ModalBuilder()
            .setCustomId('sincronizar_modal')
            .setTitle('🔗 Sincronizar Conta');
        
        const emailInput = new TextInputBuilder()
            .setCustomId('sincronizar_email')
            .setLabel('Email (confirmar)')
            .setStyle(TextInputStyle.Short)
            .setValue(email)
            .setRequired(true)
            .setMaxLength(150);
        
        const senhaInput = new TextInputBuilder()
            .setCustomId('sincronizar_senha')
            .setLabel('Senha da sua conta')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Digite sua senha para confirmar')
            .setRequired(true)
            .setMaxLength(100);
        
        const emailRow = new ActionRowBuilder().addComponents(emailInput);
        const senhaRow = new ActionRowBuilder().addComponents(senhaInput);
        
        modal.addComponents(emailRow, senhaRow);
        
        await interaction.showModal(modal);
        
    } catch (error) {
        console.error('Erro no comando sincronizar:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}

// Handler para o modal de sincronização
export async function handleModal(interaction) {
    try {
        if (interaction.customId !== 'sincronizar_modal') return;
        
        await interaction.deferReply({ ephemeral: true });
        
        const email = interaction.fields.getTextInputValue('sincronizar_email');
        const senha = interaction.fields.getTextInputValue('sincronizar_senha');
        
        // Buscar usuário no banco de dados
        const { pool } = await import('../backend/routes/db.js');
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE email = ? AND ativo = TRUE',
            [email]
        );
        
        if (rows.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Conta não encontrada')
                .setDescription('Não foi possível encontrar uma conta com este email.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        const user = rows[0];
        
        // Verificar senha
        if (user.senha) {
            const senhaValida = await bcrypt.compare(senha, user.senha);
            if (!senhaValida) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ Senha incorreta')
                    .setDescription('A senha fornecida está incorreta.')
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }
        }
        
        // Verificar se Discord já está vinculado
        if (user.discord_id) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Conta já vinculada')
                .setDescription(
                    `Esta conta já está vinculada ao Discord ID: **${user.discord_id}**\n\n` +
                    'Se este é o seu Discord, use `/login` para acessar.'
                )
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Vincular Discord à conta
        const discordUser = {
            id: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            avatar: interaction.user.avatarURL()
        };
        
        const result = await DiscordSyncService.registerOrUpdateDiscordUser(discordUser, email);
        
        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Erro na sincronização')
                .setDescription('Não foi possível vincular sua conta Discord. Tente novamente mais tarde.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Buscar produtos do usuário
        const produtos = await DiscordSyncService.getUserProducts(user.id);
        
        // Gerar token
        const token = DiscordSyncService.generateDiscordToken(user);
        
        const embed = new EmbedBuilder()
            .setColor('#51cf66')
            .setTitle('✅ Conta sincronizada com sucesso!')
            .setDescription(
                `Sua conta Discord foi vinculada à conta **${user.email}**!\n\n` +
                `**Informações da conta:**\n` +
                `• **Nome:** ${user.nome}\n` +
                `• **Email:** ${user.email}\n` +
                `• **Produtos:** ${produtos.length} monitorados\n` +
                `• **Conta criada:** <t:${Math.floor(new Date(user.criado_em).getTime() / 1000)}:R>\n\n` +
                `**Token de acesso:** \`${token}\`\n\n` +
                `**Próximos passos:**\n` +
                `• Use \`/meus-produtos\` para ver seus produtos\n` +
                `• Use \`/adicionar-produto\` para adicionar mais\n` +
                `• Acesse o site: https://promoping.com`
            )
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp()
            .setFooter({ text: 'Agora você pode usar o Discord e o site simultaneamente!' });
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erro no handler do modal de sincronização:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}
