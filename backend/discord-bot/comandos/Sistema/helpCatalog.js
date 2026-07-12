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
            title: "Aniversarios",
            status: "ativo",
            aliases: ["aniversario", "birthday", "bday"],
            summary: "Membros definem a data; admins escolhem canal, cargo e mensagem.",
            commands: [
                `${prefix}birthday set 2001-09-17`,
                `${prefix}birthday check @utilizador`,
                `${prefix}birthday channel #aniversarios`,
                `${prefix}birthday role @aniversariante`,
                `${prefix}birthday message Parabens {user}!`,
                `${prefix}birthday toggle on`,
            ],
            setup: [
                "Cada membro guarda a propria data com `birthday set YYYY-MM-DD`.",
                "A staff define o canal e cargo opcional.",
                "Ativa o modulo com `birthday toggle on`.",
            ],
        },
        {
            key: "comunidade",
            title: "Comunidade",
            status: "ativo",
            aliases: ["community", "comunidade"],
            summary: "Ferramentas sociais do servidor: contagem, regras, reviews e sugestoes.",
            commands: [
                `${prefix}counting configurar #canal`,
                `${prefix}regras`,
                `${prefix}review`,
                `${prefix}sugerir`,
            ],
            setup: [
                "Usa `counting configurar #canal` para ligar a contagem.",
                "Os comandos `review` e `sugerir` ja enviam conteudo para a base de dados e paineis.",
            ],
        },
        {
            key: "conta",
            title: "Conta",
            status: "ativo",
            aliases: ["account", "conta", "login", "registar"],
            summary: "Liga o Discord à conta PromoPing para produtos, alertas e suporte.",
            commands: [
                `${prefix}registar`,
                `${prefix}login`,
                `${prefix}sair`,
                `${prefix}produtos`,
            ],
            setup: [
                "Usa `registar` para abrir o site e criar conta.",
                "Usa `login` para conectar a conta existente no site.",
                "Depois usa `produtos`, `iniciar` e `parar` para o teu acompanhamento.",
            ],
        },
        {
            key: "giveaways",
            title: "Giveaways",
            status: "ativo",
            aliases: ["giveaway", "giveaways", "sorteio", "gstart"],
            summary: "Sistema simples de giveaways com reacao e fecho automatico.",
            commands: [
                `${prefix}gstart 1h 2 Nitro Classic`,
                `${prefix}glist`,
                `${prefix}gend 123456789012345678`,
                `${prefix}greroll 123456789012345678`,
                `${prefix}gdelete 123456789012345678`,
            ],
            setup: [
                "Cria no canal atual com `gstart <tempo> <vencedores> <premio>`.",
                "Os participantes entram reagindo com 🎉.",
                "O bot fecha automaticamente quando o tempo terminar.",
            ],
        },
        {
            key: "moderation",
            title: "Moderacao",
            status: "ativo",
            aliases: ["moderation", "moderacao", "mod", "staff"],
            summary: "Ferramentas de staff para limpeza, locks, punicoes e controlo de canais.",
            commands: [
                `${prefix}helpadmin`,
                `${prefix}clear 20`,
                `${prefix}lock`,
                `${prefix}unlock`,
                `${prefix}ban @utilizador motivo`,
                `${prefix}timeout @utilizador 10m motivo`,
            ],
            setup: [
                "A maioria dos comandos exige permissoes do Discord ou cargo de staff.",
                "Usa `helpadmin` para ver o bloco de configuracao administrativa.",
            ],
        },
        {
            key: "painel",
            title: "Paineis",
            status: "ativo",
            aliases: ["painel", "panel", "paineis"],
            summary: "Paineis prontos para comunidade, convites, sponsor, reviews, tickets e formularios.",
            commands: [
                `${prefix}painel`,
                `${prefix}community-panel #canal`,
                `${prefix}invite-panel #canal`,
                `${prefix}sponsor-panel #canal`,
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
            summary: "Resumo rapido do perfil Discord do utilizador.",
            commands: [
                `${prefix}profile`,
                `${prefix}profile @utilizador`,
            ],
            setup: [
                "Nao precisa de configuracao previa.",
            ],
        },
        {
            key: "suporte",
            title: "Suporte",
            status: "ativo",
            aliases: ["suporte", "support", "ticket"],
            summary: "Cria tickets por DM, paineis de suporte e encerramento assistido.",
            commands: [
                `${prefix}suporte Preciso de ajuda com notificacoes`,
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
            title: "Verificacao",
            status: "ativo",
            aliases: ["verify", "verification", "verificar", "verifu"],
            summary: "Painel com botao que entrega um cargo ao membro verificado.",
            commands: [
                `${prefix}verify setup #canal @cargo`,
                `${prefix}verify message Clica no botao para entrar`,
                `${prefix}verify button Verificar-me`,
                `${prefix}verify resend`,
                `${prefix}verify disable`,
            ],
            setup: [
                "Primeiro cria o painel com canal e cargo.",
                "Depois ajusta texto e botao, e republica com `verify resend` se quiseres.",
            ],
        },
        {
            key: "welcome",
            title: "Welcome",
            status: "ativo",
            aliases: ["welcome", "boasvindas", "wel"],
            summary: "Mensagem de entrada com placeholders e cargo automatico opcional.",
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
            summary: "Monitoriza um canal do YouTube e publica novos videos num canal Discord.",
            commands: [
                `${prefix}youtube status`,
                `${prefix}youtube enable https://www.youtube.com/channel/UC... #avisos true`,
                `${prefix}youtube disable`,
            ],
            setup: [
                "Usa o ID do canal do YouTube ou uma URL `/channel/UC...`.",
                "O ultimo video atual fica guardado para evitar disparar tudo de uma vez.",
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
