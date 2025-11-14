/**
 * Sistema de Notificações PromoPing
 * Notificações elegantes no canto inferior direito com fade
 */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.init();
  }

  init() {
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createContainer());
    } else {
      this.createContainer();
    }
  }

  createContainer() {
    // Criar container se não existir
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }

  /**
   * Mostra uma notificação
   * @param {Object} options - Opções da notificação
   * @param {string} options.type - Tipo: 'success', 'error', 'warning', 'info'
   * @param {string} options.title - Título da notificação
   * @param {string} options.message - Mensagem da notificação
   * @param {number} options.duration - Duração em ms (padrão: 5000)
   * @param {boolean} options.closable - Se pode ser fechada (padrão: true)
   */
  show({ type = 'info', title = '', message = '', duration = 5000, closable = true }) {
    const id = this.generateId();
    const notification = this.createNotification(id, type, title, message, closable);
    
    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Animar entrada
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-remover após duração
    if (duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, duration);
    }

    return id;
  }

  /**
   * Esconde uma notificação
   * @param {string} id - ID da notificação
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.classList.remove('show');
    notification.classList.add('hide');

    // Remover do DOM após animação
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications.delete(id);
    }, 400);
  }

  /**
   * Remove todas as notificações
   */
  clear() {
    this.notifications.forEach((notification, id) => {
      this.hide(id);
    });
  }

  /**
   * Cria o elemento HTML da notificação
   */
  createNotification(id, type, title, message, closable) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;

    const icon = this.getIcon(type);
    const closeButton = closable ? this.createCloseButton(id) : '';

    notification.innerHTML = `
      <div class="notification-header">
        <h4 class="notification-title">
          ${icon}
          ${title}
        </h4>
        ${closeButton}
      </div>
      <p class="notification-message">${message}</p>
      <div class="notification-progress"></div>
    `;

    return notification;
  }

  /**
   * Cria botão de fechar
   */
  createCloseButton(id) {
    return `
      <button class="notification-close" onclick="notificationSystem.hide('${id}')" aria-label="Fechar">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
  }

  /**
   * Retorna ícone baseado no tipo
   */
  getIcon(type) {
    const icons = {
      success: `
        <svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22,4 12,14.01 9,11.01"></polyline>
        </svg>
      `,
      error: `
        <svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `,
      warning: `
        <svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `,
      info: `
        <svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `
    };

    return icons[type] || icons.info;
  }

  /**
   * Gera ID único para notificação
   */
  generateId() {
    return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Métodos de conveniência
  success(title, message, duration = 5000) {
    return this.show({ type: 'success', title, message, duration });
  }

  error(title, message, duration = 7000) {
    return this.show({ type: 'error', title, message, duration });
  }

  warning(title, message, duration = 6000) {
    return this.show({ type: 'warning', title, message, duration });
  }

  info(title, message, duration = 5000) {
    return this.show({ type: 'info', title, message, duration });
  }
}

// Instância global
window.notificationSystem = new NotificationSystem();

// Métodos globais para facilitar uso
window.showNotification = (type, title, message, duration) => {
  return window.notificationSystem.show({ type, title, message, duration });
};

window.showSuccess = (title, message, duration) => {
  return window.notificationSystem.success(title, message, duration);
};

window.showError = (title, message, duration) => {
  return window.notificationSystem.error(title, message, duration);
};

window.showWarning = (title, message, duration) => {
  return window.notificationSystem.warning(title, message, duration);
};

window.showInfo = (title, message, duration) => {
  return window.notificationSystem.info(title, message, duration);
};

// Substituir alerts por notificações
window.originalAlert = window.alert;
window.alert = (message) => {
  window.notificationSystem.error('Aviso', message, 5000);
};

console.log('🔔 Sistema de notificações PromoPing carregado');
