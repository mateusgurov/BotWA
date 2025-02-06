const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Listar todas as viagens de um cliente
router.get('/', async (req, res) => {
    try {
        const { cliente_id } = req.query;
        let query = `
            SELECT 
                v.*,
                c.nome as cliente_nome
            FROM viagens v
            JOIN clientes c ON c.id = v.cliente_id
        `;
        
        const params = [];
        if (cliente_id) {
            query += ' WHERE v.cliente_id = $1';
            params.push(cliente_id);
        }
        
        query += ' ORDER BY v.data DESC';
        
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter viagem por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(`
            SELECT 
                v.*,
                c.nome as cliente_nome
            FROM viagens v
            JOIN clientes c ON c.id = v.cliente_id
            WHERE v.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Viagem não encontrada' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar nova viagem
router.post('/', async (req, res) => {
    try {
        const { cliente_id, distancia_km, valor, observacao } = req.body;
        
        const result = await db.query(
            'INSERT INTO viagens (cliente_id, distancia_km, valor, observacao) VALUES ($1, $2, $3, $4) RETURNING *',
            [cliente_id, distancia_km, valor, observacao]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar viagem
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { distancia_km, valor, observacao } = req.body;
        
        const result = await db.query(
            `UPDATE viagens 
             SET distancia_km = $1, valor = $2, observacao = $3
             WHERE id = $4 
             RETURNING *`,
            [distancia_km, valor, observacao, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Viagem não encontrada' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir viagem
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM viagens WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Viagem não encontrada' });
        }
        
        res.json({ message: 'Viagem excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter estatísticas de viagens
router.get('/estatisticas/geral', async (req, res) => {
    try {
        const { periodo } = req.query; // dias (30, 60, 90, etc)
        
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_viagens,
                SUM(distancia_km) as total_km,
                SUM(valor) as total_valor,
                AVG(valor / distancia_km) as media_custo_km,
                MIN(valor / distancia_km) as menor_custo_km,
                MAX(valor / distancia_km) as maior_custo_km
            FROM viagens
            WHERE data >= NOW() - $1::INTEGER * INTERVAL '1 day'
        `, [periodo || 30]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 