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
    
    // Limpar notificações anteriores (mas manter classes do container)
    const isLogoOnly = !title && !message;
    this.clear();
    
    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Ativar container - se for apenas logo, não adicionar fundo escuro
    // Adicionar logo-only-mode ANTES de active para garantir que o CSS funcione
    if (isLogoOnly) {
      this.container.classList.add('logo-only-mode', 'active');
      // Forçar remoção do blur via JavaScript também
      this.container.style.background = 'rgba(0, 0, 0, 0)';
      this.container.style.backdropFilter = 'none';
      this.container.style.webkitBackdropFilter = 'none';
    } else {
      this.container.classList.remove('logo-only-mode');
      this.container.classList.add('active');
      // Restaurar estilos padrão
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      this.container.style.webkitBackdropFilter = '';
    }

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

    // Desativar container
    setTimeout(() => {
      this.container.classList.remove('active', 'logo-only-mode');
    }, 200);

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
      notification.classList.remove('show');
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 400);
    });
    this.container.classList.remove('active', 'logo-only-mode');
  }

  /**
   * Cria o elemento HTML da notificação
   */
  createNotification(id, type, title, message, closable) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;

    const closeButton = closable ? this.createCloseButton(id) : '';

    // Se não tiver título nem mensagem, mostrar apenas o logo (estilo de loading)
    if (!title && !message) {
      notification.classList.add('logo-only');
      notification.innerHTML = `
        <div class="notification-header">
          <img src="assets/images/PromoPing.png" alt="PromoPing Logo" class="notification-logo">
        </div>
      `;
    } else {
      // Notificação normal com título e mensagem
      notification.innerHTML = `
        <div class="notification-header">
          <img src="assets/images/PromoPing.png" alt="PromoPing Logo" class="notification-logo">
        </div>
        ${title ? `<div class="notification-title">${title}</div>` : ''}
        ${message ? `<div class="notification-message">${message}</div>` : ''}
        ${closeButton}
      `;
    }

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

console.log('Sistema de notificações PromoPing carregado');
