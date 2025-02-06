const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

// Middleware para verificar token
const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token não fornecido' 
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token inválido' 
        });
    }
};

// Rota de login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ 
            success: false, 
            error: 'E-mail e senha são obrigatórios' 
        });
    }

    try {
        // Buscar usuário
        const usuario = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM usuarios WHERE email = ?',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!usuario) {
            return res.json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }

        // Verificar senha
        const senhaCorreta = await bcrypt.compare(password, usuario.senha);
        if (!senhaCorreta) {
            return res.json({ 
                success: false, 
                error: 'Senha incorreta' 
            });
        }

        // Gerar token
        const token = jwt.sign(
            { 
                id: usuario.id, 
                email: usuario.email,
                role: usuario.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                role: usuario.role
            }
        });

    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.json({ 
            success: false, 
            error: 'Erro ao processar login' 
        });
    }
});

// Rota para verificar token
router.get('/verificar', verificarToken, (req, res) => {
    res.json({ 
        success: true, 
        usuario: req.usuario 
    });
});

// Rota para criar usuário admin (use apenas uma vez)
router.post('/criar-admin', async (req, res) => {
    const { nome, email, password } = req.body;

    if (!nome || !email || !password) {
        return res.json({ 
            success: false, 
            error: 'Todos os campos são obrigatórios' 
        });
    }

    try {
        // Verificar se já existe um admin
        const adminExistente = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM usuarios WHERE role = ?',
                ['admin'],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (adminExistente) {
            return res.json({ 
                success: false, 
                error: 'Já existe um usuário administrador' 
            });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(password, salt);

        // Inserir usuário
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)',
                [nome, email, senhaHash, 'admin'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            message: 'Administrador criado com sucesso' 
        });

    } catch (error) {
        console.error('Erro ao criar admin:', error);
        res.json({ 
            success: false, 
            error: 'Erro ao criar administrador' 
        });
    }
});

module.exports = {
    router,
    verificarToken
}; 