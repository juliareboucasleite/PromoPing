/**
 * OverviewViewModel - PromoPing Admin
 * ViewModel para a página de Visão Geral usando padrão MVVM
 */

(function() {
    'use strict';

    class OverviewViewModel extends ViewModel {
        constructor() {
            super();

            this.setState({
                loading: false,
                stats: {
                    usersActive: 0,
                    productsMonitored: 0,
                    supportThreads: 0,
                    bugsOpen: 0,
                    reviewsTotal: 0,
                    reviewsAvg: null,
                    incidentsOpen: 0
                },
                recentActivity: [],
                recentBugs: [],
                recentIncidents: []
            });
        }

        async loadOverview() {
            this.setState({ loading: true });

            try {
                const [usersRes, productsRes, supportRes, bugsRes, reviewsRes, incidentsRes] = await Promise.all([
                    this.fetchAuth('/api/admin/users?limit=5').catch(() => null),
                    this.fetchAuth('/api/admin/products?limit=5').catch(() => null),
                    this.fetchAuth('/api/support/messages/admin').catch(() => null),
                    this.fetchAuth('/api/admin/bugs').catch(() => null),
                    this.fetchAuth('/api/admin/reviews').catch(() => null),
                    this.fetchAuth('/api/admin/incidents').catch(() => null)
                ]);

                let usersTotal = 0;
                let usersList = [];
                if (usersRes) {
                    try {
                        const usersData = await usersRes.json();
                        usersTotal = usersData.total || 0;
                        usersList = usersData.users || [];
                    } catch (err) { console.error('[Overview] users:', err); }
                }

                let productsTotal = 0;
                let productsList = [];
                if (productsRes) {
                    try {
                        const productsData = await productsRes.json();
                        productsTotal = productsData.total || 0;
                        productsList = productsData.products || [];
                    } catch (err) { console.error('[Overview] products:', err); }
                }

                let supportThreads = 0;
                if (supportRes) {
                    try {
                        const supportData = await supportRes.json();
                        supportThreads = (supportData.items || []).length;
                    } catch (err) { console.error('[Overview] support:', err); }
                }

                let bugsOpen = 0;
                let bugsList = [];
                if (bugsRes) {
                    try {
                        const bugsData = await bugsRes.json();
                        const allBugs = bugsData.bugs || [];
                        bugsOpen = allBugs.filter(b => {
                            const status = (b.Status || '').toLowerCase();
                            return status === 'open' || status === 'aberto' ||
                                   status === 'em progresso' || status === 'em_progresso' ||
                                   status === 'in progress' || status === 'in_progress';
                        }).length;
                        bugsList = allBugs.slice(0, 6);
                    } catch (err) { console.error('[Overview] bugs:', err); }
                }

                let reviewsTotal = 0;
                let reviewsAvg = null;
                if (reviewsRes) {
                    try {
                        const reviewsData = await reviewsRes.json();
                        const list = reviewsData.reviews || [];
                        reviewsTotal = reviewsData.total !== undefined ? reviewsData.total : list.length;
                        if (list.length > 0) {
                            const ratings = list.map(r => r.rating).filter(r => typeof r === 'number');
                            if (ratings.length) {
                                reviewsAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                            }
                        }
                    } catch (err) { console.error('[Overview] reviews:', err); }
                }

                let incidentsOpen = 0;
                let incidentsList = [];
                if (incidentsRes) {
                    try {
                        const incidentsData = await incidentsRes.json();
                        const all = incidentsData.incidents || incidentsData.items || [];
                        incidentsOpen = all.filter(i => {
                            const status = (i.Status || i.status || '').toLowerCase();
                            return status && status !== 'resolved' && status !== 'resolvido' && status !== 'fechado' && status !== 'closed';
                        }).length;
                        incidentsList = all.slice(0, 6);
                    } catch (err) { console.error('[Overview] incidents:', err); }
                }

                this.setState({
                    stats: {
                        usersActive: usersTotal,
                        productsMonitored: productsTotal,
                        supportThreads: supportThreads,
                        bugsOpen: bugsOpen,
                        reviewsTotal: reviewsTotal,
                        reviewsAvg: reviewsAvg,
                        incidentsOpen: incidentsOpen
                    },
                    recentBugs: bugsList,
                    recentIncidents: incidentsList,
                    loading: false
                });

                this.buildRecentActivity(usersList, productsList);
            } catch (error) {
                console.error('[OverviewViewModel] Erro ao carregar overview:', error);
                this.setState({ loading: false });
            }
        }

        buildRecentActivity(users, products) {
            const activities = [];

            (users || []).forEach(user => {
                activities.push({
                    type: 'user',
                    title: 'Novo utilizador',
                    description: `${user.Nome || user.nome || 'Utilizador'} (${user.Email || user.email || '—'})`,
                    time: user.DataRegisto || user.Data_Registo || user.created_at
                });
            });

            (products || []).forEach(product => {
                activities.push({
                    type: 'product',
                    title: 'Novo produto monitorizado',
                    description: `${product.Nome || 'Produto'} por ${product.UserName || 'Utilizador'}`,
                    time: product.DataCriacao || product.created_at
                });
            });

            activities.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

            this.setState({
                recentActivity: activities.slice(0, 10)
            });
        }

        async init() {
            if (!this.checkAuth()) return;
            await this.loadOverview();
        }
    }

    window.OverviewViewModel = OverviewViewModel;

    console.log('[OverviewViewModel] Classe OverviewViewModel carregada');
})();
