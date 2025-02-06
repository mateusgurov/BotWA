-- Criar banco de dados se não existir
CREATE DATABASE IF NOT EXISTS botwa;

-- Usar o banco de dados
USE botwa;

-- Criar usuário para a aplicação se não existir
CREATE USER IF NOT EXISTS 'botwa_user'@'localhost' IDENTIFIED BY 'botwa_password';

-- Garantir privilégios para o usuário
GRANT ALL PRIVILEGES ON botwa.* TO 'botwa_user'@'localhost';
FLUSH PRIVILEGES;

-- Criar as tabelas
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) UNIQUE NOT NULL,
    plano VARCHAR(50) DEFAULT 'free',
    data_vencimento DATE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT,
    distancia_km DECIMAL(10,2) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacao TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS abastecimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT,
    litros DECIMAL(10,2) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posto VARCHAR(100),
    tipo_combustivel VARCHAR(50),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserir um usuário administrador padrão
INSERT INTO usuarios (nome, email, senha, role) 
VALUES ('Admin', 'admin@botwa.com', '$2a$10$YourHashedPasswordHere', 'admin'); 