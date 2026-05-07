(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();
    let currentStatus = 'pending';
    let currentRejectApplicationId = null;

    async function fetchAuth(url, options = {}) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const response = await fetch(safeUrl, {
            ...options,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}`);
        }
        return data;
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(value);
        return div.innerHTML;
    }

    function formatDateTime(value) {
        if (!value) return 'N/A';
        return new Date(value).toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function statusBadgeClass(status) {
        const normalized = String(status || '').toLowerCase();
        return ['pending', 'approved', 'rejected'].includes(normalized) ? normalized : 'pending';
    }

    function updateCounts(counts) {
        document.getElementById('countPending').textContent = counts.pending || 0;
        document.getElementById('countApproved').textContent = counts.approved || 0;
        document.getElementById('countRejected').textContent = counts.rejected || 0;
        document.getElementById('countTotal').textContent = counts.total || 0;
    }

    function buildApplicationCard(application) {
        const company = application.company || {};
        const applicant = application.applicant || {};
        const isPending = application.status === 'pending';
        const reviewNote = application.reviewNote
            ? `<div class="business-review-note"><strong>Nota da revisao</strong><br>${escapeHtml(application.reviewNote).replace(/\n/g, '<br>')}</div>`
            : '';

        const reviewerLine = application.reviewedBy
            ? `<div>Revisto por: ${escapeHtml(application.reviewedBy.nome || application.reviewedBy.referenciaID || '-')}</div>`
            : '';

        return `
            <article class="business-review-card">
                <div class="business-review-card-header">
                    <div>
                        <h3>${escapeHtml(company.nomeEmpresa || 'Empresa sem nome')}</h3>
                        <div class="business-review-meta">
                            <div>Criado em ${formatDateTime(application.createdAt)}</div>
                            <div>Plano pedido: ${escapeHtml(application.requestedPlanName || 'Corporate')}</div>
                            <div>Email principal: ${escapeHtml(company.billingEmail || applicant.email || '-')}</div>
                            ${application.reviewedAt ? `<div>Revisto em ${formatDateTime(application.reviewedAt)}</div>` : ''}
                            ${reviewerLine}
                        </div>
                    </div>
                    <span class="business-review-badge ${statusBadgeClass(application.status)}">${escapeHtml(application.status)}</span>
                </div>

                <div class="business-review-columns">
                    <div class="business-review-box">
                        <strong>Responsavel</strong>
                        <div>
                            ${escapeHtml(applicant.nome || '-')}<br>
                            ${escapeHtml(applicant.email || '-')}<br>
                            ${escapeHtml(applicant.telefone || '-')}
                        </div>
                    </div>
                    <div class="business-review-box">
                        <strong>Dados comerciais</strong>
                        <div>
                            NIF: ${escapeHtml(company.nif || '-')}<br>
                            VAT: ${escapeHtml(company.vatNumber || '-')}<br>
                            Setor: ${escapeHtml(company.setor || '-')}<br>
                            Categoria: ${escapeHtml(company.categoria || '-')}
                        </div>
                    </div>
                    <div class="business-review-box">
                        <strong>Contacto da empresa</strong>
                        <div>
                            Responsavel: ${escapeHtml(company.pessoaResponsavel || '-')}<br>
                            Telefone: ${escapeHtml(company.telefoneComercial || '-')}<br>
                            Website: ${company.website ? `<a href="${escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(company.website)}</a>` : '-'}
                        </div>
                    </div>
                    <div class="business-review-box">
                        <strong>Morada</strong>
                        <div>
                            ${escapeHtml(company.morada?.linha1 || '-')}<br>
                            ${company.morada?.linha2 ? `${escapeHtml(company.morada.linha2)}<br>` : ''}
                            ${escapeHtml(company.morada?.codigoPostal || '-')} ${escapeHtml(company.morada?.cidade || '')}<br>
                            ${escapeHtml(company.morada?.pais || '-')}
                        </div>
                    </div>
                </div>

                ${reviewNote}

                <div class="business-review-actions">
                    ${isPending ? `<button class="business-review-button approve" type="button" data-action="approve" data-id="${application.id}">Aprovar empresa</button>` : ''}
                    ${isPending ? `<button class="business-review-button reject" type="button" data-action="reject" data-id="${application.id}">Recusar empresa</button>` : ''}
                    ${application.approvedOrganizationId ? `<button class="business-review-button neutral" type="button">Organizacao #${application.approvedOrganizationId}</button>` : ''}
                </div>
            </article>
        `;
    }

    async function loadApplications() {
        const container = document.getElementById('businessApplicationsList');
        container.innerHTML = '<div class="business-review-empty">A carregar candidaturas...</div>';

        try {
            const data = await fetchAuth(`/api/corporation/business-applications?status=${encodeURIComponent(currentStatus)}`);
            updateCounts(data.counts || {});

            const applications = data.applications || [];
            if (applications.length === 0) {
                container.innerHTML = '<div class="business-review-empty">Nao ha candidaturas neste filtro.</div>';
                return;
            }

            container.innerHTML = applications.map(buildApplicationCard).join('');

            container.querySelectorAll('[data-action="approve"]').forEach((button) => {
                button.addEventListener('click', () => approveApplication(button.dataset.id));
            });

            container.querySelectorAll('[data-action="reject"]').forEach((button) => {
                button.addEventListener('click', () => openRejectModal(button.dataset.id));
            });
        } catch (error) {
            container.innerHTML = `<div class="business-review-empty" style="color: #fca5a5;">Erro: ${escapeHtml(error.message)}</div>`;
        }
    }

    async function approveApplication(applicationId) {
        const onConfirm = async () => {
            try {
                await fetchAuth(`/api/corporation/business-applications/${encodeURIComponent(applicationId)}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({})
                });
                if (window.showAlert) {
                    showAlert('Empresa aprovada e email enviado.');
                } else {
                    alert('Empresa aprovada e email enviado.');
                }
                loadApplications();
            } catch (error) {
                if (window.showAlert) {
                    showAlert(`Erro: ${error.message}`);
                } else {
                    alert(`Erro: ${error.message}`);
                }
            }
        };

        if (window.showConfirm) {
            showConfirm('Aprovar esta empresa e ativar a organizacao business?', 'Aprovar', onConfirm);
        } else if (confirm('Aprovar esta empresa e ativar a organizacao business?')) {
            onConfirm();
        }
    }

    function openRejectModal(applicationId) {
        currentRejectApplicationId = applicationId;
        document.getElementById('rejectReviewNote').value = '';
        document.getElementById('rejectApplicationModal').classList.add('show');
    }

    function closeRejectModal() {
        currentRejectApplicationId = null;
        document.getElementById('rejectApplicationModal').classList.remove('show');
    }

    async function confirmReject() {
        if (!currentRejectApplicationId) return;

        const reviewNote = document.getElementById('rejectReviewNote').value.trim();
        const button = document.getElementById('confirmRejectBtn');
        button.disabled = true;

        try {
            await fetchAuth(`/api/corporation/business-applications/${encodeURIComponent(currentRejectApplicationId)}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reviewNote })
            });
            closeRejectModal();
            if (window.showAlert) {
                showAlert('Empresa recusada e email enviado.');
            } else {
                alert('Empresa recusada e email enviado.');
            }
            loadApplications();
        } catch (error) {
            if (window.showAlert) {
                showAlert(`Erro: ${error.message}`);
            } else {
                alert(`Erro: ${error.message}`);
            }
        } finally {
            button.disabled = false;
        }
    }

    function setupFilters() {
        document.querySelectorAll('.business-review-filter').forEach((button) => {
            button.addEventListener('click', () => {
                currentStatus = button.dataset.status || 'pending';
                document.querySelectorAll('.business-review-filter').forEach((item) => item.classList.remove('active'));
                button.classList.add('active');
                loadApplications();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupFilters();
        document.getElementById('refreshApplicationsBtn')?.addEventListener('click', loadApplications);
        document.getElementById('confirmRejectBtn')?.addEventListener('click', confirmReject);
        document.getElementById('cancelRejectBtn')?.addEventListener('click', closeRejectModal);
        document.getElementById('closeRejectModal')?.addEventListener('click', closeRejectModal);
        document.getElementById('rejectApplicationModal')?.addEventListener('click', (event) => {
            if (event.target.id === 'rejectApplicationModal') {
                closeRejectModal();
            }
        });
        loadApplications();
    });
})();
