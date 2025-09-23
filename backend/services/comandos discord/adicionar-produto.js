import { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import DiscordSyncService from '../discord-sync.js';

export const data = new SlashCommandBuilder()
    .setName('adicionar-produto')
    .setDescription('Adiciona um novo produto para monitorar preços');

export async function execute(interaction) {
    try {
        // Verificar se usuário está logado
        const user = await DiscordSyncService.getUserByDiscordId(interaction.user.id);
        
        if (!user) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Conta não encontrada')
                .setDescription(
                    'Você precisa estar logado para adicionar produtos!\n\n' +
                    '**Use:** `/login` ou `/registrar`'
                )
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Criar modal para adicionar produto
        const modal = new ModalBuilder()
            .setCustomId('adicionar_produto_modal')
            .setTitle('➕ Adicionar Produto');
        
        // Nome do produto
        const nomeInput = new TextInputBuilder()
            .setCustomId('produto_nome')
            .setLabel('Nome do Produto')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: iPhone 15 Pro Max 256GB')
            .setRequired(true)
            .setMaxLength(255);
        
        // URL do produto
        const urlInput = new TextInputBuilder()
            .setCustomId('produto_url')
            .setLabel('URL do Produto')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('https://www.worten.pt/product/...')
            .setRequired(true)
            .setMaxLength(500);
        
        // Preço alvo
        const precoInput = new TextInputBuilder()
            .setCustomId('produto_preco_alvo')
            .setLabel('Preço Alvo (opcional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 999.99')
            .setRequired(false)
            .setMaxLength(10);
        
        // Loja
        const lojaInput = new TextInputBuilder()
            .setCustomId('produto_loja')
            .setLabel('Loja (opcional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Worten, FNAC, IKEA...')
            .setRequired(false)
            .setMaxLength(100);
        
        // Adicionar inputs ao modal
        const nomeRow = new ActionRowBuilder().addComponents(nomeInput);
        const urlRow = new ActionRowBuilder().addComponents(urlInput);
        const precoRow = new ActionRowBuilder().addComponents(precoInput);
        const lojaRow = new ActionRowBuilder().addComponents(lojaInput);
        
        modal.addComponents(nomeRow, urlRow, precoRow, lojaRow);
        
        await interaction.showModal(modal);
        
    } catch (error) {
        console.error('Erro no comando adicionar-produto:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

// Handler para o modal
export async function handleModal(interaction) {
    try {
        if (interaction.customId !== 'adicionar_produto_modal') return;
        
        await interaction.deferReply({ ephemeral: true });
        
        const nome = interaction.fields.getTextInputValue('produto_nome');
        const url = interaction.fields.getTextInputValue('produto_url');
        const precoAlvoStr = interaction.fields.getTextInputValue('produto_preco_alvo');
        const loja = interaction.fields.getTextInputValue('produto_loja');
        
        // Validar URL
        try {
            new URL(url);
        } catch {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ URL inválida')
                .setDescription('Por favor, forneça uma URL válida do produto.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Validar preço alvo
        let precoAlvo = null;
        if (precoAlvoStr) {
            precoAlvo = parseFloat(precoAlvoStr);
            if (isNaN(precoAlvo) || precoAlvo <= 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ Preço inválido')
                    .setDescription('O preço alvo deve ser um número válido maior que zero.')
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }
        }
        
        // Buscar usuário
        const user = await DiscordSyncService.getUserByDiscordId(interaction.user.id);
        if (!user) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Sessão expirada')
                .setDescription('Sua sessão expirou. Use `/login` novamente.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Adicionar produto
        const result = await DiscordSyncService.addProduct(user.id, {
            nome,
            url,
            preco_alvo: precoAlvo,
            loja: loja || null
        });
        
        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Erro ao adicionar produto')
                .setDescription('Não foi possível adicionar o produto. Tente novamente mais tarde.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Sucesso
        const embed = new EmbedBuilder()
            .setColor('#51cf66')
            .setTitle('✅ Produto adicionado com sucesso!')
            .setDescription(
                `**${nome}** foi adicionado aos seus produtos monitorados.\n\n` +
                `**Detalhes:**\n` +
                `• **Loja:** ${loja || 'Não especificada'}\n` +
                `• **Preço alvo:** ${precoAlvo ? `€${precoAlvo}` : 'Não definido'}\n` +
                `• **URL:** [Ver produto](${url})\n\n` +
                `**Próximos passos:**\n` +
                `• Use \`/meus-produtos\` para ver todos os produtos\n` +
                `• Receberá notificações quando o preço baixar\n` +
                `• Configure alertas no site: https://promoping.com`
            )
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erro no handler do modal:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}
