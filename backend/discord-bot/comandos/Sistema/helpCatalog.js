function normalizeQuery(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

function buildModules(prefix) {
    return [
        {
            key: "birthday",
            title: "Aniversários",
            status: "ativo",
            aliases: ["aniversario", "birthday", "bday"],
            summary: "Membros definem a data; admins escolhem canal, cargo e mensagem.",
            commands: [
                `${prefix}birthday set 2001-09-17`,
                `${prefix}birthday check @utilizador`,
                `${prefix}birthday channel #aniversarios`,
                `${prefix}birthday role @aniversariante`,
                `${prefix}birthday message Parabéns {user}!`,
                `${prefix}birthday toggle on`,
            ],
            setup: [
                "Cada membro guarda a própria data com `birthday set YYYY-MM-DD`.",
                "A staff define o canal e cargo opcional.",
                "Ativa o módulo com `birthday toggle on`.",
            ],
        },
        {
            key: "comunidade",
            title: "Comunidade",
            status: "ativo",
            aliases: ["community", "comunidade"],
            summary: "Ferramentas sociais do servidor: contagem, regras, reviews e sugestões.",
            commands: [
                `${prefix}counting configurar #canal`,
                `${prefix}regras`,
                `${prefix}review`,
                `${prefix}sugerir`,
            ],
            setup: [
                "Usa `counting configurar #canal` para ligar a contagem.",
                "Os comandos `review` e `sugerir` já enviam conteúdo para a base de dados e painéis.",
            ],
        },
        {
            key: "conta",
            title: "Conta",
            status: "ativo",
            aliases: ["account", "conta", "login", "registar"],
            summary: "Liga o Discord à conta PromoPing para produtos, alertas e suporte.",
            commands: [
                `${prefix}registar email@dominio.pt senha123`,
                `${prefix}login email@dominio.pt senha123`,
                `${prefix}sair`,
                `${prefix}produtos`,
            ],
            setup: [
                "Cria conta com `registar` ou faz `login` se já existe.",
                "Depois usa `produtos`, `iniciar` e `parar` para o teu acompanhamento.",
            ],
        },
        {
            key: "giveaways",
            title: "Giveaways",
            status: "ativo",
            aliases: ["giveaway", "giveaways", "sorteio", "gstart"],
            summary: "Sistema simples de giveaways com reação e fecho automático.",
            commands: [
                `${prefix}gstart 1h 2 Nitro Classic`,
                `${prefix}glist`,
                `${prefix}gend 123456789012345678`,
                `${prefix}greroll 123456789012345678`,
                `${prefix}gdelete 123456789012345678`,
            ],
            setup: [
                "Cria no canal atual com `gstart <tempo> <vencedores> <prémio>`.",
                "Os participantes entram reagindo com 🎉.",
                "O bot fecha automaticamente quando o tempo terminar.",
            ],
        },
        {
            key: "moderation",
            title: "Moderação",
            status: "ativo",
            aliases: ["moderation", "moderacao", "mod", "staff"],
            summary: "Ferramentas de staff para limpeza, locks, punições e controlo de canais.",
            commands: [
                `${prefix}helpadmin`,
                `${prefix}clear 20`,
                `${prefix}lock`,
                `${prefix}unlock`,
                `${prefix}ban @utilizador motivo`,
                `${prefix}timeout @utilizador 10m motivo`,
            ],
            setup: [
                "A maioria dos comandos exige permissões do Discord ou cargo de staff.",
                "Usa `helpadmin` para ver o bloco de configuração administrativa.",
            ],
        },
        {
            key: "music",
            title: "Música",
            status: "parcial",
            aliases: ["music", "musica", "player"],
            summary: "O módulo foi exposto no help, mas ainda depende de infra Lavalink no runtime principal.",
            commands: [
                `${prefix}music`,
            ],
            setup: [
                "Hoje o bot mostra o estado real do módulo com `music`.",
                "Os comandos legados de player ainda precisam de integração do runtime e nó Lavalink online.",
            ],
        },
        {
            key: "painel",
            title: "Painéis",
            status: "ativo",
            aliases: ["painel", "panel", "paineis"],
            summary: "Painéis prontos para comunidade, convites, reviews, tickets e formulários.",
            commands: [
                `${prefix}painel`,
                `${prefix}community-panel #canal`,
                `${prefix}invite-panel #canal`,
                `${prefix}review-panel #canal`,
                `${prefix}ticket`,
            ],
            setup: [
                "O atalho `painel` resume os setups mais usados.",
                "Usa os comandos no canal onde queres publicar o painel ou menciona um canal alvo.",
            ],
        },
        {
            key: "profile",
            title: "Perfil",
            status: "ativo",
            aliases: ["profile", "perfil", "pf"],
            summary: "Resumo rápido do perfil Discord do utilizador.",
            commands: [
                `${prefix}profile`,
                `${prefix}profile @utilizador`,
            ],
            setup: [
                "Não precisa de configuração prévia.",
            ],
        },
        {
            key: "suporte",
            title: "Suporte",
            status: "ativo",
            aliases: ["suporte", "support", "ticket"],
            summary: "Cria tickets por DM, painéis de suporte e encerramento assistido.",
            commands: [
                `${prefix}suporte Preciso de ajuda com notificações`,
                `${prefix}ticket`,
                `${prefix}fechar-ticket`,
                `${prefix}setup-bug`,
                `${prefix}setup-sugestao`,
            ],
            setup: [
                "Em DM, `suporte <mensagem>` abre ticket diretamente.",
                "No servidor, `ticket` publica o painel de abertura.",
            ],
        },
        {
            key: "verify",
            title: "Verificação",
            status: "ativo",
            aliases: ["verify", "verification", "verificar", "verifu"],
            summary: "Painel com botão que entrega um cargo ao membro verificado.",
            commands: [
                `${prefix}verify setup #canal @cargo`,
                `${prefix}verify message Clica no botão para entrar`,
                `${prefix}verify button Verificar-me`,
                `${prefix}verify resend`,
                `${prefix}verify disable`,
            ],
            setup: [
                "Primeiro cria o painel com canal e cargo.",
                "Depois ajusta texto e botão, e republica com `verify resend` se quiseres.",
            ],
        },
        {
            key: "welcome",
            title: "Welcome",
            status: "ativo",
            aliases: ["welcome", "boasvindas", "wel"],
            summary: "Mensagem de entrada com placeholders e cargo automático opcional.",
            commands: [
                `${prefix}welcome set #boas-vindas`,
                `${prefix}welcome message Bem-vindo(a) {user} a {guild}!`,
                `${prefix}welcome role @membro`,
                `${prefix}welcome test`,
                `${prefix}welcome disable`,
            ],
            setup: [
                "Define o canal, personaliza a mensagem e testa.",
                "Placeholders suportados: `{user}`, `{username}`, `{guild}`.",
            ],
        },
        {
            key: "youtube",
            title: "YouTube",
            status: "ativo",
            aliases: ["youtube", "yt", "ytnotifier"],
            summary: "Monitoriza um canal do YouTube e publica novos vídeos num canal Discord.",
            commands: [
                `${prefix}youtube status`,
                `${prefix}youtube enable https://www.youtube.com/channel/UC... #avisos true`,
                `${prefix}youtube disable`,
            ],
            setup: [
                "Usa o ID do canal do YouTube ou uma URL `/channel/UC...`.",
                "O último vídeo atual fica guardado para evitar disparar tudo de uma vez.",
            ],
        },
    ];
}

function getModuleByQuery(query, prefix) {
    const normalized = normalizeQuery(query);
    if (!normalized) return null;

    return buildModules(prefix).find((module) => {
        return normalizeQuery(module.key) === normalized
            || module.aliases.some((alias) => normalizeQuery(alias) === normalized);
    }) || null;
}

module.exports = {
    buildModules,
    getModuleByQuery,
    normalizeQuery,
};
