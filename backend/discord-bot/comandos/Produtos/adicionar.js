const { EmbedBuilder } = require('discord.js');
const {
    getLinkedUser,
    addProductForUser,
    parsePrice,
    isAllowedProductUrl,
} = require('../../utils/discordProductService');

function parseArgs(args) {
    if (!Array.isArray(args) || args.length < 2) {
        return { error: '**Uso:** `!adicionar <link> <preço-alvo> [nome opcional]`\n**Exemplo:** `!adicionar https://www.worten.pt/produto 49.99`' };
    }

    const link = args[0];
    const precoRaw = args[1];
    const nome = args.slice(2).join(' ').trim() || null;

    if (!isAllowedProductUrl(link)) {
        return { error: 'O primeiro argumento deve ser um link válido (http:// ou https://).' };
    }

    const precoAlvo = parsePrice(precoRaw);
    if (!precoAlvo) {
        return { error: 'Indica um preço alvo válido (ex: `29.99` ou `29,99`).' };
    }

    return { link, precoAlvo, nome };
}

module.exports = {
    name: 'adicionar',
    aliases: ['add', 'addproduto', 'monitorar', 'track'],
    category: 'Produtos',
    description: 'Adiciona um produto para monitorizar preços pelo Discord.',
    usage: '!adicionar <link> <preço-alvo> [nome]',
    execute: async (client, message, args) => {
        try {
            const user = await getLinkedUser(message.author.id);
            if (!user) {
                return message.reply('**Não estás ligado ao PromoPing.** Usa `!login` para conectar a tua conta antes de adicionar produtos.');
            }

            const parsed = parseArgs(args);
            if (parsed.error) {
                return message.reply(parsed.error);
            }

            const result = await addProductForUser(user.ReferenciaID, parsed);
            if (!result.ok) {
                if (result.code === 'LIMIT_REACHED') {
                    const embed = new EmbedBuilder()
                        .setTitle('Limite de produtos atingido')
                        .setDescription(result.message)
                        .addFields(
                            { name: 'Utilizados', value: `${result.total}/${result.limite}`, inline: true },
                            { name: 'Solução', value: 'Usa `!plano` para ver o teu plano ou faz upgrade em [promoping.pt](https://promoping.pt/dashboard/subscription-plans.html).', inline: false }
                        )
                        .setColor(0xff6b6b)
                        .setTimestamp();
                    return message.reply({ embeds: [embed] });
                }
                return message.reply(`**Não foi possível adicionar o produto.** ${result.message}`);
            }

            const { product, limite, total } = result;
            const embed = new EmbedBuilder()
                .setTitle('Produto adicionado')
                .setDescription(`**${product.Nome}** foi adicionado à tua lista.`)
                .setColor(0x2ecc71)
                .addFields(
                    { name: 'Preço alvo', value: `€${Number(product.PrecoAlvo).toFixed(2)}`, inline: true },
                    { name: 'Loja', value: product.Loja, inline: true },
                    { name: 'Produtos', value: `${total}/${limite}`, inline: true },
                    { name: 'Link', value: product.Link, inline: false },
                    { name: 'Próximo passo', value: 'A verificação é feita automaticamente pela plataforma. Receberás alertas por Discord quando o preço mudar.', inline: false }
                )
                .setFooter({ text: '© PromoPing • Usa !produtos para ver a lista' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[DISCORD] Erro no comando adicionar:', error);
            return message.reply('**Erro interno.** Tenta novamente dentro de alguns minutos.');
        }
    },
};
