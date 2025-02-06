const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Listar todos os abastecimentos de um cliente
router.get('/', async (req, res) => {
    try {
        const { cliente_id } = req.query;
        let query = `
            SELECT 
                a.*,
                c.nome as cliente_nome
            FROM abastecimentos a
            JOIN clientes c ON c.id = a.cliente_id
        `;
        
        const params = [];
        if (cliente_id) {
            query += ' WHERE a.cliente_id = $1';
            params.push(cliente_id);
        }
        
        query += ' ORDER BY a.data DESC';
        
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter abastecimento por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(`
            SELECT 
                a.*,
                c.nome as cliente_nome
            FROM abastecimentos a
            JOIN clientes c ON c.id = a.cliente_id
            WHERE a.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Abastecimento não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar novo abastecimento
router.post('/', async (req, res) => {
    try {
        const { cliente_id, litros, valor, posto, tipo_combustivel } = req.body;
        
        const result = await db.query(
            'INSERT INTO abastecimentos (cliente_id, litros, valor, posto, tipo_combustivel) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [cliente_id, litros, valor, posto, tipo_combustivel]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar abastecimento
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { litros, valor, posto, tipo_combustivel } = req.body;
        
        const result = await db.query(
            `UPDATE abastecimentos 
             SET litros = $1, valor = $2, posto = $3, tipo_combustivel = $4
             WHERE id = $5 
             RETURNING *`,
            [litros, valor, posto, tipo_combustivel, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Abastecimento não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir abastecimento
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM abastecimentos WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Abastecimento não encontrado' });
        }
        
        res.json({ message: 'Abastecimento excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter estatísticas de abastecimentos
router.get('/estatisticas/geral', async (req, res) => {
    try {
        const { periodo } = req.query; // dias (30, 60, 90, etc)
        
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_abastecimentos,
                SUM(litros) as total_litros,
                SUM(valor) as total_valor,
                AVG(valor / litros) as media_preco_litro,
                MIN(valor / litros) as menor_preco_litro,
                MAX(valor / litros) as maior_preco_litro
            FROM abastecimentos
            WHERE data >= NOW() - $1::INTEGER * INTERVAL '1 day'
        `, [periodo || 30]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 