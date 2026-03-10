/**
 * Modais de aviso compactos e profissionais (substitui alert/confirm nativos).
 * Uso: showAlert('Mensagem', 'Título'); showConfirm('Mensagem?', 'Título', () => {}, () => {});
 */
(function() {
    'use strict';

    const DEFAULT_TITLE = 'PromoPing';
    const DEFAULT_CONFIRM = 'OK';
    const DEFAULT_CANCEL = 'Cancelar';

    let overlay = null;
    let modalEl = null;

    function getContainer() {
        if (overlay && overlay.parentNode) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay aviso-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'aviso-modal-title');
        modalEl = document.createElement('div');
        modalEl.className = 'modal aviso-modal';
        overlay.appendChild(modalEl);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) close();
        });
        return overlay;
    }

    function close() {
        if (overlay) overlay.classList.remove('show');
    }

    function setContent(html) {
        if (!modalEl) getContainer();
        modalEl.innerHTML = html;
    }

    /**
     * Mostra um aviso com um botão OK (substitui alert).
     * @param {string} message - Texto da mensagem
     * @param {string} [title=PromoPing] - Título do modal
     */
    function showAlert(message, title) {
        const t = title != null && title !== '' ? String(title) : DEFAULT_TITLE;
        const msg = message != null ? String(message) : '';
        setContent(
            '<div class="aviso-header">' +
                '<span class="aviso-icon aviso-icon-info" aria-hidden="true"></span>' +
                '<h3 id="aviso-modal-title" class="aviso-title">' + escapeHtml(t) + '</h3>' +
            '</div>' +
            '<p class="aviso-message">' + escapeHtml(msg) + '</p>' +
            '<div class="aviso-actions">' +
                '<button type="button" class="aviso-btn aviso-btn-primary" data-dismiss>OK</button>' +
            '</div>'
        );
        modalEl.querySelector('[data-dismiss]').addEventListener('click', close);
        overlay = getContainer();
        overlay.classList.add('show');
        modalEl.querySelector('.aviso-btn-primary').focus();
    }

    /**
     * Mostra confirmação com dois botões (substitui confirm).
     * @param {string} message - Texto da pergunta
     * @param {string|object} titleOrOpts - Título (string) ou { title, confirmText, cancelText }
     * @param {function} onConfirm - Chamado ao clicar no botão principal
     * @param {function} [onCancel] - Chamado ao cancelar
     */
    function showConfirm(message, titleOrOpts, onConfirm, onCancel) {
        let title = DEFAULT_TITLE;
        let confirmText = DEFAULT_CONFIRM;
        let cancelText = DEFAULT_CANCEL;
        if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
            title = titleOrOpts.title != null ? titleOrOpts.title : title;
            confirmText = titleOrOpts.confirmText != null ? titleOrOpts.confirmText : confirmText;
            cancelText = titleOrOpts.cancelText != null ? titleOrOpts.cancelText : cancelText;
        } else if (typeof titleOrOpts === 'string') {
            title = titleOrOpts;
        }
        const msg = message != null ? String(message) : '';
        setContent(
            '<div class="aviso-header">' +
                '<span class="aviso-icon aviso-icon-warn" aria-hidden="true"></span>' +
                '<h3 id="aviso-modal-title" class="aviso-title">' + escapeHtml(title) + '</h3>' +
            '</div>' +
            '<p class="aviso-message">' + escapeHtml(msg) + '</p>' +
            '<div class="aviso-actions">' +
                '<button type="button" class="aviso-btn aviso-btn-secondary" data-cancel>' + escapeHtml(cancelText) + '</button>' +
                '<button type="button" class="aviso-btn aviso-btn-primary" data-confirm>' + escapeHtml(confirmText) + '</button>' +
            '</div>'
        );
        const doClose = function() {
            close();
        };
        modalEl.querySelector('[data-cancel]').addEventListener('click', function() {
            doClose();
            if (typeof onCancel === 'function') onCancel();
        });
        modalEl.querySelector('[data-confirm]').addEventListener('click', function() {
            doClose();
            if (typeof onConfirm === 'function') onConfirm();
        });
        overlay = getContainer();
        overlay.classList.add('show');
        modalEl.querySelector('[data-cancel]').focus();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    window.showAlert = showAlert;
    window.showConfirm = showConfirm;
})();
