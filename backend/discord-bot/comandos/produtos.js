const { EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'produtos',
    aliases: ['meusprodutos', 'listar', 'lista', 'products'],
    description: 'Lista todos os produtos que você está monitorando.',
    execute: async (client, message, args, botInstance) => {
        try {
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'pap',
                port: parseInt(process.env.DB_PORT) || 3306
            };

            const connection = await mysql.createConnection(dbConfig);

            // Buscar usuário pelo Discord ID
            const [users] = await connection.execute(
                'SELECT ReferenciaID, Email FROM utilizadores WHERE discord_id = ?',
                [message.author.id]
            );

            if (users.length === 0) {
                await connection.end();
                return message.reply('**Você não está registado!** Use `!registar <email> <senha>` para criar uma conta.');
            }

            const user = users[0];

            // Buscar produtos do usuário
            const [produtos] = await connection.execute(`
                SELECT p.Id, p.Nome, p.Link, p.PrecoAtual, p.PrecoAlvo, p.UpdatedAt,
                       (SELECT hp.Preco FROM historicoprecos hp 
                        WHERE hp.ProdutoId = p.Id 
                        ORDER BY hp.DataRegisto DESC LIMIT 1 OFFSET 1) as PrecoAnterior
                FROM produtos p 
                WHERE p.ReferenciaID = ? AND p.DeletedAt IS NULL 
                ORDER BY p.UpdatedAt DESC
            `, [user.ReferenciaID]);

            await connection.end();

            if (produtos.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('Seus Produtos')
                    .setDescription('**Você ainda não tem produtos monitorados.**\n\nAdicione produtos através do website PromoPing para começar a monitorar preços!')
                    .addFields({
                        name: 'Como Adicionar Produtos',
                        value: '1. Acesse o website PromoPing\n2. Faça login com suas credenciais\n3. Adicione produtos para monitorar\n4. Volte aqui e use `!produtos` novamente',
                        inline: false
                    })
                    .setColor(0xffa500)
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            // Criar embeds para os produtos (máximo 10 por embed)
            const produtosPorEmbed = 10;
            const totalEmbeds = Math.ceil(produtos.length / produtosPorEmbed);
            const embeds = [];

            for (let i = 0; i < totalEmbeds; i++) {
                const produtosAtuais = produtos.slice(i * produtosPorEmbed, (i + 1) * produtosPorEmbed);
                
                const embed = new EmbedBuilder()
                    .setTitle(`Seus Produtos ${totalEmbeds > 1 ? `(${i + 1}/${totalEmbeds})` : ''}`)
                    .setDescription(`**${produtos.length} produto(s) monitorado(s)**`)
                    .setColor(0x00bfff)
                    .setTimestamp();

                produtosAtuais.forEach((produto, index) => {
                    const precoAtual = parseFloat(produto.PrecoAtual || 0);
                    const precoAlvo = parseFloat(produto.PrecoAlvo || 0);
                    const precoAnterior = parseFloat(produto.PrecoAnterior || 0);
                    
                    let status = '';
                    let diferenca = '';
                    
                    if (precoAnterior > 0) {
                        const mudanca = precoAtual - precoAnterior;
                        const percentual = ((mudanca / precoAnterior) * 100).toFixed(1);
                        
                        if (mudanca > 0) {
                            status = '[+]';
                            diferenca = `+€${mudanca.toFixed(2)} (+${percentual}%)`;
                        } else if (mudanca < 0) {
                            status = '[-]';
                            diferenca = `€${mudanca.toFixed(2)} (${percentual}%)`;
                        } else {
                            status = '';
                            diferenca = 'Sem mudança';
                        }
                    }

                    if (precoAtual <= precoAlvo && precoAlvo > 0) {
                        status = '[META]';
                        diferenca = 'Meta atingida!';
                    }

                    const loja = extrairLoja(produto.Link);
                    const dataAtualizacao = new Date(produto.UpdatedAt).toLocaleDateString('pt-PT');

                    embed.addFields({
                        name: `${status} ${produto.Nome}`,
                        value: [
                            `**Preço Atual:** €${precoAtual.toFixed(2)}`,
                            `**Preço Alvo:** €${precoAlvo.toFixed(2)}`,
                            `**Loja:** ${loja}`,
                            `**Mudança:** ${diferenca}`,
                            `**Atualizado:** ${dataAtualizacao}`
                        ].join('\n'),
                        inline: true
                    });
                });

                embeds.push(embed);
            }

            // Enviar primeiro embed
            await message.reply({ embeds: [embeds[0]] });

            // Enviar embeds adicionais se houver
            for (let i = 1; i < embeds.length; i++) {
                await message.followUp({ embeds: [embeds[i]] });
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando produtos:', error);
            await message.reply('**Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};

function extrairLoja(url) {
    try {
        const domain = new URL(url).hostname.toLowerCase();
        if (domain.includes('amazon')) return 'Amazon';
        if (domain.includes('fnac')) return 'Fnac';
        if (domain.includes('worten')) return 'Worten';
        if (domain.includes('elcorteingles')) return 'El Corte Inglés';
        if (domain.includes('continente')) return 'Continente';
        if (domain.includes('pcdiga')) return 'PCDiga';
        if (domain.includes('worten')) return 'Worten';
        if (domain.includes('mediamarkt')) return 'MediaMarkt';
        return 'Loja Online';
    } catch {
        return 'Loja Online';
    }
}
