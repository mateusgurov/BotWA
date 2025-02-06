const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Listar todos os clientes
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT v.id) as total_viagens,
                COUNT(DISTINCT a.id) as total_abastecimentos
            FROM clientes c
            LEFT JOIN viagens v ON v.cliente_id = c.id
            LEFT JOIN abastecimentos a ON a.cliente_id = c.id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter cliente por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM clientes WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar novo cliente
router.post('/', async (req, res) => {
    try {
        const { nome, telefone, plano, data_vencimento } = req.body;
        
        const result = await db.query(
            'INSERT INTO clientes (nome, telefone, plano, data_vencimento) VALUES ($1, $2, $3, $4) RETURNING *',
            [nome, telefone, plano, data_vencimento]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar cliente
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, telefone, plano, data_vencimento, ativo } = req.body;
        
        const result = await db.query(
            `UPDATE clientes 
             SET nome = $1, telefone = $2, plano = $3, data_vencimento = $4, ativo = $5
             WHERE id = $6 
             RETURNING *`,
            [nome, telefone, plano, data_vencimento, ativo, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir cliente
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM clientes WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        
        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter métricas do cliente
router.get('/:id/metricas', async (req, res) => {
    try {
        const { id } = req.params;
        const { periodo } = req.query; // dias (30, 60, 90, etc)
        
        const result = await db.query(`
            WITH metricas AS (
                SELECT 
                    SUM(v.distancia_km) as total_km,
                    SUM(v.valor) as total_valor_viagens,
                    COUNT(v.id) as total_viagens,
                    (SELECT SUM(valor) FROM abastecimentos WHERE cliente_id = $1 AND data >= NOW() - $2::INTEGER * INTERVAL '1 day') as total_valor_abastecimentos,
                    (SELECT COUNT(id) FROM abastecimentos WHERE cliente_id = $1 AND data >= NOW() - $2::INTEGER * INTERVAL '1 day') as total_abastecimentos
                FROM viagens v
                WHERE v.cliente_id = $1
                AND v.data >= NOW() - $2::INTEGER * INTERVAL '1 day'
            )
            SELECT 
                total_km,
                total_valor_viagens,
                total_viagens,
                total_valor_abastecimentos,
                total_abastecimentos,
                CASE 
                    WHEN total_km > 0 THEN (total_valor_viagens + COALESCE(total_valor_abastecimentos, 0)) / total_km 
                    ELSE 0 
                END as custo_por_km
            FROM metricas
        `, [id, periodo || 30]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 