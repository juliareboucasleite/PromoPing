import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import DiscordSyncService from '../backend/services/discord-sync.js';

export const data = new SlashCommandBuilder()
    .setName('meus-produtos')
    .setDescription('Lista todos os seus produtos monitorados')
    .addIntegerOption(option =>
        option.setName('pagina')
            .setDescription('Número da página (5 produtos por página)')
            .setMinValue(1)
            .setRequired(false)
    );

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        // Buscar usuário
        const user = await DiscordSyncService.getUserByDiscordId(interaction.user.id);
        
        if (!user) {
            const embed = new EmbedBuilder()
                .setColor('#ffa94d')
                .setTitle('⚠️ Conta não encontrada')
                .setDescription(
                    'Você precisa estar logado para ver seus produtos!\n\n' +
                    '**Use:** `/login` ou `/registrar`'
                )
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Buscar produtos
        const produtos = await DiscordSyncService.getUserProducts(user.id);
        const pagina = interaction.options.getInteger('pagina') || 1;
        const produtosPorPagina = 5;
        const totalPaginas = Math.ceil(produtos.length / produtosPorPagina);
        const inicio = (pagina - 1) * produtosPorPagina;
        const fim = inicio + produtosPorPagina;
        const produtosPagina = produtos.slice(inicio, fim);
        
        if (produtos.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#74c0fc')
                .setTitle('📦 Nenhum produto encontrado')
                .setDescription(
                    'Você ainda não tem produtos monitorados!\n\n' +
                    '**Para adicionar produtos:**\n' +
                    '• Use `/adicionar-produto` no Discord\n' +
                    '• Acesse o site: https://promoping.com\n' +
                    '• Use o botão abaixo para adicionar agora!'
                )
                .setTimestamp();
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('adicionar_produto')
                        .setLabel('➕ Adicionar Produto')
                        .setStyle(ButtonStyle.Primary)
                );
            
            return await interaction.editReply({ embeds: [embed], components: [row] });
        }
        
        // Criar embed com produtos
        const embed = new EmbedBuilder()
            .setColor('#51cf66')
            .setTitle(`📦 Seus Produtos (${produtos.length})`)
            .setDescription(`Página ${pagina} de ${totalPaginas}`)
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp();
        
        produtosPagina.forEach((produto, index) => {
            const precoAtual = produto.preco_atual || produto.ultimo_preco || 'N/A';
            const precoAlvo = produto.preco_alvo ? `€${produto.preco_alvo}` : 'Não definido';
            const status = produto.ativo ? '✅ Ativo' : '❌ Inativo';
            const loja = produto.loja || 'Desconhecida';
            
            embed.addFields({
                name: `${inicio + index + 1}. ${produto.nome}`,
                value: 
                    `**Loja:** ${loja}\n` +
                    `**Preço atual:** €${precoAtual}\n` +
                    `**Preço alvo:** ${precoAlvo}\n` +
                    `**Status:** ${status}\n` +
                    `**Adicionado:** <t:${Math.floor(new Date(produto.criado_em).getTime() / 1000)}:R>\n` +
                    `[Ver produto](${produto.url})`,
                inline: true
            });
        });
        
        // Adicionar estatísticas gerais
        const produtosAtivos = produtos.filter(p => p.ativo).length;
        const precoMedio = produtos.length > 0 
            ? (produtos.reduce((sum, p) => sum + (p.preco_atual || p.ultimo_preco || 0), 0) / produtos.length).toFixed(2)
            : 0;
        
        embed.addFields({
            name: '📊 Estatísticas',
            value: 
                `**Total:** ${produtos.length} produtos\n` +
                `**Ativos:** ${produtosAtivos} produtos\n` +
                `**Preço médio:** €${precoMedio}`,
            inline: false
        });
        
        // Botões de navegação
        const row = new ActionRowBuilder();
        
        if (pagina > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`produtos_pagina_${pagina - 1}`)
                    .setLabel('⬅️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        if (pagina < totalPaginas) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`produtos_pagina_${pagina + 1}`)
                    .setLabel('Próxima ➡️')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('adicionar_produto')
                .setLabel('➕ Adicionar')
                .setStyle(ButtonStyle.Primary)
        );
        
        await interaction.editReply({ 
            embeds: [embed], 
            components: row.components.length > 0 ? [row] : []
        });
        
    } catch (error) {
        console.error('Erro no comando meus-produtos:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Erro interno')
            .setDescription('Ocorreu um erro inesperado. Tente novamente mais tarde.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}
