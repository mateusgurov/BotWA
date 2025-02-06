require('dotenv').config();
const express = require('express');
const cors = require('cors');
const whatsappBot = require('./services/whatsappBot');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.get('/', (req, res) => {
    res.json({ message: 'API do BotWA está funcionando!' });
});

// Importar rotas
const clientesRoutes = require('./routes/clientes');
const viagensRoutes = require('./routes/viagens');
const abastecimentosRoutes = require('./routes/abastecimentos');

// Usar rotas
app.use('/api/clientes', clientesRoutes);
app.use('/api/viagens', viagensRoutes);
app.use('/api/abastecimentos', abastecimentosRoutes);

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log('📱 Iniciando bot do WhatsApp...');
}); 