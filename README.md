# BotWA - Sistema de Gerenciamento de Viagens via WhatsApp

Sistema para gerenciamento de viagens e abastecimentos através do WhatsApp.

## 📋 Requisitos do Sistema

- Ubuntu 20.04 LTS
- Node.js 18.x ou superior
- NPM
- SQLite3
- Git
- Chrome/Chromium (para o WhatsApp Web)

## 🚀 Instalação em VPS Ubuntu 20.04

### 1. Atualizando o Sistema
```bash
# Atualizar lista de pacotes
sudo apt update

# Atualizar pacotes do sistema
sudo apt upgrade -y

# Instalar dependências essenciais
sudo apt install -y curl git build-essential
```

### 2. Instalando Node.js 18.x
```bash
# Adicionar repositório do Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version
```

### 3. Instalando SQLite3
```bash
sudo apt install -y sqlite3
```

### 4. Instalando Chrome/Chromium e Dependências
```bash
# Instalar Chromium e dependências necessárias
sudo apt install -y chromium-browser \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
```

### 5. Clonando e Configurando o Projeto
```bash
# Criar diretório para o projeto
mkdir -p /var/www
cd /var/www

# Clonar o repositório
git clone https://github.com/seu-usuario/botwa.git
cd botwa

# Instalar dependências
npm install

# Dar permissões necessárias
sudo chown -R $USER:$USER /var/www/botwa
sudo chmod -R 755 /var/www/botwa
```

### 6. Configurando o Ambiente
```bash
# Criar arquivo .env
nano .env
```

Conteúdo do `.env`:
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=sua_chave_secreta_aqui
```

### 7. Configurando PM2 (Gerenciador de Processos)
```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar aplicação com PM2
pm2 start src/index.js --name botwa

# Configurar para iniciar com o sistema
pm2 startup
pm2 save
```

### 8. Configurando Nginx como Proxy Reverso
```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuração do site
sudo nano /etc/nginx/sites-available/botwa
```

Conteúdo da configuração:
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/botwa /etc/nginx/sites-enabled/

# Testar configuração do Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 9. Configurando Firewall (UFW)
```bash
# Instalar UFW se não estiver instalado
sudo apt install -y ufw

# Configurar regras básicas
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Ativar firewall
sudo ufw enable
```

### 10. Configurando SSL com Certbot (Opcional)
```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d seu-dominio.com

# Configurar renovação automática
sudo certbot renew --dry-run
```

### 11. Criando Usuário Administrador
```bash
# Fazer requisição para criar usuário admin
curl -X POST -H "Content-Type: application/json" \
     -d '{"nome":"Admin","email":"admin@exemplo.com","password":"sua_senha"}' \
     http://localhost:3001/api/auth/criar-admin
```

## 📱 Comandos do WhatsApp

Após iniciar o bot, você verá um QR Code no terminal. Escaneie-o com seu WhatsApp para conectar o bot.

### Comandos Disponíveis:

1. **!ajuda**
   - Mostra todos os comandos disponíveis
   - Uso: `!ajuda`

2. **!viagem**
   - Registra uma nova viagem
   - Uso: `!viagem [distância] [valor] [observação]`
   - Exemplo: `!viagem 100 50 Viagem para São Paulo`

3. **!abastecimento**
   - Registra um novo abastecimento
   - Uso: `!abastecimento [litros] [valor] [posto]`
   - Exemplo: `!abastecimento 40 200 Posto Shell`

4. **!relatorio**
   - Mostra as últimas 5 viagens
   - Uso: `!relatorio`

## 🔧 Manutenção

### Comandos Úteis do PM2
```bash
# Ver logs
pm2 logs botwa

# Reiniciar aplicação
pm2 restart botwa

# Parar aplicação
pm2 stop botwa

# Ver status
pm2 status
```

### Backup do Banco de Dados
```bash
# Criar backup
cp /var/www/botwa/src/database/database.sqlite /backup/database.sqlite.$(date +%Y%m%d)

# Restaurar backup
cp /backup/database.sqlite.[data] /var/www/botwa/src/database/database.sqlite
```

## 🔒 Segurança

1. Mantenha o sistema atualizado:
```bash
sudo apt update && sudo apt upgrade -y
```

2. Monitore os logs:
```bash
# Logs do PM2
pm2 logs botwa

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

3. Configure backup automático:
```bash
# Criar script de backup
sudo nano /etc/cron.daily/backup-botwa

# Adicionar ao script
#!/bin/bash
cp /var/www/botwa/src/database/database.sqlite /backup/database.sqlite.$(date +%Y%m%d)
find /backup -name "database.sqlite.*" -mtime +7 -delete
```

```bash
# Dar permissão de execução
sudo chmod +x /etc/cron.daily/backup-botwa
```

## ❗ Solução de Problemas Comuns

1. **Erro: WhatsApp não conecta**
```bash
# Limpar cache do WhatsApp
cd /var/www/botwa
rm -rf .wwebjs_auth
rm -rf .wwebjs_cache
pm2 restart botwa
```

2. **Erro: Permissões**
```bash
# Corrigir permissões
sudo chown -R $USER:$USER /var/www/botwa
sudo chmod -R 755 /var/www/botwa
```

3. **Erro: Porta em uso**
```bash
# Verificar processo usando a porta
sudo lsof -i :3001
# Matar processo
sudo kill -9 [PID]
```

4. **Erro: Memória insuficiente**
```bash
# Adicionar swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do e-mail de suporte.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.