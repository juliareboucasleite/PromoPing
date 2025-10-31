(function (w) {
  async function detectApiBase() {
    const saved = localStorage.getItem('PROMOPING_API');
    if (saved) return saved.replace(/\/+$/,'');
    const candidates = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      window.location.origin
    ];
    for (const base of candidates) {
      try {
        const r = await fetch(`${base.replace(/\/+$/,'')}/api/health`, { method:'GET' });
        if (r.ok) {
          localStorage.setItem('PROMOPING_API', base);
          return base.replace(/\/+$/,'');
        }
      } catch (_) {}
    }
    return 'http://localhost:3000';
  }

  let API_BASE_GLOBAL = null;
  const initApiBasePromise = detectApiBase().then(b => { API_BASE_GLOBAL = b; return b; });

  function getApiBase() {
    return API_BASE_GLOBAL || (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000').replace(/\/+$/,'');
  }
  const TOKEN = localStorage.getItem('PROMOPING_TOKEN') || null;

  async function fetchJSON(path, opts = {}) {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
      opts.headers || {}
    );
    const resp = await fetch(`${getApiBase()}${path}`, Object.assign({}, opts, { headers }));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  }

  async function initDashboard() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    try {
      const data = await fetchJSON('/api/status');
      const m = data?.metricas || {};
      const $ = (id) => document.getElementById(id);
      if ($('users-active')) $('users-active').textContent = (m.UtilizadoresAtivos ?? 0).toLocaleString();
      if ($('products-count')) $('products-count').textContent = (m.ProdutosMonitorizados ?? 0).toLocaleString();
      if ($('notifications-today')) $('notifications-today').textContent = (m.NotificacoesEnviadas ?? 0).toLocaleString();
      if ($('uptime')) $('uptime').textContent = (m.UptimeGeral ?? 0).toFixed(2);

      const daily = await fetchJSON('/api/charts/daily?days=7').catch(()=>null);
      if (daily && w.Chart) {
        const ctx = document.getElementById('chart-bars')?.getContext('2d');
        if (ctx) {
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: daily.labels || ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],
              datasets: [{
                label: 'Notificações',
                backgroundColor: '#fff',
                data: (daily.series && daily.series.notificacoes) || [0,0,0,0,0,0,0],
                maxBarThickness: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } }
            }
          });
        }
      }

      const overview = await fetchJSON('/api/charts/overview?months=9').catch(()=>null);
      if (overview && w.Chart) {
        const ctx2 = document.getElementById('chart-line')?.getContext('2d');
        if (ctx2) {
          new Chart(ctx2, {
            type: 'line',
            data: {
              labels: overview.labels || [],
              datasets: [
                {
                  label: 'Utilizadores novos',
                  borderColor: '#cb0c9f',
                  backgroundColor: 'rgba(203,12,159,0.2)',
                  fill: true,
                  data: (overview.series && overview.series.utilizadoresNovos) || []
                },
                {
                  label: 'Produtos criados',
                  borderColor: '#3A416F',
                  backgroundColor: 'rgba(20,23,39,0.2)',
                  fill: true,
                  data: (overview.series && overview.series.produtosCriados) || []
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } }
            }
          });
        }
      }
    } catch {
      const $ = (id) => document.getElementById(id);
      if ($('users-active')) $('users-active').textContent = '0';
      if ($('products-count')) $('products-count').textContent = '0';
      if ($('notifications-today')) $('notifications-today').textContent = '0';
      if ($('uptime')) $('uptime').textContent = '99.9';
    }
  }

  function requireAuth(redirectTo = '../pages/sign-in.html') {
    if (!TOKEN) {
      const back = encodeURIComponent(location.pathname + location.search);
      location.href = `${redirectTo}?back=${back}`;
      return false;
    }
    return true;
  }

  // Função para obter badge de status do incidente
  function getStatusBadge(estado) {
    const statusMap = {
      'Ativo': { text: 'Ativo', class: 'bg-gradient-danger' },
      'Resolvido': { text: 'Resolvido', class: 'bg-gradient-success' },
      'Planeado': { text: 'Planeado', class: 'bg-gradient-info' },
      'investigating': { text: 'Investigando', class: 'bg-gradient-warning' },
      'identified': { text: 'Identificado', class: 'bg-gradient-info' },
      'monitoring': { text: 'Monitorizando', class: 'bg-gradient-primary' },
      'resolved': { text: 'Resolvido', class: 'bg-gradient-success' }
    };
    const status = statusMap[estado] || { text: estado || 'Desconhecido', class: 'bg-gradient-secondary' };
    return `<span class="badge badge-sm ${status.class}">${status.text}</span>`;
  }

  // Modal para visualizar detalhes do incidente
  function showIncidentDetails(incident) {
    const existingModal = document.getElementById('incident-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'incident-modal';
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.setAttribute('tabindex', '-1');
    
    const dataInicio = incident.DataInicio ? new Date(incident.DataInicio).toLocaleString('pt-BR') : '—';
    const dataFim = incident.DataFim ? new Date(incident.DataFim).toLocaleString('pt-BR') : 'Em andamento';
    const estado = incident.Estado || incident.Status || 'Desconhecido';
    
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content shadow-lg">
          <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);">
            <h5 class="modal-title text-white">
              <i class="fas fa-exclamation-triangle me-2"></i>
              Detalhes do Incidente #${incident.Id}
            </h5>
            <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
          </div>
          <div class="modal-body p-4">
            <div class="mb-3">
              <h6 class="text-uppercase text-xs text-secondary mb-2">Título</h6>
              <p class="mb-0 text-sm">${incident.Titulo || '—'}</p>
            </div>
            <div class="mb-3">
              <h6 class="text-uppercase text-xs text-secondary mb-2">Descrição</h6>
              <p class="mb-0 text-sm" style="white-space: pre-wrap;">${incident.Descricao || 'Sem descrição'}</p>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Status</h6>
                <div>${getStatusBadge(estado)}</div>
              </div>
              <div class="col-md-6">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Impacto</h6>
                <p class="mb-0 text-sm">${incident.Impacto || '—'}</p>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Data de Início</h6>
                <p class="mb-0 text-sm">${dataInicio}</p>
              </div>
              <div class="col-md-6">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Data de Fim</h6>
                <p class="mb-0 text-sm">${dataFim}</p>
              </div>
            </div>
            ${incident.ComponenteId ? `
              <div class="mb-3">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Componente Afetado</h6>
                <p class="mb-0 text-sm">Componente ID: ${incident.ComponenteId}</p>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Fechar</button>
            <button type="button" class="btn btn-primary" onclick="PromoPingAdmin.editIncidentById(${incident.Id})">
              <i class="fas fa-edit me-1"></i> Editar
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Buscar e mostrar detalhes do incidente
  async function viewIncidentById(incidentId) {
    try {
      const res = await fetchJSON(`/api/incidentes/${incidentId}`);
      const incident = res.incidente || res;
      if (incident) {
        showIncidentDetails(incident);
      } else {
        alert('Incidente não encontrado.');
      }
    } catch (err) {
      console.error('Erro ao carregar incidente:', err);
      alert('Erro ao carregar detalhes do incidente.');
    }
  }

  // Editar incidente
  async function editIncidentById(incidentId) {
    const viewModal = document.getElementById('incident-modal');
    if (viewModal) viewModal.remove();

    try {
      const res = await fetchJSON(`/api/incidentes/${incidentId}`);
      const incident = res.incidente || res;
      
      if (!incident) {
        alert('Incidente não encontrado.');
        return;
      }

      const existingModal = document.getElementById('incident-edit-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'incident-edit-modal';
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.setAttribute('tabindex', '-1');
      
      const dataInicio = incident.DataInicio ? new Date(incident.DataInicio).toISOString().slice(0, 16) : '';
      const dataFim = incident.DataFim ? new Date(incident.DataFim).toISOString().slice(0, 16) : '';
      const estado = incident.Estado || incident.Status || 'Resolvido';
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content shadow-lg">
            <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);">
              <h5 class="modal-title text-white">
                <i class="fas fa-edit me-2"></i>
                Editar Incidente #${incidentId}
              </h5>
              <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
            </div>
            <div class="modal-body p-4">
              <form id="incident-edit-form">
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Título</label>
                  <input type="text" class="form-control form-control-sm" id="edit-titulo" value="${(incident.Titulo || '').replace(/"/g, '&quot;')}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Descrição</label>
                  <textarea class="form-control form-control-sm" id="edit-descricao" rows="4" required>${(incident.Descricao || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label text-sm font-weight-bold">Status</label>
                    <select class="form-select form-select-sm" id="edit-estado" required>
                      <option value="Ativo" ${estado === 'Ativo' ? 'selected' : ''}>Ativo</option>
                      <option value="Resolvido" ${estado === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                      <option value="Planeado" ${estado === 'Planeado' ? 'selected' : ''}>Planeado</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label text-sm font-weight-bold">Impacto</label>
                    <input type="text" class="form-control form-control-sm" id="edit-impacto" value="${(incident.Impacto || '').replace(/"/g, '&quot;')}">
                  </div>
                </div>
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label text-sm font-weight-bold">Data de Início</label>
                    <input type="datetime-local" class="form-control form-control-sm" id="edit-data-inicio" value="${dataInicio}" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label text-sm font-weight-bold">Data de Fim</label>
                    <input type="datetime-local" class="form-control form-control-sm" id="edit-data-fim" value="${dataFim}">
                  </div>
                </div>
                <div id="edit-feedback" class="text-xs mb-2"></div>
              </form>
            </div>
            <div class="modal-footer border-0">
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
              <button type="button" class="btn btn-primary" id="save-incident-btn">
                <i class="fas fa-save me-1"></i> Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      const saveBtn = modal.querySelector('#save-incident-btn');
      saveBtn.addEventListener('click', async () => {
        const form = modal.querySelector('#incident-edit-form');
        const feedback = modal.querySelector('#edit-feedback');
        
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Guardando...';
        feedback.textContent = '';
        
        try {
          // Converter datetime-local para formato MySQL (YYYY-MM-DD HH:mm:ss)
          const dataInicioRaw = modal.querySelector('#edit-data-inicio').value;
          const dataFimRaw = modal.querySelector('#edit-data-fim').value;
          
          let dataInicio = null;
          if (dataInicioRaw) {
            dataInicio = dataInicioRaw.replace('T', ' ');
            // Garantir que tenha segundos (HH:mm:ss)
            if (dataInicio.split(':').length === 2) {
              dataInicio += ':00';
            }
          }
          
          let dataFim = null;
          if (dataFimRaw && dataFimRaw.trim() !== '') {
            dataFim = dataFimRaw.replace('T', ' ');
            // Garantir que tenha segundos (HH:mm:ss)
            if (dataFim.split(':').length === 2) {
              dataFim += ':00';
            }
          }
          
          const data = {
            Titulo: modal.querySelector('#edit-titulo').value.trim(),
            Descricao: modal.querySelector('#edit-descricao').value.trim(),
            Estado: modal.querySelector('#edit-estado').value,
            Impacto: modal.querySelector('#edit-impacto').value.trim() || null,
            DataInicio: dataInicio,
            DataFim: dataFim
          };
          
          await fetchJSON(`/api/incidentes/${incidentId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
          
          feedback.textContent = 'Incidente atualizado com sucesso!';
          feedback.className = 'text-xs text-success mb-2';
          
          setTimeout(() => {
            modal.remove();
            initTables(); // Recarregar tabela do painel admin
            
            // Notificar usuário que mudanças foram salvas
            if (typeof window.showSuccess === 'function') {
              window.showSuccess('Incidente atualizado', 'As alterações foram salvas com sucesso!');
            }
            
            // Disparar evento para atualizar página de documentação se estiver aberta
            // Usar localStorage para comunicação entre abas
            try {
              localStorage.setItem('incidentes_updated', Date.now().toString());
              // Também disparar evento customizado (para mesma janela)
              window.dispatchEvent(new CustomEvent('incidentes_updated'));
              console.log('Incidente atualizado com sucesso. A página de documentação será atualizada automaticamente.');
            } catch (e) {
              console.log('Não foi possível notificar atualização via storage:', e);
            }
          }, 1000);
        } catch (err) {
          console.error('Erro ao salvar:', err);
          feedback.textContent = 'Erro ao salvar incidente. Tente novamente.';
          feedback.className = 'text-xs text-danger mb-2';
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Alterações';
        }
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (err) {
      console.error('Erro ao carregar incidente:', err);
      alert('Erro ao carregar dados do incidente.');
    }
  }

  async function initTables() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    const tbody = document.getElementById('incidentes-body');
    if (!tbody) return;
    try {
      const res = await fetchJSON('/api/incidentes');
      const list = (res && res.incidentes) || [];
      
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary text-sm py-4">Sem dados</td></tr>`;
        return;
      }
      
      tbody.innerHTML = list.map(inc => {
        const estado = inc.Estado || inc.Status || 'Desconhecido';
        const dataInicio = inc.DataInicio ? new Date(inc.DataInicio).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '—';
        
        return `
          <tr>
            <td class="align-middle" style="padding-left: 1rem; text-align: left;">
              <p class="text-xs font-weight-bold mb-0">${inc.Id || '—'}</p>
            </td>
            <td class="align-middle ps-2">
              <p class="text-xs font-weight-bold mb-0">${(inc.Titulo || '—').substring(0, 50)}${inc.Titulo && inc.Titulo.length > 50 ? '...' : ''}</p>
            </td>
            <td class="align-middle text-center">
              ${getStatusBadge(estado)}
            </td>
            <td class="align-middle text-center">
              <span class="text-secondary text-xs font-weight-bold">${dataInicio}</span>
            </td>
            <td class="align-middle" style="padding-right: 1.5rem;">
              <div class="d-flex justify-content-end align-items-center" style="gap: 5.5rem;">
                <a href="javascript:;" class="text-secondary font-weight-bold text-xs" 
                   onclick="PromoPingAdmin.viewIncidentById(${inc.Id})" 
                   data-toggle="tooltip" 
                   data-original-title="Ver detalhes"
                   style="cursor: pointer; text-decoration: none;">
                  <i class="fas fa-eye text-warning me-1"></i> Ver
                </a>
                <a href="javascript:;" class="text-secondary font-weight-bold text-xs" 
                   onclick="PromoPingAdmin.editIncidentById(${inc.Id})" 
                   data-toggle="tooltip" 
                   data-original-title="Editar incidente"
                   style="cursor: pointer; text-decoration: none;">
                  <i class="fas fa-edit text-danger me-1"></i> Edit
                </a>
              </div>
            </td>
        </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Erro ao carregar incidentes:', err);
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger text-sm py-4">Falha ao carregar</td></tr>`;
    }
  }

  // Criar novo incidente
  async function createNewIncident() {
    const existingModal = document.getElementById('incident-create-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'incident-create-modal';
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.setAttribute('tabindex', '-1');
    
    const now = new Date().toISOString().slice(0, 16);
    
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content shadow-lg">
          <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);">
            <h5 class="modal-title text-white">
              <i class="fas fa-plus me-2"></i>
              Criar Novo Incidente
            </h5>
            <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
          </div>
          <div class="modal-body p-4">
            <form id="incident-create-form">
              <div class="mb-3">
                <label class="form-label text-sm font-weight-bold">Título *</label>
                <input type="text" class="form-control form-control-sm" id="create-titulo" required>
              </div>
              <div class="mb-3">
                <label class="form-label text-sm font-weight-bold">Descrição *</label>
                <textarea class="form-control form-control-sm" id="create-descricao" rows="4" required></textarea>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label text-sm font-weight-bold">Status *</label>
                  <select class="form-select form-select-sm" id="create-estado" required>
                    <option value="Ativo">Ativo</option>
                    <option value="Resolvido" selected>Resolvido</option>
                    <option value="Planeado">Planeado</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-sm font-weight-bold">Impacto</label>
                  <input type="text" class="form-control form-control-sm" id="create-impacto">
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label text-sm font-weight-bold">Data de Início *</label>
                  <input type="datetime-local" class="form-control form-control-sm" id="create-data-inicio" value="${now}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-sm font-weight-bold">Data de Fim</label>
                  <input type="datetime-local" class="form-control form-control-sm" id="create-data-fim">
                </div>
              </div>
              <div id="create-feedback" class="text-xs mb-2"></div>
            </form>
          </div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button type="button" class="btn btn-primary" id="create-incident-btn">
              <i class="fas fa-save me-1"></i> Criar Incidente
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const saveBtn = modal.querySelector('#create-incident-btn');
    saveBtn.addEventListener('click', async () => {
      const form = modal.querySelector('#incident-create-form');
      const feedback = modal.querySelector('#create-feedback');
      
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Criando...';
      feedback.textContent = '';
      
      try {
        // Converter datetime-local para formato MySQL (YYYY-MM-DD HH:mm:ss)
        const dataInicioRaw = modal.querySelector('#create-data-inicio').value;
        const dataFimRaw = modal.querySelector('#create-data-fim').value;
        
        let dataInicio = null;
        if (dataInicioRaw) {
          dataInicio = dataInicioRaw.replace('T', ' ');
          // Garantir que tenha segundos (HH:mm:ss)
          if (dataInicio.split(':').length === 2) {
            dataInicio += ':00';
          }
        }
        
        let dataFim = null;
        if (dataFimRaw && dataFimRaw.trim() !== '') {
          dataFim = dataFimRaw.replace('T', ' ');
          // Garantir que tenha segundos (HH:mm:ss)
          if (dataFim.split(':').length === 2) {
            dataFim += ':00';
          }
        }
        
        const data = {
          titulo: modal.querySelector('#create-titulo').value.trim(),
          descricao: modal.querySelector('#create-descricao').value.trim(),
          estado: modal.querySelector('#create-estado').value,
          impacto: modal.querySelector('#create-impacto').value.trim() || null,
          dataInicio: dataInicio,
          dataFim: dataFim
        };
        
        await fetchJSON('/api/incidentes', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        
        feedback.textContent = 'Incidente criado com sucesso!';
        feedback.className = 'text-xs text-success mb-2';
        
        setTimeout(() => {
          modal.remove();
          initTables();
          
          try {
            localStorage.setItem('incidentes_updated', Date.now().toString());
            window.dispatchEvent(new CustomEvent('incidentes_updated'));
          } catch (e) {
            console.log('Não foi possível notificar atualização via storage:', e);
          }
        }, 1000);
      } catch (err) {
        console.error('Erro ao criar incidente:', err);
        feedback.textContent = 'Erro ao criar incidente. Tente novamente.';
        feedback.className = 'text-xs text-danger mb-2';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Criar Incidente';
      }
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Funções para Atualizações
  async function initAtualizacoes() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    const tbody = document.getElementById('atualizacoes-body');
    if (!tbody) return;
    try {
      const res = await fetchJSON('/api/atualizacoes');
      const list = (res && res.atualizacoes) || [];
      
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary text-sm py-4">Sem dados</td></tr>`;
        return;
      }
      
      tbody.innerHTML = list.map(upd => {
        const dataPublicacao = upd.DataPublicacao ? new Date(upd.DataPublicacao).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : '—';
        
        return `
          <tr>
            <td class="align-middle" style="padding-left: 1rem; text-align: left;">
              <p class="text-xs font-weight-bold mb-0">${upd.Id || '—'}</p>
            </td>
            <td class="align-middle ps-2">
              <p class="text-xs font-weight-bold mb-0">${(upd.Titulo || '—').substring(0, 50)}${upd.Titulo && upd.Titulo.length > 50 ? '...' : ''}</p>
            </td>
            <td class="align-middle text-center">
              <span class="badge badge-sm bg-gradient-info">${upd.Tipo || 'Melhoria'}</span>
            </td>
            <td class="align-middle text-center">
              <span class="text-secondary text-xs font-weight-bold">${dataPublicacao}</span>
            </td>
            <td class="align-middle" style="padding-right: 1.5rem;">
              <div class="d-flex justify-content-end align-items-center" style="gap: 5.5rem;">
                <a href="javascript:;" class="text-secondary font-weight-bold text-xs" 
                   onclick="PromoPingAdmin.viewUpdateById(${upd.Id})" 
                   data-toggle="tooltip" 
                   data-original-title="Ver detalhes"
                   style="cursor: pointer; text-decoration: none;">
                  <i class="fas fa-eye text-warning me-1"></i> Ver
                </a>
                <a href="javascript:;" class="text-secondary font-weight-bold text-xs" 
                   onclick="PromoPingAdmin.editUpdateById(${upd.Id})" 
                   data-toggle="tooltip" 
                   data-original-title="Editar atualização"
                   style="cursor: pointer; text-decoration: none;">
                  <i class="fas fa-edit text-danger me-1"></i> Edit
                </a>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Erro ao carregar atualizações:', err);
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger text-sm py-4">Falha ao carregar</td></tr>`;
    }
  }

  async function viewUpdateById(updateId) {
    try {
      const res = await fetchJSON(`/api/atualizacoes/${updateId}`);
      const update = res.atualizacao || res;
      if (!update) {
        alert('Atualização não encontrada.');
        return;
      }

      const existingModal = document.getElementById('update-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'update-modal';
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.setAttribute('tabindex', '-1');
      
      const dataPublicacao = update.DataPublicacao ? new Date(update.DataPublicacao).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }) : '—';
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content shadow-lg">
            <div class="modal-header border-0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h5 class="modal-title text-white">
                <i class="fas fa-info-circle me-2"></i>
                Atualização #${updateId}
              </h5>
              <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
            </div>
            <div class="modal-body p-4">
              <div class="mb-4">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Título</h6>
                <h5 class="mb-0">${(update.Titulo || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h5>
              </div>
              <div class="mb-4">
                <h6 class="text-uppercase text-xs text-secondary mb-2">Descrição</h6>
                <p class="mb-0 text-sm" style="white-space: pre-wrap;">${(update.Descricao || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              </div>
              <div class="row mb-3">
                <div class="col-md-4">
                  <h6 class="text-uppercase text-xs text-secondary mb-2">Tipo</h6>
                  <span class="badge badge-sm bg-gradient-info">${update.Tipo || 'Melhoria'}</span>
                </div>
                <div class="col-md-4">
                  <h6 class="text-uppercase text-xs text-secondary mb-2">Status</h6>
                  <span class="badge badge-sm bg-gradient-success">${update.Status || 'Implementado'}</span>
                </div>
                <div class="col-md-4">
                  <h6 class="text-uppercase text-xs text-secondary mb-2">Data de Publicação</h6>
                  <p class="mb-0 text-sm">${dataPublicacao}</p>
                </div>
              </div>
            </div>
            <div class="modal-footer border-0">
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Fechar</button>
              <button type="button" class="btn btn-primary" onclick="PromoPingAdmin.editUpdateById(${update.Id})">
                <i class="fas fa-edit me-1"></i> Editar
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (err) {
      console.error('Erro ao carregar atualização:', err);
      alert('Erro ao carregar detalhes da atualização.');
    }
  }

  async function editUpdateById(updateId) {
    const viewModal = document.getElementById('update-modal');
    if (viewModal) viewModal.remove();

    try {
      const res = await fetchJSON(`/api/atualizacoes/${updateId}`);
      const update = res.atualizacao || res;
      
      if (!update) {
        alert('Atualização não encontrada.');
        return;
      }

      const existingModal = document.getElementById('update-edit-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'update-edit-modal';
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.setAttribute('tabindex', '-1');
      
      const dataPublicacao = update.DataPublicacao ? new Date(update.DataPublicacao).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content shadow-lg">
            <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);">
              <h5 class="modal-title text-white">
                <i class="fas fa-edit me-2"></i>
                Editar Atualização #${updateId}
              </h5>
              <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
            </div>
            <div class="modal-body p-4">
              <form id="update-edit-form">
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Título</label>
                  <input type="text" class="form-control form-control-sm" id="edit-update-titulo" value="${(update.Titulo || '').replace(/"/g, '&quot;')}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Descrição</label>
                  <textarea class="form-control form-control-sm" id="edit-update-descricao" rows="4" required>${(update.Descricao || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="row mb-3">
                  <div class="col-md-4">
                    <label class="form-label text-sm font-weight-bold">Tipo</label>
                    <select class="form-select form-select-sm" id="edit-update-tipo" required>
                      <option value="Melhoria" ${update.Tipo === 'Melhoria' ? 'selected' : ''}>Melhoria</option>
                      <option value="Correção" ${update.Tipo === 'Correção' ? 'selected' : ''}>Correção</option>
                      <option value="Nova Funcionalidade" ${update.Tipo === 'Nova Funcionalidade' ? 'selected' : ''}>Nova Funcionalidade</option>
                      <option value="Manutenção" ${update.Tipo === 'Manutenção' ? 'selected' : ''}>Manutenção</option>
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label text-sm font-weight-bold">Status</label>
                    <select class="form-select form-select-sm" id="edit-update-status" required>
                      <option value="Implementado" ${update.Status === 'Implementado' ? 'selected' : ''}>Implementado</option>
                      <option value="Em Desenvolvimento" ${update.Status === 'Em Desenvolvimento' ? 'selected' : ''}>Em Desenvolvimento</option>
                      <option value="Planeado" ${update.Status === 'Planeado' ? 'selected' : ''}>Planeado</option>
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label text-sm font-weight-bold">Data de Publicação</label>
                    <input type="datetime-local" class="form-control form-control-sm" id="edit-update-data" value="${dataPublicacao}" required>
                  </div>
                </div>
                <div id="edit-update-feedback" class="text-xs mb-2"></div>
              </form>
            </div>
            <div class="modal-footer border-0">
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
              <button type="button" class="btn btn-primary" id="save-update-btn">
                <i class="fas fa-save me-1"></i> Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      const saveBtn = modal.querySelector('#save-update-btn');
      saveBtn.addEventListener('click', async () => {
        const form = modal.querySelector('#update-edit-form');
        const feedback = modal.querySelector('#edit-update-feedback');
        
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Guardando...';
        feedback.textContent = '';
        
        try {
          const data = {
            Titulo: modal.querySelector('#edit-update-titulo').value.trim(),
            Descricao: modal.querySelector('#edit-update-descricao').value.trim(),
            Tipo: modal.querySelector('#edit-update-tipo').value,
            Status: modal.querySelector('#edit-update-status').value,
            DataPublicacao: modal.querySelector('#edit-update-data').value
          };
          
          await fetchJSON(`/api/atualizacoes/${updateId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
          
          feedback.textContent = 'Atualização salva com sucesso!';
          feedback.className = 'text-xs text-success mb-2';
          
          setTimeout(() => {
            modal.remove();
            initAtualizacoes();
            
            try {
              localStorage.setItem('atualizacoes_updated', Date.now().toString());
              window.dispatchEvent(new CustomEvent('atualizacoes_updated'));
            } catch (e) {
              console.log('Não foi possível notificar atualização via storage:', e);
            }
          }, 1000);
        } catch (err) {
          console.error('Erro ao salvar:', err);
          feedback.textContent = 'Erro ao salvar atualização. Tente novamente.';
          feedback.className = 'text-xs text-danger mb-2';
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Alterações';
        }
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (err) {
      console.error('Erro ao carregar atualização:', err);
      alert('Erro ao carregar dados da atualização.');
    }
  }

  async function createNewUpdate() {
    const existingModal = document.getElementById('update-create-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'update-create-modal';
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.setAttribute('tabindex', '-1');
    
    const now = new Date().toISOString().slice(0, 16);
    
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content shadow-lg">
          <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);">
            <h5 class="modal-title text-white">
              <i class="fas fa-plus me-2"></i>
              Criar Nova Atualização
            </h5>
            <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
          </div>
          <div class="modal-body p-4">
            <form id="update-create-form">
              <div class="mb-3">
                <label class="form-label text-sm font-weight-bold">Título *</label>
                <input type="text" class="form-control form-control-sm" id="create-update-titulo" required>
              </div>
              <div class="mb-3">
                <label class="form-label text-sm font-weight-bold">Descrição *</label>
                <textarea class="form-control form-control-sm" id="create-update-descricao" rows="4" required></textarea>
              </div>
              <div class="row mb-3">
                <div class="col-md-4">
                  <label class="form-label text-sm font-weight-bold">Tipo *</label>
                  <select class="form-select form-select-sm" id="create-update-tipo" required>
                    <option value="Melhoria" selected>Melhoria</option>
                    <option value="Correção">Correção</option>
                    <option value="Nova Funcionalidade">Nova Funcionalidade</option>
                    <option value="Manutenção">Manutenção</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label text-sm font-weight-bold">Status *</label>
                  <select class="form-select form-select-sm" id="create-update-status" required>
                    <option value="Implementado" selected>Implementado</option>
                    <option value="Em Desenvolvimento">Em Desenvolvimento</option>
                    <option value="Planeado">Planeado</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label text-sm font-weight-bold">Data de Publicação *</label>
                  <input type="datetime-local" class="form-control form-control-sm" id="create-update-data" value="${now}" required>
                </div>
              </div>
              <div id="create-update-feedback" class="text-xs mb-2"></div>
            </form>
          </div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button type="button" class="btn btn-primary" id="create-update-btn">
              <i class="fas fa-save me-1"></i> Criar Atualização
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const saveBtn = modal.querySelector('#create-update-btn');
    saveBtn.addEventListener('click', async () => {
      const form = modal.querySelector('#update-create-form');
      const feedback = modal.querySelector('#create-update-feedback');
      
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Criando...';
      feedback.textContent = '';
      
      try {
        const data = {
          Titulo: modal.querySelector('#create-update-titulo').value.trim(),
          Descricao: modal.querySelector('#create-update-descricao').value.trim(),
          Tipo: modal.querySelector('#create-update-tipo').value,
          Status: modal.querySelector('#create-update-status').value,
          DataPublicacao: modal.querySelector('#create-update-data').value
        };
        
        await fetchJSON('/api/atualizacoes', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        
        feedback.textContent = 'Atualização criada com sucesso!';
        feedback.className = 'text-xs text-success mb-2';
        
        setTimeout(() => {
          modal.remove();
          initAtualizacoes();
          
          try {
            localStorage.setItem('atualizacoes_updated', Date.now().toString());
            window.dispatchEvent(new CustomEvent('atualizacoes_updated'));
          } catch (e) {
            console.log('Não foi possível notificar atualização via storage:', e);
          }
        }, 1000);
      } catch (err) {
        console.error('Erro ao criar atualização:', err);
        feedback.textContent = 'Erro ao criar atualização. Tente novamente.';
        feedback.className = 'text-xs text-danger mb-2';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Criar Atualização';
      }
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  async function initProfile() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    if (!requireAuth()) return;
    try {
      const res = await fetchJSON('/api/user/me');
      const user = res?.user || {};
      
      // Carregar dados nos campos editáveis
      const fullNameEl = document.getElementById('fullName');
      const emailEl = document.getElementById('email');
      const mobileEl = document.getElementById('mobile');
      const locationEl = document.getElementById('location');
      const descriptionEl = document.getElementById('profileDescription');
      
      if (fullNameEl) fullNameEl.value = user.nome || user.name || '';
      if (emailEl) emailEl.value = user.email || '';
      if (mobileEl) mobileEl.value = user.telefone || user.phone || '';
      
      // Atualizar nome no header do perfil
      const headerNameEl = document.getElementById('profileHeaderName');
      if (headerNameEl) {
        headerNameEl.textContent = user.nome || user.name || 'Administrador';
      }
      
      // Atualizar foto de perfil no header se disponível
      const profileAvatar = document.querySelector('.avatar img');
      if (profileAvatar && user.fotoPerfil) {
        profileAvatar.src = user.fotoPerfil;
        profileAvatar.alt = user.nome || 'Foto de perfil';
      }
      
      // Carregar descrição e localização do localStorage (não há campos na base de dados)
      if (descriptionEl) {
        const savedDescription = localStorage.getItem('PROMOPING_PROFILE_DESCRIPTION');
        if (savedDescription) descriptionEl.value = savedDescription;
      }
      
      if (locationEl) {
        // Primeiro tentar carregar da base de dados, depois do localStorage
        const savedLocation = user.cidade || user.location || localStorage.getItem('PROMOPING_PROFILE_LOCATION') || '';
        if (savedLocation) locationEl.value = savedLocation;
      }
      
      // Adicionar event listener ao botão de salvar
      const saveBtn = document.getElementById('saveProfileBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
      }
    } catch {
      localStorage.removeItem('PROMOPING_TOKEN');
      requireAuth();
    }
  }

  async function saveProfile() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    if (!requireAuth()) return;
    
    const fullNameEl = document.getElementById('fullName');
    const emailEl = document.getElementById('email');
    const mobileEl = document.getElementById('mobile');
    const locationEl = document.getElementById('location');
    const descriptionEl = document.getElementById('profileDescription');
    const feedbackEl = document.getElementById('profileFeedback');
    const saveBtn = document.getElementById('saveProfileBtn');
    
    if (!fullNameEl || !emailEl || !mobileEl || !saveBtn) return;
    
    // Desabilitar botão durante o salvamento
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> A guardar...';
    if (feedbackEl) feedbackEl.textContent = '';
    
    try {
      const nome = fullNameEl.value.trim();
      const email = emailEl.value.trim();
      const telefone = mobileEl.value.trim();
      
      // Validar campos obrigatórios
      if (!nome) {
        if (feedbackEl) {
          feedbackEl.textContent = 'Nome é obrigatório';
          feedbackEl.className = 'ms-2 text-xs text-danger';
        }
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Alterações';
        return;
      }
      
      if (!email) {
        if (feedbackEl) {
          feedbackEl.textContent = 'Email é obrigatório';
          feedbackEl.className = 'ms-2 text-xs text-danger';
        }
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Alterações';
        return;
      }
      
      // Salvar dados na base de dados via API
      await fetchJSON('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ nome, email, telefone })
      });
      
      // Atualizar nome no header do perfil
      const headerNameEl = document.getElementById('profileHeaderName');
      if (headerNameEl) {
        headerNameEl.textContent = nome;
      }
      
      // Salvar descrição e localização no localStorage (não há campos na base de dados)
      if (descriptionEl) {
        localStorage.setItem('PROMOPING_PROFILE_DESCRIPTION', descriptionEl.value.trim());
      }
      if (locationEl) {
        localStorage.setItem('PROMOPING_PROFILE_LOCATION', locationEl.value.trim());
      }
      
      // Feedback de sucesso
      if (feedbackEl) {
        feedbackEl.textContent = 'Perfil atualizado com sucesso!';
        feedbackEl.className = 'ms-2 text-xs text-success';
        setTimeout(() => {
          feedbackEl.textContent = '';
        }, 3000);
      }
      
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      if (feedbackEl) {
        feedbackEl.textContent = 'Erro ao salvar perfil. Tente novamente.';
        feedbackEl.className = 'ms-2 text-xs text-danger';
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Alterações';
    }
  }

  // Editar admin/autor
  async function editAuthorById(authorId) {
    try {
      // Buscar dados do autor da lista de admins
      const res = await fetchJSON('/api/user/admins');
      const admins = res.admins || [];
      const author = admins.find(a => a.Id === parseInt(authorId));
      
      if (!author) {
        alert('Autor não encontrado.');
        return;
      }

      const existingModal = document.getElementById('author-edit-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'author-edit-modal';
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.setAttribute('tabindex', '-1');
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content shadow-lg">
            <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);">
              <h5 class="modal-title text-white">
                <i class="fas fa-user-edit me-2"></i>
                Editar Autor #${authorId}
              </h5>
              <button type="button" class="btn-close btn-close-white" onclick="this.closest('.modal').remove()"></button>
            </div>
            <div class="modal-body p-4">
              <form id="author-edit-form">
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Nome</label>
                  <input type="text" class="form-control form-control-sm" id="edit-author-nome" value="${(author.Nome || '').replace(/"/g, '&quot;')}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Email</label>
                  <input type="email" class="form-control form-control-sm" id="edit-author-email" value="${(author.Email || '').replace(/"/g, '&quot;')}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm font-weight-bold">Perfil</label>
                  <select class="form-select form-select-sm" id="edit-author-perfil" disabled>
                    <option value="${author.Perfil || 'Admin'}" selected>${author.Perfil || 'Admin'}</option>
                  </select>
                  <small class="text-muted">O perfil não pode ser alterado aqui.</small>
                </div>
                <div id="edit-author-feedback" class="text-xs mb-2"></div>
              </form>
            </div>
            <div class="modal-footer border-0">
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
              <button type="button" class="btn btn-primary" id="save-author-btn">
                <i class="fas fa-save me-1"></i> Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      const saveBtn = modal.querySelector('#save-author-btn');
      saveBtn.addEventListener('click', async () => {
        const form = modal.querySelector('#author-edit-form');
        const feedback = modal.querySelector('#edit-author-feedback');
        
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Guardando...';
        feedback.textContent = '';
        
        try {
          const data = {
            nome: modal.querySelector('#edit-author-nome').value.trim(),
            email: modal.querySelector('#edit-author-email').value.trim(),
            telefone: null // Não editamos telefone no modal de autor
          };
          
          // Usar rota específica para atualizar usuário por ID (admin)
          await fetchJSON(`/api/user/admin/${authorId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
          
          feedback.textContent = 'Autor atualizado com sucesso!';
          feedback.className = 'text-xs text-success mb-2';
          
          setTimeout(() => {
            modal.remove();
            initAuthors(); // Recarregar tabela
          }, 1000);
        } catch (err) {
          console.error('Erro ao salvar:', err);
          feedback.textContent = 'Erro ao salvar autor. Tente novamente.';
          feedback.className = 'text-xs text-danger mb-2';
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Alterações';
        }
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (err) {
      console.error('Erro ao carregar autor:', err);
      alert('Erro ao carregar dados do autor.');
    }
  }

  // Função auxiliar para gerar avatar com inicial se não tiver foto
  function getAuthorAvatar(admin) {
    // Prioridade 1: Foto de perfil salva
    if (admin.FotoPerfil) {
      return admin.FotoPerfil;
    }
    // Prioridade 2: Foto do Discord se tiver discord_id
    if (admin.discord_id) {
      return `https://cdn.discordapp.com/avatars/${admin.discord_id}/avatar.png`;
    }
    // Prioridade 3: Gerar avatar com inicial do nome
    const nome = admin.Nome || admin.Email || 'U';
    const inicial = nome.charAt(0).toUpperCase();
    // Cores variadas para os avatares
    const colors = [
      '#f17603', '#667eea', '#f093fb', '#4facfe', '#43e97b',
      '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fed6e3'
    ];
    const colorIndex = nome.charCodeAt(0) % colors.length;
    const bgColor = colors[colorIndex];
    // Criar SVG inline de forma segura usando encodeURIComponent para todo o SVG
    const svgContent = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="${bgColor}"/><text x="50%" y="50%" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${inicial}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  }

  async function initAuthors() {
    const tbody = document.getElementById('authors-body');
    if (!tbody) return;
    try {
      const res = await fetchJSON('/api/user/admins');
      const list = (res && res.admins) || [];
      tbody.innerHTML = list.map(a => {
        const avatarUrl = getAuthorAvatar(a);
        // Gerar fallback diretamente aqui para evitar problemas de escopo
        const nome = a.Nome || a.Email || 'U';
        const inicial = nome.charAt(0).toUpperCase();
        const colors = ['#f17603', '#667eea', '#f093fb', '#4facfe', '#43e97b'];
        const colorIndex = nome.charCodeAt(0) % colors.length;
        const bgColor = colors[colorIndex];
        const fallbackSvg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="${bgColor}"/><text x="50%" y="50%" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${inicial}</text></svg>`;
        const fallbackAvatar = `data:image/svg+xml,${encodeURIComponent(fallbackSvg)}`;
        
        return `
        <tr>
          <td>
            <div class="d-flex px-2 py-1">
              <div>
                <img src="${avatarUrl}" 
                     class="avatar avatar-sm me-3 rounded-circle" 
                     alt="${a.Nome || 'admin'}"
                     style="object-fit: cover; width: 32px; height: 32px; border: 2px solid #e9ecef;"
                     onerror="this.onerror=null; this.src='${fallbackAvatar}';">
              </div>
              <div class="d-flex flex-column justify-content-center">
                <h6 class="mb-0 text-sm">${a.Nome || '—'}</h6>
                <p class="text-xs text-secondary mb-0">${a.Email || '—'}</p>
              </div>
            </div>
          </td>
          <td>
            <p class="text-xs font-weight-bold mb-0">${a.Perfil || 'Admin'}</p>
            <p class="text-xs text-secondary mb-0">Organization</p>
          </td>
          <td class="align-middle text-center text-sm">
            <span class="badge badge-sm bg-gradient-success">ONLINE</span>
          </td>
          <td class="align-middle text-center">
            <span class="text-secondary text-xs font-weight-bold">${a.DataRegisto ? new Date(a.DataRegisto).toLocaleDateString('pt-BR') : '—'}</span>
          </td>
          <td class="align-middle">
            <a href="javascript:;" class="text-secondary font-weight-bold text-xs" 
               onclick="PromoPingAdmin.editAuthorById(${a.Id})" 
               data-toggle="tooltip" data-original-title="Editar autor">
              Edit
            </a>
          </td>
        </tr>
      `;
      }).join('') || `<tr><td colspan="5" class="text-center text-secondary text-sm">Sem admins</td></tr>`;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger text-sm">Falha ao carregar</td></tr>`;
    }
  }

  async function initGithubProjects(options = {}) {
    const container = document.getElementById('github-projects');
    if (!container) return;
    const username = options.user || localStorage.getItem('PROMOPING_GH_USER');
    const org = options.org || localStorage.getItem('PROMOPING_GH_ORG');
    const max = Number(options.max || 6);
    try {
      let repos = [];
      if (Array.isArray(options.repos) && options.repos.length > 0) {
        // Buscar exatamente os repositórios fornecidos; se privado/404, criar card básico
        const fetched = await Promise.all(options.repos.map(async (fullName) => {
          try {
            const resp = await fetch(`https://api.github.com/repos/${fullName}`, { headers: { 'Accept': 'application/vnd.github+json' } });
            if (!resp.ok) {
              const name = fullName.split('/').pop();
              return {
                name,
                html_url: `https://github.com/${fullName}`,
                description: 'Repositório privado',
                language: 'Privado',
                stargazers_count: 0,
                forks_count: 0
              };
            }
            return await resp.json();
          } catch (_) {
            const name = fullName.split('/').pop();
            return {
              name,
              html_url: `https://github.com/${fullName}`,
              description: 'Repositório privado',
              language: 'Privado',
              stargazers_count: 0,
              forks_count: 0
            };
          }
        }));
        repos = fetched;
      } else {
        let url = null;
        if (org) url = `https://api.github.com/orgs/${org}/repos?sort=updated`;
        else if (username) url = `https://api.github.com/users/${username}/repos?sort=updated`;
        else {
          container.innerHTML = '<div class="text-secondary">Configure o GitHub em localStorage: PROMOPING_GH_USER ou PROMOPING_GH_ORG</div>';
          return;
        }
        const resp = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
        const list = await resp.json();
        if (!Array.isArray(list)) throw new Error('Resposta inválida do GitHub');
        repos = list.slice(0, max);
      }

      const items = repos.slice(0, max).map(r => `
        <div class="col-xl-4 col-md-6 mb-xl-0 mb-3 d-flex">
          <div class="card p-3 h-100 d-flex flex-column w-100">
            <p class="text-secondary mb-1 text-xs">${r.language || 'Repo'}</p>
            <a href="${r.html_url}" target="_blank" rel="noopener"><h6 class="font-weight-bolder mb-2">${r.name}</h6></a>
            <p class="mb-3 text-sm flex-grow-1">${(r.description || 'Repositório privado').substring(0,140)}</p>
            <div class="d-flex align-items-center justify-content-between mt-auto">
              <a href="${r.html_url}" target="_blank" class="btn btn-outline-primary btn-sm mb-0">Ver Projeto</a>
              <span class="text-xs text-secondary">★ ${r.stargazers_count || 0} • ⑂ ${r.forks_count || 0}</span>
            </div>
          </div>
        </div>
      `).join('');
      container.innerHTML = `<div class="row">${items}</div>`;
    } catch (e) {
      container.innerHTML = '<div class="text-danger">Falha ao carregar repositórios do GitHub</div>';
    }
  }

  // Armazenar último estado de mensagens para detectar novas
  let lastMessagesState = null;

  // Função para tocar som de notificação
  function playNotificationSound() {
    try {
      // Criar contexto de áudio programaticamente (mais compatível)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Som de notificação agradável (dois tons)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.warn('Não foi possível tocar som de notificação:', e);
    }
  }

  // Verificar se notificação sonora está ativada
  function isSoundNotificationEnabled() {
    const soundSwitch = document.getElementById('soundNotificationSwitch');
    if (soundSwitch) {
      return soundSwitch.checked;
    }
    // Fallback: usar localStorage se o switch não estiver no DOM
    const saved = localStorage.getItem('promoping_sound_notification');
    return saved !== 'false'; // Por padrão, ativado
  }

  // Salvar preferência de notificação sonora
  function saveSoundNotificationPreference(enabled) {
    localStorage.setItem('promoping_sound_notification', enabled ? 'true' : 'false');
    const soundSwitch = document.getElementById('soundNotificationSwitch');
    if (soundSwitch) {
      soundSwitch.checked = enabled;
    }
  }

  // Carregar preferência de notificação sonora
  function loadSoundNotificationPreference() {
    const saved = localStorage.getItem('promoping_sound_notification');
    const soundSwitch = document.getElementById('soundNotificationSwitch');
    if (soundSwitch) {
      soundSwitch.checked = saved !== 'false'; // Por padrão, ativado
    }
  }

  async function initConversations() {
    const listEl = document.getElementById('conversations-list');
    if (!listEl) return;
    if (!requireAuth()) return;
    try {
      const res = await fetchJSON('/api/support/messages?limit=10');
      const currentMessages = await Promise.all((res.items || []).map(async (m) => {
        // Carregar thread para verificar se há mensagens não lidas
        const threadMessages = await loadConversationAdmin(m.id);
        // Contar quantas mensagens do usuário existem (respostas que o suporte precisa ver)
        const userMessages = threadMessages.filter(msg => msg.senderType === 'user');
        // Verificar se a última mensagem é do usuário (não respondida pelo suporte)
        const lastMsg = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;
        const hasUnread = lastMsg && lastMsg.senderType === 'user';
        // Contar mensagens do usuário que vieram depois da última resposta do suporte
        const lastSupportMsgIndex = threadMessages.map((msg, idx) => 
          msg.senderType === 'support' ? idx : -1
        ).filter(idx => idx !== -1).pop();
        const unreadCount = lastSupportMsgIndex !== undefined 
          ? threadMessages.slice(lastSupportMsgIndex + 1).filter(msg => msg.senderType === 'user').length
          : userMessages.length;
        const badgeText = unreadCount > 9 ? '9+' : (unreadCount > 0 ? unreadCount.toString() : '');
        
        const messageText = m.message.length > 40 ? m.message.substring(0, 40) + '...' : m.message;
        const displayText = lastMsg && lastMsg.id !== m.id ? 
          (lastMsg.message.length > 40 ? lastMsg.message.substring(0, 40) + '...' : lastMsg.message) : 
          messageText;
        
        return {
          id: m.id,
          hasUnread,
          unreadCount,
          lastMsg,
          displayText,
          createdAt: m.createdAt
        };
      }));

      // Detectar novas mensagens de usuário e tocar som se necessário
      if (lastMessagesState !== null) {
        const newUserMessages = currentMessages.filter(curr => {
          const prev = lastMessagesState.find(p => p.id === curr.id);
          // Se não havia mensagens não lidas antes e agora há, ou se o número aumentou
          if (!prev) return curr.hasUnread;
          return !prev.hasUnread && curr.hasUnread || (curr.unreadCount > prev.unreadCount);
        });

        if (newUserMessages.length > 0 && isSoundNotificationEnabled()) {
          playNotificationSound();
        }
      }
      
      lastMessagesState = currentMessages;

      const items = currentMessages.map(m => `
        <li class="list-group-item border-0 d-flex align-items-center px-0 mb-2 conversation-item" 
            style="cursor: pointer; transition: background 0.2s; border-radius: 8px; padding: 8px !important;" 
            data-thread-id="${m.id}"
            onmouseover="this.style.background='#f8f9fa'" 
            onmouseout="this.style.background='transparent'">
          <div class="avatar me-3 position-relative">
            <img src="https://github.com/juliareboucasleite.png" alt="avatar" class="border-radius-lg shadow" style="width: 40px; height: 40px;">
            ${m.hasUnread ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.65rem; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: 600; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${m.unreadCount > 9 ? '9+' : (m.unreadCount > 0 ? m.unreadCount.toString() : '')}</span>` : ''}
          </div>
          <div class="d-flex align-items-start flex-column justify-content-center flex-grow-1">
            <h6 class="mb-0 text-sm" style="font-weight: ${m.hasUnread ? '600' : '400'}; color: ${m.hasUnread ? '#e91e63' : '#344767'};">
              Thread #${m.id} ${m.hasUnread ? '• Novo' : ''}
            </h6>
            <p class="mb-0 text-xs text-secondary" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.displayText}</p>
          </div>
          <span class="text-xs text-secondary ms-2" style="white-space: nowrap;">${new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </li>
      `);
      
      listEl.innerHTML = items.join('') || '<li class="list-group-item border-0 px-0 text-secondary">Sem mensagens de suporte.</li>';
      
      // Adicionar event listeners para abrir chat ao clicar
      listEl.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
          const threadId = item.getAttribute('data-thread-id');
          openChatModal(threadId);
          // Atualizar lista após abrir para remover notificação
          setTimeout(() => initConversations(), 500);
        });
      });
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
      if (listEl) {
      listEl.innerHTML = '<li class="list-group-item border-0 px-0 text-danger">Falha ao carregar conversas.</li>';
      }
    }
  }

  async function loadConversationAdmin(threadId) {
    try {
      const res = await fetchJSON(`/api/support/messages?threadId=${threadId}`);
      return res.items || [];
    } catch (e) {
      console.error('Erro ao carregar conversa:', e);
      return [];
    }
  }

  function renderMessageAdmin(msg) {
    const isUser = msg.senderType === 'user';
    const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    // Cores e estilos diferentes para usuário vs suporte
    const userBg = '#f8f9fa';
    const userColor = '#344767';
    const userBorder = '#e9ecef';
    const supportBg = 'linear-gradient(135deg, #f17603 0%, #ff9800 100%)';
    const supportColor = '#ffffff';
    
    return `
      <div class="message-item d-flex justify-content-${isUser ? 'start' : 'end'} mb-4 align-items-end" style="gap: 10px;">
        ${isUser ? `
          <div class="rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
               style="width: 36px; height: 36px; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); flex-shrink: 0;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="4" fill="white"/>
              <path d="M6 20C6 16 9 13 12 13C15 13 18 16 18 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="white"/>
            </svg>
          </div>
        ` : ''}
        <div style="max-width: 70%; display: flex; flex-direction: column; align-items: ${isUser ? 'flex-start' : 'flex-end'};">
          <div class="d-flex align-items-center mb-1" style="gap: 8px; justify-content: ${isUser ? 'flex-start' : 'flex-end'};">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase;">
              ${isUser ? 'Usuário' : 'Suporte'}
            </span>
            <span style="font-size: 10px; color: #adb5bd;">${date} às ${time}</span>
          </div>
          <div class="rounded-3 p-3 shadow-sm" 
               style="
                 background: ${isUser ? userBg : supportBg};
                 color: ${isUser ? userColor : supportColor};
                 border: 1px solid ${isUser ? userBorder : 'transparent'};
                 word-wrap: break-word;
                 position: relative;
                 ${isUser ? 'border-top-left-radius: 4px;' : 'border-top-right-radius: 4px;'}
               ">
            <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${msg.message}</div>
          </div>
        </div>
        ${!isUser ? `
          <img src="https://github.com/juliareboucasleite.png" alt="suporte" 
               class="rounded-circle shadow-sm" 
               style="width: 36px; height: 36px; object-fit: cover; flex-shrink: 0; border: 2px solid white;">
        ` : ''}
      </div>
    `;
  }

  async function refreshMessagesAdmin(threadId, container) {
    if (!threadId) return;
    const messages = await loadConversationAdmin(threadId);
    container.innerHTML = messages.map(renderMessageAdmin).join('');
    
    // Adicionar animação suave ao carregar mensagens
    const messageElements = container.querySelectorAll('.message-item');
    messageElements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, index * 50);
    });
    
    // Scroll suave para o final
    setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }

  function openChatModal(threadId) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('chat-modal-support');
    if (existingModal) existingModal.remove();

    // Criar modal de chat
    const modal = document.createElement('div');
    modal.id = 'chat-modal-support';
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width: 700px; width: 90vw;">
        <div class="modal-content shadow-lg" style="height: 85vh; max-height: 800px; display: flex; flex-direction: column; border: none; border-radius: 16px; overflow: hidden;">
          <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); padding: 20px 24px;">
            <div class="d-flex align-items-center" style="gap: 12px;">
              <div class="rounded-circle d-flex align-items-center justify-content-center" 
                   style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" fill="white"/>
                  <path d="M6 20C6 16 9 13 12 13C15 13 18 16 18 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="white"/>
                </svg>
              </div>
              <div class="flex-grow-1">
                <h5 class="modal-title mb-0 text-white" style="font-weight: 600; font-size: 16px;">Chat de Suporte</h5>
                <small class="text-white-50" style="font-size: 12px;">Thread #${threadId}</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="chat-modal-close" style="opacity: 0.8;"></button>
          </div>
          <div class="modal-body p-0" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);">
            <div id="chat-messages-container" class="p-4" style="flex: 1; overflow-y: auto; background: transparent; scroll-behavior: smooth;">
              <style>
                #chat-messages-container::-webkit-scrollbar {
                  width: 8px;
                }
                #chat-messages-container::-webkit-scrollbar-track {
                  background: #f1f1f1;
                  border-radius: 10px;
                }
                #chat-messages-container::-webkit-scrollbar-thumb {
                  background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);
                  border-radius: 10px;
                }
                #chat-messages-container::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(135deg, #e06a00 0%, #e68900 100%);
                }
              </style>
              <div class="text-center text-muted py-4">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Carregando mensagens...
              </div>
            </div>
            <div class="border-top p-3 bg-white" style="box-shadow: 0 -2px 10px rgba(0,0,0,0.05);">
              <div class="d-flex align-items-end" style="gap: 12px;">
                <div class="flex-grow-1">
                  <textarea id="chat-message-input" 
                            class="form-control border-0 shadow-sm" 
                            rows="2" 
                            placeholder="Digite sua resposta..." 
                            style="resize: none; border-radius: 12px; padding: 12px; font-size: 14px; background: #f8f9fa; transition: all 0.2s;"
                            onfocus="this.style.background='#fff'; this.style.boxShadow='0 0 0 2px rgba(241, 118, 3, 0.25)';"
                            onblur="this.style.background='#f8f9fa'; this.style.boxShadow='none';"></textarea>
                </div>
                <button class="btn btn-primary d-flex align-items-center justify-content-center shadow-sm" 
                        id="chat-send-btn" 
                        type="button"
                        style="border-radius: 12px; width: 48px; height: 48px; padding: 0; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); border: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(241, 118, 3, 0.4)';"
                        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(241, 118, 3, 0.3)';">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));">
                    <path d="M22 2L11 13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="white" fill-opacity="0.9"/>
                  </svg>
                </button>
              </div>
              <div id="chat-feedback" class="text-xs mt-2 text-center" style="min-height: 18px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const messagesContainer = modal.querySelector('#chat-messages-container');
    const textEl = modal.querySelector('#chat-message-input');
    const sendBtn = modal.querySelector('#chat-send-btn');
    const feedback = modal.querySelector('#chat-feedback');
    const closeBtn = modal.querySelector('#chat-modal-close');

    // Carregar mensagens
    refreshMessagesAdmin(threadId, messagesContainer);

    // Fechar modal
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Enviar mensagem
    const sendMessage = async () => {
      const text = (textEl.value || '').trim();
      if (!text) return;

      try {
        feedback.textContent = 'Enviando...';
        feedback.className = 'text-xs mt-2 text-center text-secondary';

        const threadMessages = await loadConversationAdmin(threadId);
        const lastMsg = threadMessages.length > 0 
          ? threadMessages[threadMessages.length - 1] 
          : { id: threadId };

        await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
          method: 'POST',
          body: JSON.stringify({ message: text, senderType: 'support' })
        });

        textEl.value = '';
        feedback.textContent = 'Enviado com sucesso!';
        feedback.className = 'text-xs mt-2 text-center text-success';
        setTimeout(() => { feedback.textContent = ''; }, 2000);

        await refreshMessagesAdmin(threadId, messagesContainer);
        initConversations(); // Atualizar lista de conversas
      } catch (e) {
        console.error('Erro ao enviar:', e);
        feedback.textContent = 'Falha ao enviar.';
        feedback.className = 'text-xs mt-2 text-center text-danger';
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Focar no input
    setTimeout(() => textEl.focus(), 100);
  }

  async function loadThreadsAdmin(selectEl) {
    try {
      const res = await fetchJSON('/api/support/messages?limit=20');
      selectEl.innerHTML = '<option value="">Nova conversa...</option>';
      (res.items || []).forEach(thread => {
        const text = thread.message.length > 50 ? thread.message.substring(0, 50) + '...' : thread.message;
        const replyCount = thread.replyCount || 0;
        selectEl.innerHTML += `<option value="${thread.id}">#${thread.id} - ${text} ${replyCount > 0 ? `(${replyCount} respostas)` : ''}</option>`;
      });
    } catch (e) {
      console.error('Erro ao carregar threads:', e);
    }
  }

  function initSupportWidget() {
    // Botão flutuante
    if (document.getElementById('pp-support-btn')) return; // evita duplicar
    const btn = document.createElement('button');
    btn.id = 'pp-support-btn';
    btn.className = 'btn btn-primary position-fixed';
    btn.style.right = '24px';
    btn.style.bottom = '24px';
    btn.style.zIndex = '1080';
    btn.innerText = 'Suporte';
    document.body.appendChild(btn);

    let currentThreadId = null;

    // Modal maior com histórico
    const modal = document.createElement('div');
    modal.id = 'pp-support-modal';
    modal.className = 'card shadow position-fixed';
    modal.style.right = '24px';
    modal.style.bottom = '80px';
    modal.style.width = '600px';
    modal.style.height = '650px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'none';
    modal.style.zIndex = '1080';
    modal.style.flexDirection = 'column';
    modal.innerHTML = `
      <div class="card-header py-2 px-3 d-flex justify-content-between align-items-center">
        <strong>Contato de Suporte</strong>
        <button type="button" class="btn btn-sm btn-link text-secondary" id="pp-support-close">✕</button>
      </div>
      <div class="card-body p-3" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
        <div class="mb-2">
          <label class="form-label small mb-1">Selecionar Conversa:</label>
          <select id="pp-support-thread-select" class="form-select form-select-sm">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div id="pp-support-messages" class="border rounded p-3 mb-2" style="flex: 1; overflow-y: auto; background: #fafafa; min-height: 300px;">
          <div class="text-center text-muted py-4">Selecione uma conversa ou crie uma nova</div>
        </div>
        <div>
          <textarea id="pp-support-text" class="form-control" rows="2" placeholder="Digite sua resposta..." style="resize: none;"></textarea>
          <button id="pp-support-send" class="btn btn-primary btn-sm mt-2 w-100">Enviar Resposta</button>
          <div id="pp-support-feedback" class="text-xs mt-2 text-center"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const messagesContainer = modal.querySelector('#pp-support-messages');
    const textEl = modal.querySelector('#pp-support-text');
    const fb = modal.querySelector('#pp-support-feedback');
    const threadSelect = modal.querySelector('#pp-support-thread-select');

    async function loadThreadData(threadId) {
      if (!threadId) {
        messagesContainer.innerHTML = '<div class="text-center text-muted py-4">Selecione uma conversa ou crie uma nova</div>';
        currentThreadId = null;
        return;
      }
      currentThreadId = threadId;
      messagesContainer.innerHTML = '<div class="text-center text-muted py-2">Carregando...</div>';
      await refreshMessagesAdmin(threadId, messagesContainer);
    }

    btn.addEventListener('click', async () => {
      if (!requireAuth()) return;
      const isOpen = modal.style.display !== 'none';
      modal.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        await loadThreadsAdmin(threadSelect);
      }
    });

    modal.querySelector('#pp-support-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    threadSelect.addEventListener('change', async (e) => {
      const threadId = e.target.value;
      await loadThreadData(threadId);
    });

    modal.querySelector('#pp-support-send').addEventListener('click', async () => {
      if (!requireAuth()) return;
      const text = (textEl.value || '').trim();
      if (!text) { 
        fb.textContent = 'Escreva uma mensagem.'; 
        fb.className = 'text-xs text-warning mt-2'; 
        return; 
      }

      try {
        fb.textContent = 'Enviando...'; 
        fb.className = 'text-xs text-secondary mt-2';
        
        let result;
        if (currentThreadId) {
          // Carrega a thread completa para pegar a última mensagem
          const threadMessages = await loadConversationAdmin(currentThreadId);
          // Pega a última mensagem da thread ou usa o threadId como fallback
          const lastMsg = threadMessages.length > 0 
            ? threadMessages[threadMessages.length - 1] 
            : { id: currentThreadId };
          result = await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message: text, senderType: 'support' })
          });
        } else {
          // Nova mensagem do suporte (mas normalmente será do usuário)
          result = await fetchJSON('/api/support/messages', { 
            method: 'POST', 
            body: JSON.stringify({ message: text }) 
          });
          currentThreadId = result.threadId || result.id;
          threadSelect.value = currentThreadId;
        }

        textEl.value = '';
        fb.textContent = 'Enviado com sucesso!'; 
        fb.className = 'text-xs text-success mt-2';
        setTimeout(() => { fb.textContent = ''; }, 2000);

        await refreshMessagesAdmin(currentThreadId, messagesContainer);
        // Atualiza lista se estiver no perfil
        if (typeof initConversations === 'function') initConversations();
      } catch (e) {
        console.error('Erro ao enviar:', e);
        fb.textContent = 'Falha ao enviar.'; 
        fb.className = 'text-xs text-danger mt-2';
      }
    });

    // Permitir enviar com Enter
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        modal.querySelector('#pp-support-send').click();
      }
    });
  }

  // Inicializar notificação sonora quando a página carregar
  function initSoundNotification() {
    loadSoundNotificationPreference();
    const soundSwitch = document.getElementById('soundNotificationSwitch');
    if (soundSwitch) {
      soundSwitch.addEventListener('change', (e) => {
        saveSoundNotificationPreference(e.target.checked);
      });
    }
  }

  // Polling para verificar novas mensagens periodicamente (a cada 10 segundos)
  let conversationPollingInterval = null;
  function startConversationPolling() {
    if (conversationPollingInterval) return; // Já está rodando
    conversationPollingInterval = setInterval(() => {
      if (document.getElementById('conversations-list')) {
        initConversations();
      }
    }, 10000); // Verificar a cada 10 segundos
  }

  function stopConversationPolling() {
    if (conversationPollingInterval) {
      clearInterval(conversationPollingInterval);
      conversationPollingInterval = null;
    }
  }

  const API_BASE = getApiBase();
  w.PromoPingAdmin = { 
    fetchJSON, 
    initDashboard, 
    initTables, 
    initAuthors,
    initAtualizacoes,
    initProfile, 
    saveProfile, 
    initGithubProjects, 
    initConversations, 
    initSupportWidget, 
    requireAuth, 
    initSoundNotification,
    startConversationPolling,
    stopConversationPolling,
    playNotificationSound,
    saveSoundNotificationPreference,
    loadSoundNotificationPreference,
    isSoundNotificationEnabled,
    viewIncidentById,
    editIncidentById,
    showIncidentDetails,
    getStatusBadge,
    editAuthorById,
    createNewIncident,
    viewUpdateById,
    editUpdateById,
    createNewUpdate,
    API_BASE, 
    TOKEN 
  };
})(window);


