require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const handleMessage = require('./services/whatsappHandler');
const adminRoutes = require('./routes/admin');
const db = require('./config/database');
const { router: authRoutes, verificarToken } = require('./routes/auth');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Mapa global para armazenar instâncias de bots
global.whatsappInstances = new Map();

// Função para inicializar um bot
async function initializeBot(botData) {
    try {
        console.log(`Inicializando bot ${botData.nome} (${botData.numero})...`);
        
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `bot-${botData.numero}`,
                dataPath: "./.wwebjs_auth"
            }),
            puppeteer: {
                headless: true,
                defaultViewport: null,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-extensions'
                ],
                timeout: 30000 // 30 segundos de timeout
            },
            qrMaxRetries: 2, // Reduzido para 2 tentativas
            authTimeoutMs: 30000, // 30 segundos de timeout
            restartOnAuthFail: true,
            takeoverOnConflict: true,
            takeoverTimeoutMs: 10000
        });

        // Adicionar log para acompanhar o progresso
        console.log(`Configurações iniciais do bot ${botData.nome} concluídas`);

        // Configurar eventos do bot
        client.on('qr', async (qr) => {
            try {
                console.log(`Gerando QR Code para ${botData.nome}...`);
                const qrCodeData = await qrcode.toDataURL(qr);
                global.whatsappInstances.set(botData.numero, {
                    ...global.whatsappInstances.get(botData.numero),
                    qrCode: qrCodeData
                });
                
                // Atualizar status no banco
                db.run('UPDATE bots SET status = ? WHERE numero = ?', ['qr_ready', botData.numero]);
                console.log(`QR Code gerado com sucesso para ${botData.nome}`);
            } catch (error) {
                console.error(`Erro ao gerar QR code para ${botData.nome}:`, error);
            }
        });

        client.on('ready', () => {
            console.log(`Bot ${botData.nome} está pronto!`);
            db.run('UPDATE bots SET status = ? WHERE numero = ?', ['connected', botData.numero]);
        });

        client.on('authenticated', () => {
            console.log(`Bot ${botData.nome} autenticado com sucesso!`);
            db.run('UPDATE bots SET status = ? WHERE numero = ?', ['authenticated', botData.numero]);
        });

        client.on('auth_failure', () => {
            console.log(`Falha na autenticação do bot ${botData.nome}`);
            db.run('UPDATE bots SET status = ? WHERE numero = ?', ['auth_failed', botData.numero]);
        });

        client.on('message', async (message) => {
            await handleMessage(client, message);
        });

        // Adicionar mais eventos para debug
        client.on('loading_screen', (percent, message) => {
            console.log(`Carregando ${botData.nome}: ${percent}% - ${message}`);
        });

        client.on('disconnected', (reason) => {
            console.log(`Bot ${botData.nome} desconectado:`, reason);
            db.run('UPDATE bots SET status = ? WHERE numero = ?', ['disconnected', botData.numero]);
        });

        // Inicializar cliente com timeout
        console.log(`Iniciando inicialização do bot ${botData.nome}...`);
        const initPromise = client.initialize();
        
        // Timeout de 60 segundos para inicialização
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout na inicialização')), 60000);
        });

        await Promise.race([initPromise, timeoutPromise]);
        console.log(`Bot ${botData.nome} inicializado com sucesso`);

        // Armazenar instância do cliente
        global.whatsappInstances.set(botData.numero, {
            ...global.whatsappInstances.get(botData.numero),
            client
        });

    } catch (error) {
        console.error(`Erro ao inicializar bot ${botData.nome}:`, error);
        db.run('UPDATE bots SET status = ? WHERE numero = ?', ['error', botData.numero]);
    }
}

// Função para carregar e inicializar bots ativos
async function loadActiveBots() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM bots WHERE ativo = 1', [], async (err, bots) => {
            if (err) {
                console.error('Erro ao carregar bots:', err);
                reject(err);
                return;
            }

            console.log(`Encontrados ${bots.length} bots ativos`);
            
            // Inicializar cada bot ativo
            for (const bot of bots) {
                await initializeBot(bot);
            }
            
            resolve(bots);
        });
    });
}

// Redirecionar para login se não estiver autenticado
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Rota para a página de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para a página admin (protegida)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/admin', verificarToken, adminRoutes);

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Função para iniciar o servidor
async function startServer() {
    try {
        // Aguardar a inicialização do banco de dados
        await db.waitForInit();

        // Iniciar o servidor
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, async () => {
            console.log('🚀 Servidor frontend iniciado na porta ' + PORT);
            
            try {
                // Carregar e inicializar bots ativos após o servidor estar rodando
                const bots = await loadActiveBots();
                if (bots.length > 0) {
                    console.log('✅ Bots ativos foram inicializados');
                } else {
                    console.log('ℹ️ Nenhum bot ativo encontrado. Frontend pronto para cadastro de bots.');
                }
            } catch (error) {
                console.error('❌ Erro ao carregar bots:', error);
            }
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Iniciar o servidor
startServer();