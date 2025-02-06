const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Função para inicializar o banco de dados
async function initDatabase(db) {
    console.log('Inicializando banco de dados...');
    
    // Criar tabelas
    const tables = [
        // Tabela de usuários
        `CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )`,

        // Tabela de clientes
        `CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT UNIQUE NOT NULL,
            plano TEXT DEFAULT 'free',
            status_assinatura TEXT DEFAULT 'inativo',
            ultimo_pagamento DATE,
            proximo_vencimento DATE,
            valor_assinatura REAL DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de números permitidos
        `CREATE TABLE IF NOT EXISTS numeros_permitidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telefone TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de bots
        `CREATE TABLE IF NOT EXISTS bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            numero TEXT UNIQUE NOT NULL,
            descricao TEXT,
            ativo INTEGER DEFAULT 1,
            status TEXT DEFAULT 'desconectado',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de planos
        `CREATE TABLE IF NOT EXISTS planos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            valor REAL NOT NULL,
            duracao_dias INTEGER NOT NULL,
            recursos TEXT,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de pagamentos
        `CREATE TABLE IF NOT EXISTS pagamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            plano_id INTEGER,
            valor REAL NOT NULL,
            data_pagamento DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pendente',
            metodo_pagamento TEXT,
            comprovante_url TEXT,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (plano_id) REFERENCES planos(id)
        )`
    ];

    // Criar tabelas em sequência
    for (const sql of tables) {
        await new Promise((resolve, reject) => {
            db.run(sql, (err) => {
                if (err) {
                    console.error('Erro ao criar tabela:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Inserir planos padrão
    const plansInsert = `INSERT INTO planos (nome, descricao, valor, duracao_dias, recursos) 
        SELECT 'Mensal', 'Acesso completo por 30 dias', 29.90, 30, 'Acesso a todas as funcionalidades'
        WHERE NOT EXISTS (SELECT 1 FROM planos WHERE nome = 'Mensal')
        UNION ALL
        SELECT 'Trimestral', 'Acesso completo por 90 dias', 79.90, 90, 'Acesso a todas as funcionalidades + Desconto de 11%'
        WHERE NOT EXISTS (SELECT 1 FROM planos WHERE nome = 'Trimestral')
        UNION ALL
        SELECT 'Anual', 'Acesso completo por 365 dias', 299.90, 365, 'Acesso a todas as funcionalidades + Desconto de 16%'
        WHERE NOT EXISTS (SELECT 1 FROM planos WHERE nome = 'Anual')`;

    await new Promise((resolve, reject) => {
        db.run(plansInsert, (err) => {
            if (err) {
                console.error('Erro ao inserir planos:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });

    console.log('Banco de dados inicializado com sucesso!');
}

// Criar e inicializar o banco de dados
const db = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'), async (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
        try {
            await initDatabase(db);
            db.initialized = true;
        } catch (error) {
            console.error('Erro ao inicializar banco de dados:', error);
        }
    }
});

// Função para verificar se o banco de dados está inicializado
db.waitForInit = async () => {
    return new Promise((resolve) => {
        const check = () => {
            if (db.initialized) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
};

module.exports = db; 