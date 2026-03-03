/**
 * OverviewViewModel - PromoPing Admin
 * ViewModel para a página de Visão Geral usando padrão MVVM
 */

(function() {
    'use strict';

    class OverviewViewModel extends ViewModel {
        constructor() {
            super();
            
            // Estado inicial
            this.setState({
                loading: false,
                stats: {
                    usersActive: 0,
                    productsMonitored: 0,
                    supportThreads: 0,
                    bugsOpen: 0
                },
                recentActivity: []
            });
        }

        /**
         * Carrega todas as estatísticas do overview
         */
        async loadOverview() {
            this.setState({ loading: true });

            try {
                // Carregar estatísticas em paralelo
                const [usersRes, productsRes, supportRes, bugsRes] = await Promise.all([
                    this.fetchAuth('/api/admin/users?limit=1').catch(() => null),
                    this.fetchAuth('/api/admin/products?limit=1').catch(() => null),
                    this.fetchAuth('/api/support/messages/admin').catch(() => null),
                    this.fetchAuth('/api/admin/bugs').catch(() => null)
                ]);

                // Processar dados de usuários
                let usersTotal = 0;
                if (usersRes) {
                    try {
                        const usersData = await usersRes.json();
                        usersTotal = usersData.total || 0;
                    } catch (err) {
                        console.error('[OverviewViewModel] Erro ao processar dados de usuários:', err);
                    }
                }

                // Processar dados de produtos
                let productsTotal = 0;
                if (productsRes) {
                    try {
                        const productsData = await productsRes.json();
                        productsTotal = productsData.total || 0;
                    } catch (err) {
                        console.error('[OverviewViewModel] Erro ao processar dados de produtos:', err);
                    }
                }

                // Processar dados de suporte
                let supportThreads = 0;
                if (supportRes) {
                    try {
                        const supportData = await supportRes.json();
                        supportThreads = (supportData.items || []).length;
                    } catch (err) {
                        console.error('[OverviewViewModel] Erro ao processar dados de suporte:', err);
                    }
                }

                // Processar dados de bugs
                let bugsOpen = 0;
                if (bugsRes) {
                    try {
                        const bugsData = await bugsRes.json();
                        bugsOpen = (bugsData.bugs || []).filter(b => {
                            const status = (b.Status || '').toLowerCase();
                            return status === 'open' || status === 'aberto' || 
                                   status === 'em progresso' || status === 'em_progresso' ||
                                   status === 'in progress' || status === 'in_progress';
                        }).length;
                    } catch (err) {
                        console.error('[OverviewViewModel] Erro ao processar dados de bugs:', err);
                    }
                }

                // Atualizar estado com estatísticas
                this.setState({
                    stats: {
                        usersActive: usersTotal,
                        productsMonitored: productsTotal,
                        supportThreads: supportThreads,
                        bugsOpen: bugsOpen
                    },
                    loading: false
                });

                // Carregar atividade recente
                await this.loadRecentActivity();
            } catch (error) {
                console.error('[OverviewViewModel] Erro ao carregar overview:', error);
                this.setState({ loading: false });
            }
        }

        /**
         * Carrega atividade recente
         */
        async loadRecentActivity() {
            try {
                const [usersRes, productsRes] = await Promise.all([
                    this.fetchAuth('/api/admin/users?limit=5').catch(() => null),
                    this.fetchAuth('/api/admin/products?limit=5').catch(() => null)
                ]);

                const usersData = usersRes ? await usersRes.json().catch(() => ({ users: [] })) : { users: [] };
                const productsData = productsRes ? await productsRes.json().catch(() => ({ products: [] })) : { products: [] };

                const activities = [];

                // Adicionar novos usuários
                (usersData.users || []).forEach(user => {
                    activities.push({
                        type: 'user',
                        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                        title: 'Novo utilizador registado',
                        description: `${user.Nome} (${user.Email})`,
                        time: user.DataRegisto || user.Data_Registo
                    });
                });

                // Adicionar novos produtos
                (productsData.products || []).forEach(product => {
                    activities.push({
                        type: 'product',
                        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.27 6.96L12 12.01L20.73 6.96" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22.08V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                        title: 'Novo produto monitorizado',
                        description: `${product.Nome} por ${product.UserName || 'Usuário'}`,
                        time: product.DataCriacao
                    });
                });

                // Ordenar por data
                activities.sort((a, b) => new Date(b.time) - new Date(a.time));

                // Atualizar estado
                this.setState({
                    recentActivity: activities.slice(0, 10)
                });
            } catch (error) {
                console.error('[OverviewViewModel] Erro ao carregar atividade:', error);
            }
        }

        /**
         * Inicializa o ViewModel
         */
        async init() {
            if (!this.checkAuth()) return;
            await this.loadOverview();
        }
    }

    // Exportar para uso global
    window.OverviewViewModel = OverviewViewModel;

    console.log('[OverviewViewModel] Classe OverviewViewModel carregada');
})();
