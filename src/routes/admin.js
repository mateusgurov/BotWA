const express = require('express');
const router = express.Router();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const handleMessage = require('../services/whatsappHandler');

// Mapa para armazenar instâncias de bots
global.whatsappInstances = new Map();

// Rota para obter status do bot
router.get('/bot/status', (req, res) => {
    try {
        // Verificar todas as instâncias de bots
        const botsStatus = Array.from(global.whatsappInstances.entries()).map(([numero, instance]) => {
            const client = instance.client;
            return {
                numero,
                hasClient: !!client,
                hasPage: !!client?.pupPage,
                hasBrowser: !!client?.pupBrowser,
                isReady: !!client?.info,
                status: instance.status
            };
        });

        const anyConnected = botsStatus.some(bot => bot.isReady);
        
        res.json({ 
            success: true, 
            status: anyConnected ? 'connected' : 'disconnected',
            details: {
                bots: botsStatus
            }
        });
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Rota para reconectar o bot
router.post('/bot/reconnect', async (req, res) => {
    try {
        if (global.whatsappClient) {
            // Tentar fechar a sessão atual se existir
            try {
                if (global.whatsappClient.pupBrowser) {
                    await global.whatsappClient.pupBrowser.close();
                }
            } catch (e) {
                console.error('Erro ao fechar browser:', e);
            }

            // Reinicializar o cliente
            await global.whatsappClient.initialize();
            res.json({ success: true });
        } else {
            res.json({ 
                success: false, 
                error: 'Cliente WhatsApp não encontrado' 
            });
        }
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Rota para listar planos
router.get('/plans', (req, res) => {
    db.all('SELECT * FROM planos WHERE ativo = 1 ORDER BY valor ASC', [], (err, rows) => {
        if (err) {
            return res.json({ 
                success: false, 
                error: err.message 
            });
        }
        res.json({ 
            success: true, 
            plans: rows 
        });
    });
});

// Rota para listar números permitidos (atualizada)
router.get('/numbers', (req, res) => {
    db.all(`
        SELECT np.*, c.plano, c.status_assinatura, c.proximo_vencimento, c.valor_assinatura, p.id as plano_id
        FROM numeros_permitidos np
        LEFT JOIN clientes c ON np.telefone = c.telefone
        LEFT JOIN planos p ON c.plano = p.nome
        ORDER BY np.created_at DESC
    `, [], (err, rows) => {
        if (err) {
            return res.json({ 
                success: false, 
                error: err.message 
            });
        }
        res.json({ 
            success: true, 
            numbers: rows
        });
    });
});

// Rota para obter detalhes de um número específico
router.get('/numbers/:phone', (req, res) => {
    const { phone } = req.params;
    db.get(`
        SELECT np.*, c.plano, c.status_assinatura, c.proximo_vencimento, c.valor_assinatura, p.id as plano_id
        FROM numeros_permitidos np
        LEFT JOIN clientes c ON np.telefone = c.telefone
        LEFT JOIN planos p ON c.plano = p.nome
        WHERE np.telefone = ?
    `, [phone], (err, row) => {
        if (err) {
            return res.json({ 
                success: false, 
                error: err.message 
            });
        }
        res.json({ 
            success: true, 
            number: row 
        });
    });
});

// Rota para adicionar novo número (atualizada)
router.post('/numbers', async (req, res) => {
    const { phone, name, planId, expiration } = req.body;
    if (!phone || !name || !planId || !expiration) {
        return res.json({ 
            success: false, 
            error: 'Todos os campos são obrigatórios' 
        });
    }

    try {
        // Verificar se o número já existe
        const existingNumber = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM numeros_permitidos WHERE telefone = ?',
                [phone],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existingNumber) {
            return res.json({
                success: false,
                error: 'Este número já está cadastrado'
            });
        }

        // Iniciar transação
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Inserir número permitido
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO numeros_permitidos (telefone, nome) VALUES (?, ?)',
                [phone, name],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Buscar informações do plano
        const plano = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM planos WHERE id = ?', [planId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!plano) {
            throw new Error('Plano não encontrado');
        }

        // Inserir cliente com assinatura
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO clientes (nome, telefone, plano, status_assinatura, proximo_vencimento, valor_assinatura) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [name, phone, plano.nome, 'ativo', expiration, plano.valor],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Registrar pagamento
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO pagamentos (cliente_id, plano_id, valor, status, metodo_pagamento) 
                 VALUES ((SELECT id FROM clientes WHERE telefone = ?), ?, ?, 'aprovado', 'admin')`,
                [phone, planId, plano.valor],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Confirmar transação
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        // Reverter transação em caso de erro
        db.run('ROLLBACK');
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Rota para atualizar assinatura
router.put('/numbers/:phone/subscription', async (req, res) => {
    const { phone } = req.params;
    const { planId, expiration, status } = req.body;

    try {
        // Iniciar transação
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Buscar informações do plano
        const plano = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM planos WHERE id = ?', [planId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!plano) {
            throw new Error('Plano não encontrado');
        }

        // Atualizar cliente
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE clientes 
                 SET plano = ?, 
                     status_assinatura = ?, 
                     proximo_vencimento = ?,
                     valor_assinatura = ?,
                     ultimo_pagamento = CURRENT_TIMESTAMP
                 WHERE telefone = ?`,
                [plano.nome, status, expiration, plano.valor, phone],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Registrar novo pagamento se status for ativo
        if (status === 'ativo') {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO pagamentos (cliente_id, plano_id, valor, status, metodo_pagamento) 
                     VALUES ((SELECT id FROM clientes WHERE telefone = ?), ?, ?, 'aprovado', 'admin')`,
                    [phone, planId, plano.valor],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        // Confirmar transação
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        // Reverter transação em caso de erro
        db.run('ROLLBACK');
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Rota para remover número
router.delete('/numbers/:phone', (req, res) => {
    const { phone } = req.params;
    db.run(
        'DELETE FROM numeros_permitidos WHERE telefone = ?',
        [phone],
        (err) => {
            if (err) {
                return res.json({ 
                    success: false, 
                    error: err.message 
                });
            }
            res.json({ success: true });
        }
    );
});

// Rota para alternar status do número
router.post('/numbers/:phone/toggle', (req, res) => {
    const { phone } = req.params;
    db.run(
        'UPDATE numeros_permitidos SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE telefone = ?',
        [phone],
        (err) => {
            if (err) {
                return res.json({ 
                    success: false, 
                    error: err.message 
                });
            }
            res.json({ success: true });
        }
    );
});

// Rotas para gerenciar bots
router.get('/bots', (req, res) => {
    db.all('SELECT * FROM bots ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            return res.json({ 
                success: false, 
                error: err.message 
            });
        }
        res.json({ 
            success: true, 
            bots: rows
        });
    });
});

// Rota para criar novo bot
router.post('/bots', async (req, res) => {
    const { nome, numero, descricao } = req.body;
    if (!nome || !numero) {
        return res.json({ 
            success: false, 
            error: 'Nome e número são obrigatórios' 
        });
    }

    try {
        // Primeiro inserir no banco de dados
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO bots (nome, numero, descricao, status, ativo) VALUES (?, ?, ?, ?, ?)',
                [nome, numero, descricao, 'initializing', 1],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Criar nova instância do cliente WhatsApp
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `bot-${numero}`,
                dataPath: "./.wwebjs_auth"
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            }
        });

        // Configurar eventos básicos
        client.on('qr', async (qr) => {
            try {
                const qrCodeData = await qrcode.toDataURL(qr);
                const instance = global.whatsappInstances.get(numero);
                if (instance) {
                    instance.qrCode = qrCodeData;
                    instance.status = 'qr_ready';
                    global.whatsappInstances.set(numero, instance);
                }
                await db.run('UPDATE bots SET status = ? WHERE numero = ?', ['qr_ready', numero]);
            } catch (error) {
                console.error('Erro ao gerar QR code:', error);
            }
        });

        client.on('ready', async () => {
            try {
                const instance = global.whatsappInstances.get(numero);
                if (instance) {
                    instance.status = 'connected';
                    instance.isReady = true;
                    global.whatsappInstances.set(numero, instance);
                }
                await db.run('UPDATE bots SET status = ? WHERE numero = ?', ['connected', numero]);
            } catch (error) {
                console.error('Erro ao atualizar status:', error);
            }
        });

        client.on('message', async (message) => {
            try {
                const instance = global.whatsappInstances.get(numero);
                if (instance?.isReady) {
                    await handleMessage(client, message);
                }
            } catch (error) {
                console.error('Erro ao processar mensagem:', error);
            }
        });

        // Armazenar instância antes de inicializar
        global.whatsappInstances.set(numero, {
            client,
            status: 'initializing',
            isReady: false
        });

        // Inicializar cliente em background
        client.initialize().catch(error => {
            console.error('Erro ao inicializar cliente:', error);
        });

        // Responder imediatamente
        res.json({ 
            success: true, 
            id: result,
            status: 'initializing'
        });

    } catch (error) {
        console.error('Erro ao criar bot:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.delete('/bots/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Primeiro, buscar informações do bot
        const bot = await new Promise((resolve, reject) => {
            db.get('SELECT numero FROM bots WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!bot) {
            return res.json({ 
                success: false, 
                error: 'Bot não encontrado' 
            });
        }

        // Desconectar o cliente se existir
        const instance = global.whatsappInstances.get(bot.numero);
        if (instance && instance.client) {
            try {
                if (instance.client.pupBrowser) {
                    await instance.client.pupBrowser.close();
                }
                await instance.client.destroy();
            } catch (error) {
                console.error('Erro ao desconectar cliente:', error);
            }
        }

        // Remover do mapa global
        global.whatsappInstances.delete(bot.numero);

        // Remover arquivos de sessão
        try {
            // Remover pasta .wwebjs_auth
            const authPath = path.join(process.cwd(), '.wwebjs_auth');
            if (fs.existsSync(authPath)) {
                console.log('Removendo pasta .wwebjs_auth...');
                fs.rmSync(authPath, { recursive: true, force: true });
            }

            // Remover pasta .wwebjs_cache
            const cachePath = path.join(process.cwd(), '.wwebjs_cache');
            if (fs.existsSync(cachePath)) {
                console.log('Removendo pasta .wwebjs_cache...');
                fs.rmSync(cachePath, { recursive: true, force: true });
            }

            console.log('Pastas de cache e autenticação removidas com sucesso');
        } catch (error) {
            console.error('Erro ao remover pastas de cache e autenticação:', error);
        }

        // Remover do banco de dados
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM bots WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir bot:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.post('/bots/:id/toggle', async (req, res) => {
    const { id } = req.params;
    try {
        // Primeiro, buscar informações do bot
        const bot = await new Promise((resolve, reject) => {
            db.get('SELECT numero, ativo FROM bots WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!bot) {
            return res.json({ 
                success: false, 
                error: 'Bot não encontrado' 
            });
        }

        const novoStatus = bot.ativo === 1 ? 0 : 1;

        // Se estiver desativando
        if (novoStatus === 0) {
            const instance = global.whatsappInstances.get(bot.numero);
            if (instance && instance.client) {
                try {
                    if (instance.client.pupBrowser) {
                        await instance.client.pupBrowser.close();
                    }
                    await instance.client.destroy();
                } catch (error) {
                    console.error('Erro ao desconectar cliente:', error);
                }
            }
            global.whatsappInstances.delete(bot.numero);
        }
        // Se estiver ativando
        else if (novoStatus === 1) {
            // Inicializar novo cliente
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `bot-${bot.numero}`,
                    dataPath: "./.wwebjs_auth"
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu'
                    ]
                }
            });

            // Configurar eventos do cliente
            configureClientEvents(client, bot.numero);

            // Inicializar cliente
            await client.initialize();

            // Armazenar instância
            global.whatsappInstances.set(bot.numero, {
                client,
                status: 'initializing',
                isReady: false
            });
        }

        // Atualizar no banco de dados
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE bots SET ativo = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [novoStatus, novoStatus === 1 ? 'initializing' : 'disconnected', id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao alternar status do bot:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Função auxiliar para configurar eventos do cliente
function configureClientEvents(client, numero) {
    client.on('qr', async (qr) => {
        try {
            const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-bot-${numero}`);
            const hasExistingSession = fs.existsSync(sessionPath);

            if (!hasExistingSession) {
                console.log(`Gerando QR Code para bot ${numero}...`);
                const qrCodeData = await qrcode.toDataURL(qr);
                const instance = global.whatsappInstances.get(numero);
                if (instance) {
                    instance.qrCode = qrCodeData;
                    instance.status = 'qr_ready';
                    global.whatsappInstances.set(numero, instance);
                }
                db.run('UPDATE bots SET status = ? WHERE numero = ?', ['qr_ready', numero]);
            }
        } catch (error) {
            console.error('Erro ao gerar QR code:', error);
        }
    });

    client.on('ready', async () => {
        console.log(`Bot ${numero} está pronto!`);
        try {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE bots SET status = ? WHERE numero = ?',
                    ['connected', numero],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const instance = global.whatsappInstances.get(numero);
            if (instance) {
                instance.status = 'connected';
                instance.isReady = true;
                global.whatsappInstances.set(numero, instance);
            }
        } catch (error) {
            console.error(`Erro ao atualizar status do bot ${numero}:`, error);
        }
    });

    client.on('message', async (message) => {
        try {
            const instance = global.whatsappInstances.get(numero);
            if (instance && instance.isReady) {
                await handleMessage(client, message);
            }
        } catch (error) {
            console.error(`Erro ao processar mensagem no bot ${numero}:`, error);
        }
    });

    client.on('disconnected', async (reason) => {
        console.log(`Bot ${numero} desconectado. Motivo: ${reason}`);
        try {
            db.run('UPDATE bots SET status = ? WHERE numero = ?', ['disconnected', numero]);
            const instance = global.whatsappInstances.get(numero);
            if (instance) {
                instance.status = 'disconnected';
                instance.isReady = false;
                global.whatsappInstances.set(numero, instance);
            }
        } catch (error) {
            console.error(`Erro ao atualizar status do bot ${numero}:`, error);
        }
    });
}

router.post('/bots/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.run(
        'UPDATE bots SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        (err) => {
            if (err) {
                return res.json({ 
                    success: false, 
                    error: err.message 
                });
            }
            res.json({ success: true });
        }
    );
});

// Rota para obter QR Code do bot
router.get('/bots/:numero/qr', (req, res) => {
    const { numero } = req.params;
    const instance = global.whatsappInstances.get(numero);
    
    if (instance?.qrCode) {
        res.json({
            success: true,
            qrCode: instance.qrCode
        });
    } else {
        res.json({
            success: false,
            error: 'QR Code ainda não disponível'
        });
    }
});

// Rota para obter status atual do bot
router.get('/bots/:numero/status', (req, res) => {
    const { numero } = req.params;
    const instance = global.whatsappInstances.get(numero);
    
    if (instance) {
        res.json({
            success: true,
            status: instance.status || 'unknown'
        });
    } else {
        res.json({
            success: true,
            status: 'initializing'
        });
    }
});

module.exports = router; 