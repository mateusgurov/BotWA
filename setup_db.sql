-- Criar as tabelas
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    role TEXT DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT UNIQUE NOT NULL,
    plano TEXT DEFAULT 'free',
    data_vencimento DATE,
    status_assinatura TEXT DEFAULT 'inativo',
    ultimo_pagamento DATE,
    proximo_vencimento DATE,
    valor_assinatura REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS viagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    distancia_km REAL NOT NULL,
    valor REAL NOT NULL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacao TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS abastecimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    litros REAL NOT NULL,
    valor REAL NOT NULL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    posto TEXT,
    tipo_combustivel TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS numeros_permitidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    numero TEXT UNIQUE NOT NULL,
    descricao TEXT,
    ativo INTEGER DEFAULT 1,
    status TEXT DEFAULT 'desconectado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor REAL NOT NULL,
    duracao_dias INTEGER NOT NULL,
    recursos TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagamentos (
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
);

-- Inserir planos padrão
INSERT OR IGNORE INTO planos (nome, descricao, valor, duracao_dias, recursos) VALUES 
('Mensal', 'Acesso completo por 30 dias', 29.90, 30, 'Acesso a todas as funcionalidades'),
('Trimestral', 'Acesso completo por 90 dias', 79.90, 90, 'Acesso a todas as funcionalidades + Desconto de 11%'),
('Anual', 'Acesso completo por 365 dias', 299.90, 365, 'Acesso a todas as funcionalidades + Desconto de 16%');

-- Inserir um usuário administrador padrão
INSERT OR IGNORE INTO usuarios (nome, email, senha, role) 
VALUES ('Admin', 'admin@botwa.com', '$2a$10$YourHashedPasswordHere', 'admin'); 