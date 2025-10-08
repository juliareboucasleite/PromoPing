// ================== CONFIGURAÇÃO ==================
const API_URL = "http://localhost:3000/api";

// ================== CONFIGURAÇÃO DE PLANOS ==================
// 🧩 Plano do utilizador (simulação - em produção viria da API)
const userPlano = "Free"; // altera para 'Free', 'Basic', 'Standard' ou 'Premium'
let componentes = [];
let incidentes = [];
let incidentesOriginais = []; // Para filtros
let metricas = {};

// ================== ELEMENTOS DOM ==================
const elements = {
  // Formulários
  addForm: document.getElementById('addForm'),
  editForm: document.getElementById('editForm'),
  incidentForm: document.getElementById('incidentForm'),
  
  // Tabelas
  componentTable: document.getElementById('componentTable'),
  incidentTable: document.getElementById('incidentTable'),
  
  // Estatísticas
  totalComponentes: document.getElementById('totalComponentes'),
  operacionais: document.getElementById('operacionais'),
  degradados: document.getElementById('degradados'),
  foraAr: document.getElementById('foraAr'),
  totalIncidentes: document.getElementById('totalIncidentes'),
  incidentesAtivos: document.getElementById('incidentesAtivos'),
  incidentesResolvidos: document.getElementById('incidentesResolvidos'),
  
  // Métricas
  uptimeGeral: document.getElementById('uptimeGeral'),
  tempoResposta: document.getElementById('tempoResposta'),
  usuariosAtivos: document.getElementById('usuariosAtivos'),
  produtosMonitorizados: document.getElementById('produtosMonitorizados'),
  notificacoesEnviadas: document.getElementById('notificacoesEnviadas'),
  
  // Filtros
  filtroEstado: document.getElementById('filtroEstado'),
  filtroComponente: document.getElementById('filtroComponente'),
  limparFiltros: document.getElementById('limparFiltros'),
  exportarIncidentes: document.getElementById('exportarIncidentes'),
  exportarExcel: document.getElementById('exportarExcel'),
  
  // Outros
  lastUpdate: document.getElementById('lastUpdate'),
  apiStatus: document.getElementById('apiStatus'),
  refreshBtn: document.getElementById('refreshBtn'),
  editModal: document.getElementById('editModal'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  toastContainer: document.getElementById('toastContainer')
};

// ================== UTILITÁRIOS ==================
function mostrarLoading() {
  elements.loadingOverlay.style.display = 'block';
}

function esconderLoading() {
  elements.loadingOverlay.style.display = 'none';
}

function mostrarToast(mensagem, tipo = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <span>${getToastIcon(tipo)}</span>
      <span>${mensagem}</span>
    </div>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Auto-remover após 5 segundos
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s ease reverse';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

function getToastIcon(tipo) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[tipo] || icons.info;
}

function formatarData(data) {
  return new Date(data).toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatarNumero(numero) {
  return new Intl.NumberFormat('pt-BR').format(numero);
}

// ================== API CALLS ==================
async function fazerRequisicao(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

async function carregarDados() {
  mostrarLoading();
  
  try {
    // Carregar status geral
    const statusData = await fazerRequisicao(`${API_URL}/status`);
    
    componentes = statusData.componentes || [];
    incidentes = statusData.incidentes || [];
    metricas = statusData.metricas || {};
    
    // Atualizar interface
    atualizarComponentes();
    atualizarIncidentes();
    atualizarMetricas();
    atualizarEstatisticas();
    atualizarTimestamp(statusData.ultimaAtualizacao);
    
    // Verificar status da API
    elements.apiStatus.textContent = 'Online';
    elements.apiStatus.className = 'api-status online';
    
    mostrarToast('Dados carregados com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    elements.apiStatus.textContent = 'Offline';
    elements.apiStatus.className = 'api-status offline';
    mostrarToast(`Erro ao carregar dados: ${error.message}`, 'error');
  } finally {
    esconderLoading();
  }
}

// ================== COMPONENTES ==================
function atualizarComponentes() {
  const tbody = elements.componentTable.querySelector('tbody');
  const selectComponente = document.getElementById('componente');
  const selectIncidentComponente = document.getElementById('incidentComponente');
  const filtroComponente = elements.filtroComponente;
  
  tbody.innerHTML = '';
  
  // Limpar selects
  selectComponente.innerHTML = '<option value="">Selecione o componente</option>';
  selectIncidentComponente.innerHTML = '<option value="">Selecione o componente</option>';
  filtroComponente.innerHTML = '<option value="">Todos os componentes</option>';
  
  componentes.forEach(comp => {
    // Tabela de componentes
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${comp.Id}</td>
      <td><strong>${comp.Nome}</strong></td>
      <td><span class="status-${comp.Status}">${getStatusIcon(comp.Status)} ${comp.Status}</span></td>
      <td>${comp.Uptime}%</td>
      <td>${comp.Latencia || 0} ms</td>
      <td>${formatarData(comp.UltimaVerificacao)}</td>
      <td>${comp.Notas || '—'}</td>
      <td>
        <button class="btn-update" onclick="abrirModalEdicao(${comp.Id})">
          ✏️ Editar
        </button>
      </td>
    `;
    tbody.appendChild(row);
    
    // Select do modal de edição
    const option1 = document.createElement('option');
    option1.value = comp.Id;
    option1.textContent = comp.Nome;
    selectComponente.appendChild(option1);
    
    // Select do formulário de incidentes
    const option2 = document.createElement('option');
    option2.value = comp.Id;
    option2.textContent = comp.Nome;
    selectIncidentComponente.appendChild(option2);
    
    // Select do filtro de incidentes
    const option3 = document.createElement('option');
    option3.value = comp.Id;
    option3.textContent = comp.Nome;
    filtroComponente.appendChild(option3);
  });
}

function getStatusIcon(status) {
  const icons = {
    operational: '🟢',
    degraded: '🟡',
    outage: '🔴'
  };
  return icons[status] || '⚪';
}

async function adicionarComponente(dados) {
  try {
    mostrarLoading();
    
    const response = await fazerRequisicao(`${API_URL}/componentes`, {
      method: 'POST',
      body: JSON.stringify(dados)
    });
    
    mostrarToast('Componente adicionado com sucesso!', 'success');
    await carregarDados(); // Recarregar dados
    
  } catch (error) {
    console.error('Erro ao adicionar componente:', error);
    mostrarToast(`Erro ao adicionar componente: ${error.message}`, 'error');
  } finally {
    esconderLoading();
  }
}

async function atualizarComponente(id, dados) {
  try {
    mostrarLoading();
    
    const response = await fazerRequisicao(`${API_URL}/componentes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dados)
    });
    
    mostrarToast('Componente atualizado com sucesso!', 'success');
    await carregarDados(); // Recarregar dados
    
  } catch (error) {
    console.error('Erro ao atualizar componente:', error);
    mostrarToast(`Erro ao atualizar componente: ${error.message}`, 'error');
  } finally {
    esconderLoading();
  }
}

// ================== INCIDENTES ==================
function atualizarIncidentes() {
  incidentesOriginais = [...incidentes];
  renderizarIncidentes(incidentes);
}

function renderizarIncidentes(lista) {
  const tbody = elements.incidentTable.querySelector('tbody');
  tbody.innerHTML = '';
  
  lista.forEach(inc => {
    const row = document.createElement('tr');
    const resolvido = inc.Status === 'resolved';
    const componenteNome = getComponenteNome(inc.ComponentesAfetados);
    
    row.innerHTML = `
      <td>${inc.Id}</td>
      <td><strong>${inc.Titulo}</strong></td>
      <td>${inc.Impacto || '—'}</td>
      <td>
        <span class="incident-indicator ${inc.Status}"></span>
        <span class="status-${inc.Status}">${getIncidentStatusIcon(inc.Status)} ${inc.Status}</span>
      </td>
      <td>${formatarData(inc.DataInicio)}</td>
      <td>${inc.DataFim ? formatarData(inc.DataFim) : '—'}</td>
      <td>${componenteNome}</td>
      <td>
        ${resolvido 
          ? '—' 
          : `<button class="btn-encerrar" onclick="encerrarIncidente(${inc.Id})">🔒 Encerrar</button>`
        }
      </td>
    `;
    tbody.appendChild(row);
  });
}

function getIncidentStatusIcon(status) {
  const icons = {
    investigating: '🔍',
    identified: '🎯',
    monitoring: '👀',
    resolved: '✅'
  };
  return icons[status] || '❓';
}

function getComponenteNome(componenteId) {
  if (!componenteId) return '—';
  const componente = componentes.find(c => c.Id == componenteId);
  return componente ? componente.Nome : `ID: ${componenteId}`;
}

async function criarIncidente(dados) {
  try {
    mostrarLoading();
    
    const response = await fazerRequisicao(`${API_URL}/incidentes`, {
      method: 'POST',
      body: JSON.stringify(dados)
    });
    
    mostrarToast('Incidente criado com sucesso!', 'success');
    await carregarDados(); // Recarregar dados
    
  } catch (error) {
    console.error('Erro ao criar incidente:', error);
    mostrarToast(`Erro ao criar incidente: ${error.message}`, 'error');
  } finally {
    esconderLoading();
  }
}

async function encerrarIncidente(id) {
  const confirmar = confirm('Deseja realmente encerrar este incidente?');
  if (!confirmar) return;
  
  try {
    mostrarLoading();
    
    const response = await fazerRequisicao(`${API_URL}/incidentes/${id}/encerrar`, {
      method: 'PUT'
    });
    
    mostrarToast('Incidente encerrado com sucesso!', 'success');
    await carregarDados(); // Recarregar dados
    
  } catch (error) {
    console.error('Erro ao encerrar incidente:', error);
    mostrarToast(`Erro ao encerrar incidente: ${error.message}`, 'error');
  } finally {
    esconderLoading();
  }
}

// ================== FILTROS ==================
function aplicarFiltros() {
  const estado = elements.filtroEstado.value;
  const componenteId = elements.filtroComponente.value;
  
  const filtrado = incidentesOriginais.filter(inc => {
    const matchEstado = estado ? inc.Status === estado : true;
    const matchComponente = componenteId ? inc.ComponentesAfetados == componenteId : true;
    return matchEstado && matchComponente;
  });
  
  renderizarIncidentes(filtrado);
}

function limparFiltros() {
  elements.filtroEstado.value = '';
  elements.filtroComponente.value = '';
  renderizarIncidentes(incidentesOriginais);
}

function exportarIncidentes() {
  const dados = incidentesOriginais.map(inc => ({
    ID: inc.Id,
    Título: inc.Titulo,
    Impacto: inc.Impacto || '',
    Status: inc.Status,
    'Data Início': formatarData(inc.DataInicio),
    'Data Fim': inc.DataFim ? formatarData(inc.DataFim) : '',
    Componente: getComponenteNome(inc.ComponentesAfetados),
    Descrição: inc.Descricao || ''
  }));
  
  const csv = converterParaCSV(dados);
  downloadCSV(csv, 'incidentes-promoping.csv');
  mostrarToast('Incidentes exportados com sucesso!', 'success');
}

function converterParaCSV(dados) {
  if (dados.length === 0) return '';
  
  const headers = Object.keys(dados[0]);
  const csvContent = [
    headers.join(','),
    ...dados.map(row => headers.map(header => `"${row[header]}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function exportarParaExcel() {
  try {
    mostrarLoading();
    
    // Criar link temporário para download
    const link = document.createElement('a');
    link.href = `${API_URL}/incidentes/exportar`;
    link.style.display = 'none';
    
    // Adicionar ao DOM temporariamente
    document.body.appendChild(link);
    
    // Simular clique para iniciar download
    link.click();
    
    // Remover link após um tempo
    setTimeout(() => {
      document.body.removeChild(link);
    }, 1000);
    
    mostrarToast('Relatório Excel gerado com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao exportar para Excel:', error);
    mostrarToast(`Erro ao exportar Excel: ${error.message}`, 'error');
  } finally {
    esconderLoading();
  }
}

// ================== MÉTRICAS ==================
function atualizarMetricas() {
  elements.uptimeGeral.textContent = metricas.UptimeGeral || '--';
  elements.tempoResposta.textContent = metricas.TempoRespostaMedia || '--';
  elements.usuariosAtivos.textContent = formatarNumero(metricas.UtilizadoresAtivos || 0);
  elements.produtosMonitorizados.textContent = formatarNumero(metricas.ProdutosMonitorizados || 0);
  elements.notificacoesEnviadas.textContent = formatarNumero(metricas.NotificacoesEnviadas || 0);
}

// ================== ESTATÍSTICAS ==================
function atualizarEstatisticas() {
  // Estatísticas de componentes
  elements.totalComponentes.textContent = `Total: ${componentes.length}`;
  
  const operacionais = componentes.filter(c => c.Status === 'operational').length;
  const degradados = componentes.filter(c => c.Status === 'degraded').length;
  const foraAr = componentes.filter(c => c.Status === 'outage').length;
  
  elements.operacionais.textContent = `Operacionais: ${operacionais}`;
  elements.degradados.textContent = `Degradados: ${degradados}`;
  elements.foraAr.textContent = `Fora do Ar: ${foraAr}`;
  
  // Estatísticas de incidentes
  elements.totalIncidentes.textContent = `Total: ${incidentes.length}`;
  
  const ativos = incidentes.filter(i => i.Status === 'investigating' || i.Status === 'identified' || i.Status === 'monitoring').length;
  const resolvidos = incidentes.filter(i => i.Status === 'resolved').length;
  
  elements.incidentesAtivos.textContent = `Ativos: ${ativos}`;
  elements.incidentesResolvidos.textContent = `Resolvidos: ${resolvidos}`;
}

// ================== TIMESTAMP ==================
function atualizarTimestamp(timestamp) {
  if (timestamp) {
    elements.lastUpdate.textContent = `Última atualização: ${formatarData(timestamp)}`;
  }
}

// ================== MODAL ==================
function abrirModalEdicao(id) {
  const componente = componentes.find(c => c.Id === id);
  if (!componente) {
    mostrarToast('Componente não encontrado!', 'error');
    return;
  }
  
  // Preencher formulário
  document.getElementById('editId').value = componente.Id;
  document.getElementById('editEstado').value = componente.Status;
  document.getElementById('editUptime').value = componente.Uptime;
  document.getElementById('editLatencia').value = componente.Latencia || 0;
  document.getElementById('editNotas').value = componente.Notas || '';
  
  // Mostrar modal
  elements.editModal.style.display = 'block';
}

function fecharModal() {
  elements.editModal.style.display = 'none';
  elements.editForm.reset();
}

// ================== EVENT LISTENERS ==================
// Formulário de adição de componentes
elements.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const dados = {
    nome: document.getElementById('nome').value.trim(),
    status: document.getElementById('estado').value,
    uptime: parseFloat(document.getElementById('uptime').value) || 99.9,
    latencia: parseInt(document.getElementById('latencia').value) || 0,
    detalhes: {},
    notas: document.getElementById('notas').value.trim()
  };
  
  if (!dados.nome) {
    mostrarToast('Nome do componente é obrigatório!', 'warning');
    return;
  }
  
  await adicionarComponente(dados);
  elements.addForm.reset();
});

// Formulário de edição de componentes
elements.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = parseInt(document.getElementById('editId').value);
  const dados = {
    status: document.getElementById('editEstado').value,
    uptime: parseFloat(document.getElementById('editUptime').value),
    latencia: parseInt(document.getElementById('editLatencia').value),
    notas: document.getElementById('editNotas').value.trim()
  };
  
  await atualizarComponente(id, dados);
  fecharModal();
});

// Formulário de criação de incidentes
elements.incidentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const dados = {
    titulo: document.getElementById('incidentTitulo').value.trim(),
    descricao: document.getElementById('incidentDescricao').value.trim(),
    impacto: document.getElementById('incidentImpacto').value.trim(),
    estado: document.getElementById('incidentEstado').value,
    componenteId: document.getElementById('incidentComponente').value || null
  };
  
  if (!dados.titulo) {
    mostrarToast('Título do incidente é obrigatório!', 'warning');
    return;
  }
  
  await criarIncidente(dados);
  elements.incidentForm.reset();
});

// Filtros de incidentes
elements.filtroEstado.addEventListener('change', aplicarFiltros);
elements.filtroComponente.addEventListener('change', aplicarFiltros);

// Botões de ação
elements.limparFiltros.addEventListener('click', limparFiltros);
elements.exportarIncidentes.addEventListener('click', exportarIncidentes);
elements.exportarExcel.addEventListener('click', exportarParaExcel);
elements.refreshBtn.addEventListener('click', carregarDados);

// Fechar modal ao clicar no X
document.querySelector('.close').addEventListener('click', fecharModal);

// Fechar modal ao clicar fora dele
window.addEventListener('click', (e) => {
  const editModal = document.getElementById('editModal');
  const planosModal = document.getElementById('planosModal');
  
  if (e.target === editModal) {
    fecharModal();
  }
  
  if (e.target === planosModal) {
    fecharModalPlanos();
  }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
  const editModal = document.getElementById('editModal');
  const planosModal = document.getElementById('planosModal');
  
  if (e.key === 'Escape') {
    if (editModal && editModal.style.display === 'block') {
      fecharModal();
    }
    if (planosModal && planosModal.style.display === 'block') {
      fecharModalPlanos();
    }
  }
});

// ================== AUTO-REFRESH ==================
// Atualizar dados a cada 30 segundos
setInterval(carregarDados, 30000);

// ================== FUNÇÕES DE PLANOS ==================

// Verificar plano e mostrar/ocultar funcionalidades
function verificarPlano() {
  const exportContainer = document.getElementById("exportContainer");
  const upgradeMsg = document.getElementById("upgradeMsg");

  if (["Basic", "Standard", "Premium"].includes(userPlano)) {
    // Plano pago - mostrar botões de exportação
    if (exportContainer) exportContainer.style.display = "flex";
    if (upgradeMsg) upgradeMsg.style.display = "none";
    console.log(`✅ Plano ${userPlano} - Funcionalidades de exportação ativadas`);
  } else {
    // Plano Free - mostrar mensagem de upgrade
    if (exportContainer) exportContainer.style.display = "none";
    if (upgradeMsg) upgradeMsg.style.display = "block";
    console.log(`🔒 Plano ${userPlano} - Funcionalidades limitadas`);
  }
}

// Abrir modal de planos
function abrirModalPlanos() {
  const modal = document.getElementById('planosModal');
  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    console.log('🚀 Modal de planos aberto');
  }
}

// Fechar modal de planos
function fecharModalPlanos() {
  const modal = document.getElementById('planosModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    console.log('❌ Modal de planos fechado');
  }
}

// Selecionar plano (simulação)
function selecionarPlano(plano) {
  // Em produção, aqui seria feita a integração com sistema de pagamento
  console.log(`🎯 Plano selecionado: ${plano}`);
  
  // Simular upgrade (apenas para demonstração)
  if (confirm(`Deseja fazer upgrade para o plano ${plano}?`)) {
    // Atualizar plano do usuário
    userPlano = plano;
    
    // Atualizar interface
    verificarPlano();
    
    // Fechar modal
    fecharModalPlanos();
    
    // Mostrar mensagem de sucesso
    mostrarToast(`🎉 Upgrade para ${plano} realizado com sucesso!`, 'success');
    
    // Simular recarregamento de dados
    setTimeout(() => {
      carregarDados();
    }, 1000);
  }
}

// ================== INICIALIZAÇÃO ==================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Painel de Status PromoPing iniciado');
  carregarDados();
  verificarPlano(); // Verificar plano na inicialização
});

// ================== FUNÇÕES GLOBAIS ==================
// Funções que precisam estar no escopo global para serem chamadas pelo HTML
window.abrirModalEdicao = abrirModalEdicao;
window.fecharModal = fecharModal;
window.abrirModalPlanos = abrirModalPlanos;
window.fecharModalPlanos = fecharModalPlanos;
window.selecionarPlano = selecionarPlano;
window.encerrarIncidente = encerrarIncidente;
