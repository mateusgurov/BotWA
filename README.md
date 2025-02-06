# BotWA - Sistema de Gerenciamento de Viagens via WhatsApp

Sistema para gerenciamento de viagens e abastecimentos via WhatsApp, com painel administrativo web.

## 🚀 Funcionalidades

### Bot WhatsApp
- Registro de viagens (KM e valor)
- Registro de abastecimentos (litros e valor)
- Cálculo automático de custo por KM
- Consulta de status da assinatura

### Painel Administrativo
- Gerenciamento de clientes
- Controle de assinaturas
- Visualização de métricas e relatórios
- Histórico completo de viagens e abastecimentos

## 🛠️ Tecnologias

- Node.js
- Express
- MySQL
- React.js
- Material-UI
- whatsapp-web.js

## 📋 Pré-requisitos

- Node.js 14+
- MySQL 5.7+ ou MariaDB 10.4+
- NPM ou Yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://seu-repositorio/botwa.git
cd botwa
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Crie o banco de dados:
```bash
mysql -u root -p
CREATE DATABASE botwa;
USE botwa;
source src/database/init.sql;
```

5. Inicie o servidor:
```bash
npm run dev
```

## 🚀 Uso

### Bot WhatsApp

1. Inicie o servidor
2. Escaneie o QR Code que aparecerá no terminal
3. Envie "menu" para o número do bot para ver os comandos disponíveis

### Painel Administrativo

1. Acesse `http://localhost:3000`
2. Faça login com suas credenciais de administrador
3. Gerencie clientes, viagens e abastecimentos

## 📦 Estrutura do Projeto

```
botwa/
├── src/
│   ├── config/         # Configurações
│   ├── controllers/    # Controladores
│   ├── database/       # Migrations e seeds
│   ├── models/        # Modelos
│   ├── routes/        # Rotas da API
│   └── services/      # Serviços (Bot WhatsApp)
├── .env               # Variáveis de ambiente
└── package.json
```

## 🔐 Variáveis de Ambiente

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=botwa
JWT_SECRET=seu_jwt_secret
PORT=3000
```

## 📝 Endpoints da API

### Clientes
- `GET /api/clientes` - Lista todos os clientes
- `GET /api/clientes/:id` - Obtém um cliente específico
- `POST /api/clientes` - Cria um novo cliente
- `PUT /api/clientes/:id` - Atualiza um cliente
- `DELETE /api/clientes/:id` - Remove um cliente

### Viagens
- `GET /api/viagens` - Lista todas as viagens
- `POST /api/viagens` - Registra uma nova viagem
- `GET /api/viagens/estatisticas/geral` - Obtém estatísticas gerais

### Abastecimentos
- `GET /api/abastecimentos` - Lista todos os abastecimentos
- `POST /api/abastecimentos` - Registra um novo abastecimento
- `GET /api/abastecimentos/estatisticas/geral` - Obtém estatísticas gerais

## 👥 Contribuição

1. Faça o fork do projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Em caso de dúvidas ou problemas, abra uma issue no repositório ou entre em contato com a equipe de suporte. 