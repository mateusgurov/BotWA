const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const initDatabase = () => {
    const sqlPath = path.join(__dirname, '../../setup_db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir o arquivo SQL em comandos individuais
    const commands = sql.split(';').filter(cmd => cmd.trim());
    
    // Executar cada comando em sequência usando promises
    const executeCommands = async () => {
        for (const command of commands) {
            if (command.trim()) {
                try {
                    await new Promise((resolve, reject) => {
                        db.run(command.trim(), (err) => {
                            if (err) {
                                console.error('Erro ao executar comando:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    console.error('Erro na execução:', error);
                }
            }
        }
        console.log('Banco de dados inicializado com sucesso!');
    };

    executeCommands();
};

module.exports = initDatabase; 