/**
 * Perfil - PromoPing Admin
 * Gerenciamento de perfil do suporte
 */

(function() {
    'use strict';

    const API_BASE = (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000').replace(/\/+$/, '');
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    async function fetchAuth(url, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`[PERFIL] Erro:`, error);
            throw error;
        }
    }

    /**
     * Carregar perfil do usuário
     */
    async function loadProfile() {
        try {
            const response = await fetchAuth('/api/user/me');
            const data = await response.json();

            const nameInput = document.getElementById('profileName');
            const emailInput = document.getElementById('profileEmail');
            const descriptionInput = document.getElementById('profileDescription');
            const specialtyInput = document.getElementById('profileSpecialty');
            const photoDiv = document.getElementById('profilePhoto');

            if (data.user) {
                if (nameInput) nameInput.value = data.user.Nome || data.user.nome || '';
                if (emailInput) emailInput.value = data.user.Email || data.user.email || '';
            }

            // Carregar dados extras do perfil (descrição, foto, especialidade) do localStorage
            const profileData = localStorage.getItem('PROMOPING_PROFILE');
            if (profileData) {
                try {
                    const profile = JSON.parse(profileData);
                    if (descriptionInput) descriptionInput.value = profile.descricao || '';
                    if (specialtyInput) specialtyInput.value = profile.especialidade || '';
                    if (photoDiv && profile.foto) {
                        photoDiv.innerHTML = '';
                        photoDiv.style.display = 'block';
                        const img = document.createElement('img');
                        img.src = profile.foto;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '50%';
                        photoDiv.appendChild(img);
                        // Atualizar visibilidade do botão de remover
                        setTimeout(() => updateRemovePhotoButton(), 100);
                    }
                } catch (e) {
                    console.error('[PERFIL] Erro ao parsear dados do perfil:', e);
                }
            }
        } catch (error) {
            console.error('[PERFIL] Erro ao carregar perfil:', error);
        }
    }

    /**
     * Salvar perfil
     */
    async function saveProfile() {
        const nameInput = document.getElementById('profileName');
        const descriptionInput = document.getElementById('profileDescription');
        const specialtyInput = document.getElementById('profileSpecialty');
        const photoDiv = document.getElementById('profilePhoto');

        if (!nameInput || !descriptionInput) {
            alert('Erro: Elementos do formulário não encontrados');
            return;
        }

        // Obter foto se houver imagem dentro do div
        let fotoUrl = '';
        if (photoDiv) {
            const img = photoDiv.querySelector('img');
            if (img) {
                fotoUrl = img.src;
            }
        }

        const profileData = {
            nome: nameInput.value.trim(),
            descricao: descriptionInput.value.trim(),
            especialidade: specialtyInput ? specialtyInput.value.trim() : '',
            foto: fotoUrl
        };

        if (!profileData.nome) {
            alert('Por favor, preencha o nome');
            return;
        }

        try {
            // Salvar no localStorage por enquanto (pode ser expandido para API depois)
            localStorage.setItem('PROMOPING_PROFILE', JSON.stringify(profileData));

            // Atualizar nome e email no servidor
            try {
                await fetchAuth('/api/user/profile', {
                    method: 'PUT',
                    body: JSON.stringify({
                        nome: profileData.nome,
                        email: document.getElementById('profileEmail').value.trim()
                    })
                });
            } catch (err) {
                console.warn('[PERFIL] Erro ao atualizar perfil no servidor:', err);
                // Continuar mesmo se falhar, pois os dados estão salvos localmente
            }

            alert('Perfil salvo com sucesso!');
        } catch (error) {
            console.error('[PERFIL] Erro ao salvar perfil:', error);
            alert(`Erro ao salvar perfil: ${error.message}`);
        }
    }

    /**
     * Atualizar visibilidade do botão de remover foto
     */
    function updateRemovePhotoButton() {
        const photoDiv = document.getElementById('profilePhoto');
        const removePhotoBtn = document.getElementById('removePhotoBtn');

        if (!photoDiv || !removePhotoBtn) return;

        const hasImage = photoDiv.querySelector('img') !== null;
        removePhotoBtn.style.display = hasImage ? 'inline-block' : 'none';
    }

    /**
     * Remover foto
     */
    function removePhoto() {
        const photoDiv = document.getElementById('profilePhoto');
        const photoInput = document.getElementById('photoInput');

        if (!photoDiv) return;

        // Restaurar placeholder
        photoDiv.innerHTML = 'PP';
        photoDiv.style.display = 'flex';
        photoDiv.style.alignItems = 'center';
        photoDiv.style.justifyContent = 'center';
        photoDiv.style.fontSize = '3rem';
        photoDiv.style.fontWeight = '700';
        photoDiv.style.color = '#ff9800';
        photoDiv.style.background = '#232326';
        photoDiv.style.border = '3px solid #ff9800';

        // Limpar input de arquivo
        if (photoInput) {
            photoInput.value = '';
        }

        // Atualizar visibilidade do botão
        updateRemovePhotoButton();

        // Remover foto do localStorage
        const profileData = localStorage.getItem('PROMOPING_PROFILE');
        if (profileData) {
            try {
                const profile = JSON.parse(profileData);
                profile.foto = '';
                localStorage.setItem('PROMOPING_PROFILE', JSON.stringify(profile));
            } catch (e) {
                console.error('[PERFIL] Erro ao remover foto do localStorage:', e);
            }
        }
    }

    /**
     * Alterar foto
     */
    function setupPhotoUpload() {
        const photoInput = document.getElementById('photoInput');
        const changePhotoBtn = document.getElementById('changePhotoBtn');
        const removePhotoBtn = document.getElementById('removePhotoBtn');
        const photoDiv = document.getElementById('profilePhoto');

        if (!photoInput || !changePhotoBtn || !photoDiv) return;

        changePhotoBtn.addEventListener('click', () => {
            photoInput.click();
        });

        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', removePhoto);
        }

        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validar tipo de arquivo
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione uma imagem válida');
                return;
            }

            // Validar tamanho (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('A imagem deve ter no máximo 5MB');
                return;
            }

            // Ler arquivo e exibir preview
            const reader = new FileReader();
            reader.onload = (event) => {
                // Criar elemento img dentro do div
                photoDiv.innerHTML = '';
                photoDiv.style.display = 'block';
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '50%';
                photoDiv.appendChild(img);

                // Mostrar botão de remover
                updateRemovePhotoButton();
            };
            reader.readAsDataURL(file);
        });

        // Verificar se já existe foto ao carregar
        updateRemovePhotoButton();
    }

    function init() {
        if (!checkAuth()) return;

        const profileForm = document.getElementById('profileForm');
        const logoutBtn = document.getElementById('logoutBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        setupPhotoUpload();

        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveProfile();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                loadProfile(); // Recarregar dados originais
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }

        loadProfile();
        console.log('[PERFIL] Página de perfil inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();