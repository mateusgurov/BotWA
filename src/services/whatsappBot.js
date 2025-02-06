const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../config/database');

class WhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                args: ['--no-sandbox']
            }
        });

        this.initializeClient();
    }

    initializeClient() {
        this.client.on('qr', (qr) => {
            qrcode.generate(qr, { small: true });
            console.log('QR Code gerado! Escaneie para conectar.');
        });

        this.client.on('ready', () => {
            console.log('Cliente WhatsApp conectado!');
        });

        this.client.on('message', this.handleMessage.bind(this));
        
        this.client.initialize();
    }

    async handleMessage(msg) {
        try {
            const telefone = msg.from.replace('@c.us', '');
            const texto = msg.body.trim().toLowerCase();

            // Verifica se é cliente válido
            const clienteResult = await db.query(
                'SELECT * FROM clientes WHERE telefone = $1 AND ativo = true',
                [telefone]
            );

            if (!clienteResult.rows[0]) {
                return msg.reply('❌ Você não está cadastrado ou sua conta está inativa. Entre em contato com o suporte.');
            }

            const cliente = clienteResult.rows[0];

            // Menu principal
            if (texto === 'menu' || texto === '0') {
                return this.enviarMenu(msg);
            }

            // Registrar Viagem
            if (texto === '1') {
                return msg.reply('📝 Para registrar uma viagem, envie no formato:\n*KM VALOR*\nExemplo: 150 85.90');
            }

            // Registrar Abastecimento
            if (texto === '2') {
                return msg.reply('⛽ Para registrar um abastecimento, envie no formato:\n*LITROS VALOR*\nExemplo: 45.5 250.90');
            }

            // Calcular Custo por KM
            if (texto === '3') {
                return this.calcularCustoPorKm(msg, cliente.id);
            }

            // Ver Status da Assinatura
            if (texto === '4') {
                return this.enviarStatusAssinatura(msg, cliente);
            }

            // Processar registro de viagem
            if (/^\d+(\.\d+)?\s+\d+(\.\d+)?$/.test(texto)) {
                const [valor1, valor2] = texto.split(' ').map(Number);
                
                if (msg.lastCommand === '1') {
                    return this.registrarViagem(msg, cliente.id, valor1, valor2);
                } else if (msg.lastCommand === '2') {
                    return this.registrarAbastecimento(msg, cliente.id, valor1, valor2);
                }
            }

        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            msg.reply('❌ Ocorreu um erro ao processar sua solicitação. Tente novamente.');
        }
    }

    async enviarMenu(msg) {
        const menu = `🚗 *Menu Principal* 🚗\n\n` +
                    `1️⃣ Registrar Viagem\n` +
                    `2️⃣ Adicionar Abastecimento\n` +
                    `3️⃣ Calcular Custo por KM\n` +
                    `4️⃣ Ver Status da Assinatura\n\n` +
                    `Digite o número da opção desejada:`;
        
        return msg.reply(menu);
    }

    async registrarViagem(msg, clienteId, km, valor) {
        try {
            await db.query(
                'INSERT INTO viagens (cliente_id, distancia_km, valor) VALUES ($1, $2, $3)',
                [clienteId, km, valor]
            );

            return msg.reply(`✅ Viagem registrada com sucesso!\n📊 ${km}km por R$${valor.toFixed(2)}`);
        } catch (error) {
            console.error('Erro ao registrar viagem:', error);
            return msg.reply('❌ Erro ao registrar viagem. Tente novamente.');
        }
    }

    async registrarAbastecimento(msg, clienteId, litros, valor) {
        try {
            await db.query(
                'INSERT INTO abastecimentos (cliente_id, litros, valor) VALUES ($1, $2, $3)',
                [clienteId, litros, valor]
            );

            return msg.reply(`✅ Abastecimento registrado com sucesso!\n⛽ ${litros}L por R$${valor.toFixed(2)}`);
        } catch (error) {
            console.error('Erro ao registrar abastecimento:', error);
            return msg.reply('❌ Erro ao registrar abastecimento. Tente novamente.');
        }
    }

    async calcularCustoPorKm(msg, clienteId) {
        try {
            const result = await db.query(`
                SELECT 
                    SUM(distancia_km) as total_km,
                    SUM(valor) as total_valor
                FROM viagens 
                WHERE cliente_id = $1 
                AND data >= NOW() - INTERVAL '30 days'
            `, [clienteId]);

            const { total_km, total_valor } = result.rows[0];

            if (!total_km || !total_valor) {
                return msg.reply('📊 Não há dados suficientes para calcular o custo por KM nos últimos 30 dias.');
            }

            const custoPorKm = total_valor / total_km;

            return msg.reply(
                `📊 *Análise dos últimos 30 dias:*\n\n` +
                `🛣️ Total KM: ${total_km.toFixed(2)}km\n` +
                `💰 Total Gasto: R$${total_valor.toFixed(2)}\n` +
                `📈 Custo por KM: R$${custoPorKm.toFixed(2)}/km`
            );

        } catch (error) {
            console.error('Erro ao calcular custo por km:', error);
            return msg.reply('❌ Erro ao calcular custos. Tente novamente.');
        }
    }

    async enviarStatusAssinatura(msg, cliente) {
        const dataVencimento = new Date(cliente.data_vencimento);
        const hoje = new Date();
        const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

        return msg.reply(
            `📱 *Status da Assinatura*\n\n` +
            `🔹 Plano: ${cliente.plano}\n` +
            `📅 Vencimento: ${dataVencimento.toLocaleDateString()}\n` +
            `⏳ Dias restantes: ${diasRestantes}\n\n` +
            `Status: ${diasRestantes > 0 ? '✅ Ativo' : '❌ Vencido'}`
        );
    }
}

module.exports = new WhatsAppBot(); 