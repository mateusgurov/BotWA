document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const botStatus = document.getElementById('botStatus');
    const reconnectBot = document.getElementById('reconnectBot');
    const allowedNumbers = document.getElementById('allowedNumbers');
    const systemLogs = document.getElementById('systemLogs');
    const saveNumberBtn = document.getElementById('saveNumber');
    const addNumberModal = new bootstrap.Modal(document.getElementById('addNumberModal'));
    const botsList = document.getElementById('botsList');
    const saveBotBtn = document.getElementById('saveBot');
    const addBotModal = new bootstrap.Modal(document.getElementById('addBotModal'));

    // Estado inicial
    let isConnected = false;

    // Funções de utilidade
    function addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${message}`;
        systemLogs.insertBefore(logEntry, systemLogs.firstChild);
    }

    function updateBotStatus(status, details) {
        const hasActiveBots = details?.bots?.length > 0;
        
        if (!hasActiveBots) {
            botStatus.className = 'alert alert-warning';
            botStatus.innerHTML = 'Nenhum bot ativo encontrado';
            return;
        }

        let statusHtml = '<h6>Status dos Bots:</h6>';
        details.bots.forEach(bot => {
            const statusClass = bot.isReady ? 'success' : 'warning';
            const statusIcon = bot.isReady ? '✅' : '⚠️';
            
            statusHtml += `
                <div class="bot-status-item mb-2">
                    <div class="text-${statusClass}">
                        ${statusIcon} Bot ${bot.numero}:
                    </div>
                    <small class="text-muted">
                        Cliente: ${bot.hasClient ? '✅' : '❌'} | 
                        Página: ${bot.hasPage ? '✅' : '❌'} | 
                        Browser: ${bot.hasBrowser ? '✅' : '❌'} | 
                        Pronto: ${bot.isReady ? '✅' : '❌'}
                    </small>
                </div>
            `;
        });

        botStatus.className = `alert alert-${status === 'connected' ? 'success' : 'warning'}`;
        botStatus.innerHTML = statusHtml;
        reconnectBot.disabled = status === 'connected';
    }

    function updateNumbersList(numbers) {
        allowedNumbers.innerHTML = '';
        numbers.forEach(number => {
            const row = document.createElement('tr');
            const vencimento = number.proximo_vencimento ? new Date(number.proximo_vencimento).toLocaleDateString() : 'N/A';
            row.innerHTML = `
                <td>${number.telefone}</td>
                <td>${number.nome}</td>
                <td>${number.plano || 'Nenhum'}</td>
                <td>${vencimento}</td>
                <td><span class="status-badge ${getStatusClass(number)}">
                    ${getStatusText(number)}
                </span></td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-danger" onclick="deleteNumber('${number.telefone}')">
                        Remover
                    </button>
                    <button class="btn btn-sm ${number.ativo === 1 ? 'btn-warning' : 'btn-success'}" 
                            onclick="toggleNumber('${number.telefone}')">
                        ${number.ativo === 1 ? 'Desativar' : 'Ativar'}
                    </button>
                    <button class="btn btn-sm btn-primary" 
                            onclick="editSubscription('${number.telefone}')">
                        Editar Assinatura
                    </button>
                </td>
            `;
            allowedNumbers.appendChild(row);
        });
    }

    // Funções para gerenciar bots
    async function loadBots() {
        try {
            const response = await fetch('/api/bots');
            const data = await response.json();
            if (data.success) {
                updateBotsList(data.bots);
            } else {
                addLog('Erro ao carregar bots: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao carregar bots: ' + error.message, 'error');
        }
    }

    function updateBotsList(bots) {
        botsList.innerHTML = '';
        bots.forEach(bot => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bot.nome}</td>
                <td>${bot.numero}</td>
                <td><span class="status-badge ${bot.ativo === 1 ? 'status-active' : 'status-inactive'}">
                    ${bot.status}
                </span></td>
                <td>${bot.descricao || ''}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-danger" onclick="deleteBot(${bot.id})">
                        Remover
                    </button>
                    <button class="btn btn-sm ${bot.ativo === 1 ? 'btn-warning' : 'btn-success'}" 
                            onclick="toggleBot(${bot.id})">
                        ${bot.ativo === 1 ? 'Desativar' : 'Ativar'}
                    </button>
                </td>
            `;
            botsList.appendChild(row);
        });
    }

    // Event Listeners
    reconnectBot.addEventListener('click', async () => {
        try {
            addLog('Tentando reconectar o bot...', 'warning');
            const response = await fetch('/api/bot/reconnect', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                addLog('Comando de reconexão enviado com sucesso', 'success');
                // Verificar status após 5 segundos
                setTimeout(checkBotStatus, 5000);
            } else {
                addLog('Erro ao tentar reconectar: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao tentar reconectar: ' + error.message, 'error');
        }
    });

    // Carregar planos ao abrir o modal de adicionar número
    document.getElementById('addNumberModal').addEventListener('show.bs.modal', loadPlans);

    // Salvar número com plano
    saveNumberBtn.addEventListener('click', async () => {
        const phoneNumber = document.getElementById('phoneNumber').value;
        const userName = document.getElementById('userName').value;
        const planId = document.getElementById('userPlan').value;
        const expiration = document.getElementById('planExpiration').value;

        if (!phoneNumber || !userName || !planId || !expiration) {
            alert('Por favor, preencha todos os campos');
            return;
        }

        try {
            const response = await fetch('/api/numbers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: phoneNumber,
                    name: userName,
                    planId: parseInt(planId),
                    expiration: expiration
                })
            });

            const data = await response.json();
            if (data.success) {
                addLog(`Número ${phoneNumber} adicionado com sucesso`, 'success');
                loadNumbers();
                addNumberModal.hide();
                // Limpar formulário
                document.getElementById('phoneNumber').value = '';
                document.getElementById('userName').value = '';
                document.getElementById('userPlan').value = '';
                document.getElementById('planExpiration').value = '';
            } else {
                addLog('Erro ao adicionar número: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao adicionar número: ' + error.message, 'error');
        }
    });

    // Salvar alterações na assinatura
    document.getElementById('saveSubscription').addEventListener('click', async () => {
        const phone = document.getElementById('editPhone').value;
        const planId = document.getElementById('editPlan').value;
        const expiration = document.getElementById('editExpiration').value;
        const status = document.getElementById('editStatus').value;

        try {
            const response = await fetch(`/api/numbers/${phone}/subscription`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    planId: parseInt(planId),
                    expiration: expiration,
                    status: status
                })
            });

            const data = await response.json();
            if (data.success) {
                addLog(`Assinatura atualizada com sucesso`, 'success');
                loadNumbers();
                bootstrap.Modal.getInstance(document.getElementById('editSubscriptionModal')).hide();
            } else {
                addLog('Erro ao atualizar assinatura: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao atualizar assinatura: ' + error.message, 'error');
        }
    });

    // Event Listeners para bots
    saveBotBtn.addEventListener('click', async () => {
        const botName = document.getElementById('botName').value;
        const botNumber = document.getElementById('botNumber').value;
        const botDescription = document.getElementById('botDescription').value;

        if (!botName || !botNumber) {
            alert('Por favor, preencha todos os campos obrigatórios');
            return;
        }

        try {
            // Mostrar modal de carregamento com QR Code
            const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
            const qrContainer = document.getElementById('qrContainer');
            const qrStatus = document.getElementById('qrStatus');
            qrContainer.innerHTML = '<div class="text-center">Iniciando bot...</div>';
            qrStatus.innerText = 'Inicializando...';
            qrModal.show();

            const response = await fetch('/api/bots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome: botName,
                    numero: botNumber,
                    descricao: botDescription
                })
            });

            const data = await response.json();
            if (data.success) {
                addLog(`Bot ${botName} criado, aguardando conexão...`, 'warning');
                
                // Iniciar monitoramento do status
                const statusCheckInterval = setInterval(async () => {
                    const statusResponse = await fetch(`/api/bots/${botNumber}/status`);
                    const statusData = await statusResponse.json();
                    
                    if (statusData.success) {
                        qrStatus.innerText = getStatusMessage(statusData.status);
                        
                        if (statusData.status === 'qr_ready') {
                            // Buscar e exibir QR Code
                            const qrResponse = await fetch(`/api/bots/${botNumber}/qr`);
                            const qrData = await qrResponse.json();
                            if (qrData.success && qrData.qrCode) {
                                qrContainer.innerHTML = `<img src="${qrData.qrCode}" class="img-fluid" alt="QR Code">`;
                            }
                        } else if (statusData.status === 'connected') {
                            clearInterval(statusCheckInterval);
                            qrModal.hide();
                            addLog(`Bot ${botName} conectado com sucesso!`, 'success');
                            loadBots();
                            // Limpar formulário
                            document.getElementById('botName').value = '';
                            document.getElementById('botNumber').value = '';
                            document.getElementById('botDescription').value = '';
                            addBotModal.hide();
                        } else if (statusData.status === 'auth_failed') {
                            clearInterval(statusCheckInterval);
                            addLog(`Falha na autenticação do bot ${botName}`, 'error');
                            qrModal.hide();
                        }
                    }
                }, 2000);
            } else {
                addLog('Erro ao adicionar bot: ' + data.error, 'error');
                qrModal.hide();
            }
        } catch (error) {
            addLog('Erro ao adicionar bot: ' + error.message, 'error');
            qrModal.hide();
        }
    });

    function getStatusMessage(status) {
        const messages = {
            'initializing': 'Inicializando bot...',
            'qr_ready': 'Escaneie o QR Code com seu WhatsApp',
            'authenticated': 'Autenticado, conectando...',
            'connected': 'Conectado!',
            'auth_failed': 'Falha na autenticação',
            'disconnected': 'Desconectado'
        };
        return messages[status] || status;
    }

    // Funções globais
    window.deleteNumber = async (phone) => {
        if (!confirm('Tem certeza que deseja remover este número?')) return;

        try {
            const response = await fetch(`/api/numbers/${phone}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                addLog(`Número ${phone} removido com sucesso`, 'success');
                loadNumbers();
            } else {
                addLog('Erro ao remover número: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao remover número: ' + error.message, 'error');
        }
    };

    window.toggleNumber = async (phone) => {
        try {
            const response = await fetch(`/api/numbers/${phone}/toggle`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                addLog(`Status do número ${phone} alterado com sucesso`, 'success');
                loadNumbers();
            } else {
                addLog('Erro ao alterar status: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao alterar status: ' + error.message, 'error');
        }
    };

    window.deleteBot = async (id) => {
        if (!confirm('Tem certeza que deseja remover este bot?')) return;

        try {
            const response = await fetch(`/api/bots/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                addLog(`Bot removido com sucesso`, 'success');
                loadBots();
            } else {
                addLog('Erro ao remover bot: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao remover bot: ' + error.message, 'error');
        }
    };

    window.toggleBot = async (id) => {
        try {
            const response = await fetch(`/api/bots/${id}/toggle`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                addLog(`Status do bot alterado com sucesso`, 'success');
                loadBots();
            } else {
                addLog('Erro ao alterar status: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao alterar status: ' + error.message, 'error');
        }
    };

    // Funções de carregamento
    async function loadNumbers() {
        try {
            const response = await fetch('/api/numbers');
            const data = await response.json();
            if (data.success) {
                updateNumbersList(data.numbers);
            } else {
                addLog('Erro ao carregar números: ' + data.error, 'error');
            }
        } catch (error) {
            addLog('Erro ao carregar números: ' + error.message, 'error');
        }
    }

    async function checkBotStatus() {
        try {
            const response = await fetch('/api/bot/status');
            const data = await response.json();
            if (data.success) {
                updateBotStatus(data.status, data.details);
            } else {
                updateBotStatus('disconnected');
                addLog('Erro ao verificar status do bot', 'error');
            }
        } catch (error) {
            updateBotStatus('disconnected');
            addLog('Erro ao verificar status do bot: ' + error.message, 'error');
        }
    }

    // Carregar planos nos selects
    async function loadPlans() {
        try {
            const response = await fetch('/api/plans');
            const data = await response.json();
            if (data.success) {
                const plans = data.plans;
                const userPlanSelect = document.getElementById('userPlan');
                const editPlanSelect = document.getElementById('editPlan');
                
                // Limpar opções existentes
                userPlanSelect.innerHTML = '<option value="">Selecione um plano</option>';
                editPlanSelect.innerHTML = '<option value="">Selecione um plano</option>';
                
                // Adicionar planos aos selects
                plans.forEach(plan => {
                    const option = `<option value="${plan.id}">${plan.nome} - R$ ${plan.valor.toFixed(2)}</option>`;
                    userPlanSelect.insertAdjacentHTML('beforeend', option);
                    editPlanSelect.insertAdjacentHTML('beforeend', option);
                });
            }
        } catch (error) {
            addLog('Erro ao carregar planos: ' + error.message, 'error');
        }
    }

    function getStatusClass(number) {
        if (!number.ativo) return 'status-inactive';
        switch (number.status_assinatura) {
            case 'ativo': return 'status-active';
            case 'vencido': return 'status-warning';
            case 'cancelado': return 'status-danger';
            default: return 'status-inactive';
        }
    }

    function getStatusText(number) {
        if (!number.ativo) return 'Inativo';
        switch (number.status_assinatura) {
            case 'ativo': return 'Ativo';
            case 'vencido': return 'Vencido';
            case 'cancelado': return 'Cancelado';
            default: return 'Sem Assinatura';
        }
    }

    // Função para editar assinatura
    async function editSubscription(phone) {
        try {
            const response = await fetch(`/api/numbers/${phone}`);
            const data = await response.json();
            if (data.success) {
                const number = data.number;
                document.getElementById('editPhone').value = phone;
                document.getElementById('editPlan').value = number.plano_id || '';
                document.getElementById('editExpiration').value = number.proximo_vencimento?.split('T')[0] || '';
                document.getElementById('editStatus').value = number.status_assinatura || 'inativo';
                
                const editModal = new bootstrap.Modal(document.getElementById('editSubscriptionModal'));
                editModal.show();
            }
        } catch (error) {
            addLog('Erro ao carregar dados da assinatura: ' + error.message, 'error');
        }
    }

    // Inicialização
    loadBots();
    loadNumbers();
    checkBotStatus();
    setInterval(checkBotStatus, 30000); // Verificar status a cada 30 segundos
}); 