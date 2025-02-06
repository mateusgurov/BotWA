const db = require('../config/database');

// Estado dos usuários (para controlar o fluxo de conversação)
const userStates = new Map();

const MENU_PRINCIPAL = `🚕 *MENU PRINCIPAL* 🚕
1. 🛣️ Gerenciar Viagens  
2. ⛽ Gerenciar Abastecimentos  
3. 💰 Ver Ganhos Diários  
4. 📊 Estatísticas da Semana  
5. ⚙️ Configurações
6. 🆘 Ajuda  

_Digite o número da opção ou 0 para ver este menu novamente_`;

const MENU_VIAGENS = `🛣️ *GERENCIAR VIAGENS* 🛣️
1. ➕ Adicionar Viagem
2. 📋 Ver Viagens
3. ✏️ Editar Viagem
4. 🗑️ Excluir Viagem
5. ↩️ Voltar ao Menu Principal
0. 🔄 Ver este menu novamente

_Digite o número da opção_`;

const MENU_ABASTECIMENTOS = `⛽ *GERENCIAR ABASTECIMENTOS* ⛽
1. ➕ Adicionar Abastecimento
2. 📋 Ver Abastecimentos
3. ✏️ Editar Abastecimento
4. 🗑️ Excluir Abastecimento
5. ↩️ Voltar ao Menu Principal
0. 🔄 Ver este menu novamente

_Digite o número da opção_`;

const MENU_CONFIGURACOES = `⚙️ *CONFIGURAÇÕES* ⚙️
1. 💳 Gerenciar Assinatura
2. 🗑️ Apagar Todos os Dados
3. ↩️ Voltar ao Menu Principal
0. 🔄 Ver este menu novamente

_Digite o número da opção_`;

const MENU_ASSINATURA = `💳 *GERENCIAR ASSINATURA* 💳
1. 📊 Ver Status da Assinatura
2. 🔄 Renovar Assinatura
3. ❌ Cancelar Assinatura
4. ↩️ Voltar ao Menu de Configurações
0. 🔄 Ver este menu novamente

_Digite o número da opção_`;

const commands = {
    '!menu': async (client, message) => {
        await client.sendMessage(message.from, MENU_PRINCIPAL);
    },

    '!ajuda': async (client, message) => {
        const help = `
🆘 *AJUDA* 🆘

*Comandos Disponíveis:*
!menu - Mostra o menu principal
!viagem - Registrar uma viagem
!abastecimento - Registrar abastecimento
!ganhos - Ver ganhos diários
!stats - Ver estatísticas da semana

*Como usar o menu:*
1. Digite !menu para ver as opções
2. Digite o número da opção desejada
3. Siga as instruções na tela

*Exemplos:*
!viagem 100 50 Viagem para Centro
!abastecimento 40 200 Posto Shell
`;
        await client.sendMessage(message.from, help);
    },

    '!viagem': async (client, message, args) => {
        try {
            if (args.length < 2) {
                await client.sendMessage(message.from, 'Uso correto: !viagem [distância] [valor] [observação]');
                return;
            }

            const distancia = parseDecimal(args[0]);
            const valor = parseDecimal(args[1]);
            const observacao = args.slice(2).join(' ') || null;

            if (isNaN(distancia) || isNaN(valor)) {
                await client.sendMessage(message.from, '❌ Distância e valor devem ser números válidos (use vírgula para decimais).');
                return;
            }

            // Pegar o número do autor da mensagem
            const chat = await message.getChat();
            const phoneNumber = chat.isGroup ? message.author.replace('@c.us', '') : message.from.replace('@c.us', '');
            
            db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                if (err) {
                    console.error(err);
                    await client.sendMessage(message.from, '❌ Erro ao verificar cliente.');
                    return;
                }

                let clienteId;
                
                if (!cliente) {
                    // Criar novo cliente se não existir
                    db.run(
                        'INSERT INTO clientes (nome, telefone, plano) VALUES (?, ?, ?)',
                        [phoneNumber, phoneNumber, 'free'],
                        function(err) {
                            if (err) {
                                console.error(err);
                                client.sendMessage(message.from, '❌ Erro ao criar cliente.');
                                return;
                            }
                            clienteId = this.lastID;
                            processarViagem(clienteId);
                        }
                    );
                } else {
                    clienteId = cliente.id;
                    processarViagem(clienteId);
                }
            });

            async function processarViagem(clienteId) {
                // Verificar se está editando uma viagem existente
                const userState = userStates.get(phoneNumber);
                if (userState && userState.step === 'CONFIRMAR_EDICAO' && userState.viagemSelecionada) {
                    // Atualizar viagem existente
                    db.run(
                        'UPDATE viagens SET distancia_km = ?, valor = ?, observacao = ? WHERE id = ?',
                        [distancia, valor, observacao, userState.viagemSelecionada.id],
                        async (err) => {
                            if (err) {
                                console.error(err);
                                await client.sendMessage(message.from, '❌ Erro ao atualizar viagem.');
                                return;
                            }
                            const resposta = `✅ Viagem atualizada com sucesso!\n📍 Distância: ${formatDecimal(distancia)}km\n💰 Valor: R$ ${formatMoney(valor)}`;
                            await client.sendMessage(message.from, resposta);
                            userStates.delete(phoneNumber); // Limpar estado após edição
                        }
                    );
                } else {
                    // Inserir nova viagem
                db.run(
                    'INSERT INTO viagens (cliente_id, distancia_km, valor, observacao) VALUES (?, ?, ?, ?)',
                    [clienteId, distancia, valor, observacao],
                    async (err) => {
                        if (err) {
                            console.error(err);
                            await client.sendMessage(message.from, '❌ Erro ao registrar viagem.');
                            return;
                        }
                        const resposta = `✅ Viagem registrada com sucesso!\n📍 Distância: ${formatDecimal(distancia)}km\n💰 Valor: R$ ${formatMoney(valor)}`;
                        await client.sendMessage(message.from, resposta);
                    }
                );
                }
            }
        } catch (error) {
            console.error(error);
            await client.sendMessage(message.from, '❌ Erro ao processar comando.');
        }
    },

    '!abastecimento': async (client, message, args) => {
        try {
            if (args.length < 2) {
                await client.sendMessage(message.from, 'Uso correto: !abastecimento [litros] [valor] [posto]');
                return;
            }

            const litros = parseDecimal(args[0]);
            const valor = parseDecimal(args[1]);
            const posto = args.slice(2).join(' ') || 'Não informado';

            if (isNaN(litros) || isNaN(valor)) {
                await client.sendMessage(message.from, '❌ Litros e valor devem ser números válidos (use vírgula para decimais).');
                return;
            }

            // Pegar o número do autor da mensagem
            const chat = await message.getChat();
            const phoneNumber = chat.isGroup ? message.author.replace('@c.us', '') : message.from.replace('@c.us', '');
            
            db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                if (err) {
                    console.error(err);
                    await client.sendMessage(message.from, '❌ Erro ao verificar cliente.');
                    return;
                }

                let clienteId;
                
                if (!cliente) {
                    // Criar novo cliente se não existir
                    db.run(
                        'INSERT INTO clientes (nome, telefone, plano) VALUES (?, ?, ?)',
                        [phoneNumber, phoneNumber, 'free'],
                        function(err) {
                            if (err) {
                                console.error(err);
                                client.sendMessage(message.from, '❌ Erro ao criar cliente.');
                                return;
                            }
                            clienteId = this.lastID;
                            processarAbastecimento(clienteId);
                        }
                    );
                } else {
                    clienteId = cliente.id;
                    processarAbastecimento(clienteId);
                }
            });

            async function processarAbastecimento(clienteId) {
                // Verificar se está editando um abastecimento existente
                const userState = userStates.get(phoneNumber);
                if (userState && userState.step === 'CONFIRMAR_EDICAO_ABASTECIMENTO' && userState.abastecimentoSelecionado) {
                    // Atualizar abastecimento existente
                    db.run(
                        'UPDATE abastecimentos SET litros = ?, valor = ?, posto = ? WHERE id = ?',
                        [litros, valor, posto, userState.abastecimentoSelecionado.id],
                        async (err) => {
                            if (err) {
                                console.error(err);
                                await client.sendMessage(message.from, '❌ Erro ao atualizar abastecimento.');
                                return;
                            }
                            const resposta = `✅ Abastecimento atualizado com sucesso!\n⛽ Litros: ${formatDecimal(litros)}L\n💰 Valor: R$ ${formatMoney(valor)}\n🏪 Posto: ${posto}`;
                            await client.sendMessage(message.from, resposta);
                            userStates.delete(phoneNumber); // Limpar estado após edição
                        }
                    );
                } else {
                    // Inserir novo abastecimento
                    db.run(
                        'INSERT INTO abastecimentos (cliente_id, litros, valor, posto) VALUES (?, ?, ?, ?)',
                        [clienteId, litros, valor, posto],
                        async (err) => {
                            if (err) {
                                console.error(err);
                                await client.sendMessage(message.from, '❌ Erro ao registrar abastecimento.');
                                return;
                            }
                            const resposta = `✅ Abastecimento registrado com sucesso!\n⛽ Litros: ${formatDecimal(litros)}L\n💰 Valor: R$ ${formatMoney(valor)}\n🏪 Posto: ${posto}`;
                            await client.sendMessage(message.from, resposta);
                        }
                    );
                }
            }
        } catch (error) {
            console.error(error);
            await client.sendMessage(message.from, '❌ Erro ao processar comando.');
        }
    },

    '!ganhos': async (client, message) => {
        try {
            const chat = await message.getChat();
            const phoneNumber = chat.isGroup ? message.author.replace('@c.us', '') : message.from.replace('@c.us', '');
            
            db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                if (err || !cliente) {
                    await client.sendMessage(message.from, '❌ Cliente não encontrado.');
                    return;
                }

                // Buscar ganhos do dia
                db.all(
                    `SELECT SUM(valor) as total, COUNT(*) as viagens, 
                     SUM(distancia_km) as distancia_total 
                     FROM viagens 
                     WHERE cliente_id = ? 
                     AND date(data) = date('now')`,
                    [cliente.id],
                    async (err, rows) => {
                        if (err) {
                            await client.sendMessage(message.from, '❌ Erro ao gerar relatório.');
                            console.error(err);
                            return;
                        }

                        const ganhos = rows[0];
                        let report = `*💰 Ganhos de Hoje*\n\n`;
                        report += `🚗 Viagens: ${ganhos.viagens || 0}\n`;
                        report += `📍 Distância: ${(ganhos.distancia_total || 0).toFixed(1)}km\n`;
                        report += `💵 Total: R$ ${(ganhos.total || 0).toFixed(2)}\n`;

                        await client.sendMessage(message.from, report);
                    }
                );
            });
        } catch (error) {
            console.error(error);
            await client.sendMessage(message.from, '❌ Erro ao processar comando.');
        }
    },

    '!stats': async (client, message) => {
        try {
            const chat = await message.getChat();
            const phoneNumber = chat.isGroup ? message.author.replace('@c.us', '') : message.from.replace('@c.us', '');
            
            db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                if (err || !cliente) {
                    await client.sendMessage(message.from, '❌ Cliente não encontrado.');
                    return;
                }

                // Buscar estatísticas da semana
                db.all(
                    `SELECT 
                        SUM(valor) as total,
                        COUNT(*) as viagens,
                        SUM(distancia_km) as distancia_total,
                        strftime('%w', data) as dia_semana
                     FROM viagens 
                     WHERE cliente_id = ? 
                     AND data >= date('now', '-7 days')
                     GROUP BY strftime('%w', data)
                     ORDER BY dia_semana`,
                    [cliente.id],
                    async (err, rows) => {
                        if (err) {
                            await client.sendMessage(message.from, '❌ Erro ao gerar estatísticas.');
                            console.error(err);
                            return;
                        }

                        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                        let report = `*📊 Estatísticas da Semana*\n\n`;
                        
                        let totalSemana = 0;
                        let viagensSemana = 0;
                        let distanciaSemana = 0;

                        rows.forEach(row => {
                            const dia = diasSemana[row.dia_semana];
                            report += `*${dia}:*\n`;
                            report += `🚗 ${row.viagens} viagens\n`;
                            report += `📍 ${row.distancia_total.toFixed(1)}km\n`;
                            report += `💵 R$ ${row.total.toFixed(2)}\n\n`;

                            totalSemana += row.total;
                            viagensSemana += row.viagens;
                            distanciaSemana += row.distancia_total;
                        });

                        report += `*Total da Semana:*\n`;
                        report += `🚗 ${viagensSemana} viagens\n`;
                        report += `📍 ${distanciaSemana.toFixed(1)}km\n`;
                        report += `💵 R$ ${totalSemana.toFixed(2)}`;

                        await client.sendMessage(message.from, report);
                    }
                );
            });
        } catch (error) {
            console.error(error);
            await client.sendMessage(message.from, '❌ Erro ao processar comando.');
        }
    }
};

// Função para formatar data
function formatarData(data) {
    return new Date(data).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Função para converter string com vírgula para número
function parseDecimal(value) {
    // Substitui vírgula por ponto e converte para número
    return parseFloat(value.replace(',', '.'));
}

// Função para formatar número com vírgula
function formatDecimal(value) {
    // Converte para string com 3 casas decimais e substitui ponto por vírgula
    return value.toFixed(3).replace('.', ',');
}

// Função para formatar valor monetário
function formatMoney(value) {
    // Converte para string com 2 casas decimais e substitui ponto por vírgula
    return value.toFixed(2).replace('.', ',');
}

// Função para mostrar opções de navegação após uma operação
async function mostrarOpcoesNavegacao(client, message, menuAtual) {
    await client.sendMessage(message.from, 
        '\n📱 *Opções:*\n' +
        '0️⃣ Ver menu de ' + menuAtual + ' novamente\n' +
        '5️⃣ Voltar ao menu principal');
}

// Atualizar a função listarViagens para incluir opções de navegação
async function listarViagens(client, message, clienteId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, distancia_km, valor, observacao, data 
             FROM viagens 
             WHERE cliente_id = ? 
             ORDER BY data DESC 
             LIMIT 10`,
            [clienteId],
            async (err, viagens) => {
                if (err) {
                    console.error(err);
                    await client.sendMessage(message.from, '❌ Erro ao buscar viagens.');
                    reject(err);
                    return;
                }

                if (viagens.length === 0) {
                    await client.sendMessage(message.from, '❌ Nenhuma viagem encontrada.');
                    await mostrarOpcoesNavegacao(client, message, 'viagens');
                    resolve([]);
                    return;
                }

                let listaViagens = '*Últimas Viagens:*\n\n';
                viagens.forEach((viagem, index) => {
                    listaViagens += `*${index + 1}.* Data: ${formatarData(viagem.data)}\n`;
                    listaViagens += `   📍 Distância: ${formatDecimal(viagem.distancia_km)}km\n`;
                    listaViagens += `   💰 Valor: R$ ${formatMoney(viagem.valor)}\n`;
                    if (viagem.observacao) {
                        listaViagens += `   📝 Obs: ${viagem.observacao}\n`;
                    }
                    listaViagens += '\n';
                });

                await client.sendMessage(message.from, listaViagens);
                await mostrarOpcoesNavegacao(client, message, 'viagens');
                resolve(viagens);
            }
        );
    });
}

// Atualizar a função listarAbastecimentos para incluir opções de navegação
async function listarAbastecimentos(client, message, clienteId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, litros, valor, posto, data 
             FROM abastecimentos 
             WHERE cliente_id = ? 
             ORDER BY data DESC 
             LIMIT 10`,
            [clienteId],
            async (err, abastecimentos) => {
                if (err) {
                    console.error(err);
                    await client.sendMessage(message.from, '❌ Erro ao buscar abastecimentos.');
                    reject(err);
                    return;
                }

                if (abastecimentos.length === 0) {
                    await client.sendMessage(message.from, '❌ Nenhum abastecimento encontrado.');
                    await mostrarOpcoesNavegacao(client, message, 'abastecimentos');
                    resolve([]);
                    return;
                }

                let listaAbastecimentos = '*Últimos Abastecimentos:*\n\n';
                abastecimentos.forEach((abastecimento, index) => {
                    listaAbastecimentos += `*${index + 1}.* Data: ${formatarData(abastecimento.data)}\n`;
                    listaAbastecimentos += `   ⛽ Litros: ${formatDecimal(abastecimento.litros)}L\n`;
                    listaAbastecimentos += `   💰 Valor: R$ ${formatMoney(abastecimento.valor)}\n`;
                    listaAbastecimentos += `   🏪 Posto: ${abastecimento.posto}\n\n`;
                });

                await client.sendMessage(message.from, listaAbastecimentos);
                await mostrarOpcoesNavegacao(client, message, 'abastecimentos');
                resolve(abastecimentos);
            }
        );
    });
}

// Função para normalizar número de telefone
function normalizePhoneNumber(phone) {
    // Remove qualquer caractere que não seja número
    const numbers = phone.replace(/\D/g, '');
    
    // Se o número já tem o formato correto, retorna como está
    if (numbers.length === 12 || numbers.length === 13) return numbers;
    
    // Se o número não tem o formato correto, retorna null
    return null;
}

// Função para verificar se o número está permitido
async function isAllowed(phoneNumber) {
    // Normaliza o número antes de verificar
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    console.log('Verificando permissão para o número:', phoneNumber);
    console.log('Número normalizado:', normalizedNumber);
    
    return new Promise((resolve) => {
        const query = 'SELECT * FROM numeros_permitidos WHERE telefone = ?';
        console.log('Executando query:', query, 'com número:', normalizedNumber);
        
        db.get(query, [normalizedNumber], (err, row) => {
            if (err) {
                console.error('Erro ao verificar número:', err);
                resolve(false);
                return;
            }
            
            console.log('Resultado da consulta:', row);
            if (!row) {
                console.log('Número não encontrado na lista de permitidos');
                resolve(false);
                return;
            }
            
            const isActive = row.ativo === 1;
            console.log('Status do número:', isActive ? 'Ativo' : 'Inativo');
            resolve(isActive);
        });
    });
}

// Função para verificar se a assinatura está ativa
async function verificarAssinatura(phoneNumber) {
    return new Promise((resolve) => {
        db.get(
            `SELECT status_assinatura, proximo_vencimento 
             FROM clientes 
             WHERE telefone = ?`,
            [phoneNumber],
            (err, cliente) => {
                if (err) {
                    console.error('Erro ao verificar assinatura:', err);
                    resolve(false);
                    return;
                }

                if (!cliente) {
                    resolve(false);
                    return;
                }

                // Se não tiver assinatura ativa, permite apenas ver o menu e gerenciar assinatura
                if (cliente.status_assinatura !== 'ativo') {
                    resolve(false);
                    return;
                }

                // Verifica se a assinatura está vencida
                const dataVencimento = new Date(cliente.proximo_vencimento);
                const hoje = new Date();

                if (dataVencimento < hoje) {
                    // Atualiza o status da assinatura para vencido
                    db.run(
                        'UPDATE clientes SET status_assinatura = ? WHERE telefone = ?',
                        ['vencido', phoneNumber]
                    );
                    resolve(false);
                    return;
                }

                resolve(true);
            }
        );
    });
}

// Função para processar pagamento
async function processarPagamento(client, message, phoneNumber, planoSelecionado) {
    try {
        // Buscar o cliente
        const cliente = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!cliente) {
            await client.sendMessage(message.from, '❌ Erro ao identificar cliente.');
            return;
        }

        // Calcular nova data de vencimento
        const dataAtual = new Date();
        const novoVencimento = new Date(dataAtual.setDate(dataAtual.getDate() + planoSelecionado.duracao_dias));

        // Registrar pagamento
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO pagamentos (cliente_id, plano_id, valor, status, metodo_pagamento) VALUES (?, ?, ?, ?, ?)',
                [cliente.id, planoSelecionado.id, planoSelecionado.valor, 'aprovado', 'pix'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Atualizar status do cliente
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE clientes 
                 SET status_assinatura = ?, 
                     plano = ?, 
                     ultimo_pagamento = CURRENT_TIMESTAMP,
                     proximo_vencimento = ?,
                     valor_assinatura = ?
                 WHERE id = ?`,
                ['ativo', planoSelecionado.nome, novoVencimento.toISOString(), planoSelecionado.valor, cliente.id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Enviar confirmação
        await client.sendMessage(message.from,
            `✅ *Pagamento Processado com Sucesso!*\n\n` +
            `📦 Plano: ${planoSelecionado.nome}\n` +
            `💰 Valor: R$ ${formatMoney(planoSelecionado.valor)}\n` +
            `📅 Válido até: ${formatarData(novoVencimento)}\n\n` +
            `Aproveite todos os recursos do bot! 🎉`
        );

        // Voltar para o menu principal
        await client.sendMessage(message.from, MENU_PRINCIPAL);
        return true;
    } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        await client.sendMessage(message.from, '❌ Erro ao processar pagamento. Por favor, tente novamente ou contate o suporte.');
        return false;
    }
}

const handleMessage = async (client, message) => {
    try {
        const chat = await message.getChat();
        const phoneNumber = chat.isGroup ? message.author.replace('@c.us', '') : message.from.replace('@c.us', '');
        
        // Verificar se o número está permitido
        const allowed = await isAllowed(phoneNumber);
        if (!allowed) {
            await client.sendMessage(
                message.from,
                'Desculpe, seu número não está autorizado a usar este bot. Entre em contato com o administrador.'
            );
            return;
        }

        let userState = userStates.get(phoneNumber) || { step: 'MENU' };

        // Processar comprovante de pagamento
        if (message.hasMedia && userState.step === 'CONFIRMAR_ASSINATURA' && userState.planoSelecionado) {
            const media = await message.downloadMedia();
            if (media) {
                await client.sendMessage(message.from, '⌛ Processando seu pagamento...');
                const sucesso = await processarPagamento(client, message, phoneNumber, userState.planoSelecionado);
                if (sucesso) {
                    userStates.delete(phoneNumber);
                    return;
                }
            }
        }

        // Comandos que não precisam de verificação de assinatura
        const comandosLivres = ['!menu', '5'];
        const emMenuAssinatura = userState.step === 'MENU_ASSINATURA' || 
                                userState.step === 'SELECIONAR_PLANO' || 
                                userState.step === 'CONFIRMAR_ASSINATURA' ||
                                userState.step === 'CONFIRMAR_CANCELAMENTO';

        // Se não for um comando livre e não estiver no menu de assinatura, verifica a assinatura
        if (!comandosLivres.includes(message.body) && !emMenuAssinatura) {
            const assinaturaAtiva = await verificarAssinatura(phoneNumber);
            if (!assinaturaAtiva) {
                await client.sendMessage(
                    message.from,
                    `❌ *Acesso Restrito*\n\n` +
                    `Sua assinatura está inativa ou vencida.\n` +
                    `Para continuar usando o bot, renove sua assinatura:\n\n` +
                    `1. Digite *5* para acessar as Configurações\n` +
                    `2. Selecione *Gerenciar Assinatura*\n` +
                    `3. Escolha *Renovar Assinatura*`
                );
                return;
            }
        }

        if (message.body.startsWith('!')) {
            const [command, ...args] = message.body.split(' ');
            const handler = commands[command.toLowerCase()];

            if (handler) {
                await handler(client, message, args);
                // Após executar um comando, mostrar opções de navegação
                if (userState.step === 'MENU_VIAGENS' || command === '!viagem') {
                    await mostrarOpcoesNavegacao(client, message, 'viagens');
                } else if (userState.step === 'MENU_ABASTECIMENTOS' || command === '!abastecimento') {
                    await mostrarOpcoesNavegacao(client, message, 'abastecimentos');
                }
                userStates.delete(phoneNumber);
            } else {
                await client.sendMessage(message.from, 'Comando não reconhecido. Digite !menu para ver as opções disponíveis.');
            }
            return;
        }

        switch (userState.step) {
            case 'MENU_VIAGENS':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_VIAGENS);
                    break;
                }
                switch (message.body) {
                    case '1':
                        await client.sendMessage(message.from, 
                            `➕ *Adicionar Nova Viagem*\n\nUse o comando:\n!viagem [distância] [valor] [observação]\n\nExemplo:\n!viagem 10,500 50,00 Viagem ao centro\n\n0️⃣ Digite 0 para ver o menu de viagens\n5️⃣ Digite 5 para voltar ao menu principal`);
                        break;
                    case '2':
                        db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                            if (err || !cliente) {
                                await client.sendMessage(message.from, '❌ Erro ao buscar suas informações.');
                                return;
                            }
                            await listarViagens(client, message, cliente.id);
                        });
                        break;
                    case '3':
                        db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                            if (err || !cliente) {
                                await client.sendMessage(message.from, '❌ Erro ao buscar suas informações.');
                                return;
                            }
                            const viagens = await listarViagens(client, message, cliente.id);
                            if (viagens.length > 0) {
                                userState.step = 'EDITAR_VIAGEM';
                                userState.viagens = viagens;
                                userStates.set(phoneNumber, userState);
                                await client.sendMessage(message.from, 
                                    '*✏️ Editar Viagem*\n\nDigite o número da viagem que deseja editar:\n\n0️⃣ Digite 0 para cancelar e voltar ao menu de viagens');
                            }
                        });
                        break;
                    case '4':
                        db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                            if (err || !cliente) {
                                await client.sendMessage(message.from, '❌ Erro ao buscar suas informações.');
                                return;
                            }
                            const viagens = await listarViagens(client, message, cliente.id);
                            if (viagens.length > 0) {
                                userState.step = 'EXCLUIR_VIAGEM';
                                userState.viagens = viagens;
                                userStates.set(phoneNumber, userState);
                                await client.sendMessage(message.from, 
                                    '*🗑️ Excluir Viagem*\n\nDigite o número da viagem que deseja excluir:\n\n0️⃣ Digite 0 para cancelar e voltar ao menu de viagens');
                            }
                        });
                        break;
                    case '5':
                        await client.sendMessage(message.from, MENU_PRINCIPAL);
                        userStates.delete(phoneNumber);
                        break;
                    default:
                        await client.sendMessage(message.from, '❌ Opção inválida.\n\n' + MENU_VIAGENS);
                }
                break;

            case 'MENU_ABASTECIMENTOS':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_ABASTECIMENTOS);
                    break;
                }
                switch (message.body) {
                    case '1':
                        await client.sendMessage(message.from, 
                            `➕ *Adicionar Novo Abastecimento*\n\nUse o comando:\n!abastecimento [litros] [valor] [posto]\n\nExemplo:\n!abastecimento 40,500 200,00 Posto Shell\n\n0️⃣ Digite 0 para ver o menu de abastecimentos\n5️⃣ Digite 5 para voltar ao menu principal`);
                        break;
                    case '2':
                        db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                            if (err || !cliente) {
                                await client.sendMessage(message.from, '❌ Erro ao buscar suas informações.');
                                return;
                            }
                            await listarAbastecimentos(client, message, cliente.id);
                        });
                        break;
                    case '3':
                        db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                            if (err || !cliente) {
                                await client.sendMessage(message.from, '❌ Erro ao buscar suas informações.');
                                return;
                            }
                            const abastecimentos = await listarAbastecimentos(client, message, cliente.id);
                            if (abastecimentos.length > 0) {
                                userState.step = 'EDITAR_ABASTECIMENTO';
                                userState.abastecimentos = abastecimentos;
                                userStates.set(phoneNumber, userState);
                                await client.sendMessage(message.from, 
                                    '*✏️ Editar Abastecimento*\n\nDigite o número do abastecimento que deseja editar:\n\n0️⃣ Digite 0 para cancelar e voltar ao menu de abastecimentos');
                            }
                        });
                        break;
                    case '4':
                        db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], async (err, cliente) => {
                            if (err || !cliente) {
                                await client.sendMessage(message.from, '❌ Erro ao buscar suas informações.');
                                return;
                            }
                            const abastecimentos = await listarAbastecimentos(client, message, cliente.id);
                            if (abastecimentos.length > 0) {
                                userState.step = 'EXCLUIR_ABASTECIMENTO';
                                userState.abastecimentos = abastecimentos;
                                userStates.set(phoneNumber, userState);
                                await client.sendMessage(message.from, 
                                    '*🗑️ Excluir Abastecimento*\n\nDigite o número do abastecimento que deseja excluir:\n\n0️⃣ Digite 0 para cancelar e voltar ao menu de abastecimentos');
                            }
                        });
                        break;
                    case '5':
                        await client.sendMessage(message.from, MENU_PRINCIPAL);
                        userStates.delete(phoneNumber);
                        break;
                    default:
                        await client.sendMessage(message.from, '❌ Opção inválida.\n\n' + MENU_ABASTECIMENTOS);
                }
                break;

            case 'EDITAR_VIAGEM':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_VIAGENS);
                    userState.step = 'MENU_VIAGENS';
                    userStates.set(phoneNumber, userState);
                    return;
                }
                const viagemIndexEdit = parseInt(message.body) - 1;
                if (isNaN(viagemIndexEdit) || !userState.viagens || viagemIndexEdit < 0 || viagemIndexEdit >= userState.viagens.length) {
                    await client.sendMessage(message.from, '❌ Número de viagem inválido. Operação cancelada.');
                    userStates.delete(phoneNumber);
                    return;
                }
                const viagemParaEditar = userState.viagens[viagemIndexEdit];
                userState.viagemSelecionada = viagemParaEditar;
                userState.step = 'CONFIRMAR_EDICAO';
                userStates.set(phoneNumber, userState);
                await client.sendMessage(message.from, 
                    `✏️ *Editar Viagem*\n\nUse o comando abaixo para atualizar a viagem:\n!viagem ${viagemParaEditar.distancia_km} ${viagemParaEditar.valor} ${viagemParaEditar.observacao || ''}\n\n_(Modifique os valores conforme necessário)_`);
                break;

            case 'EXCLUIR_VIAGEM':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_VIAGENS);
                    userState.step = 'MENU_VIAGENS';
                    userStates.set(phoneNumber, userState);
                    return;
                }
                const viagemIndex = parseInt(message.body) - 1;
                if (isNaN(viagemIndex) || !userState.viagens || viagemIndex < 0 || viagemIndex >= userState.viagens.length) {
                    await client.sendMessage(message.from, '❌ Número de viagem inválido. Operação cancelada.');
                    userStates.delete(phoneNumber);
                    return;
                }
                const viagemParaExcluir = userState.viagens[viagemIndex];
                userState.viagemSelecionada = viagemParaExcluir;
                userState.step = 'CONFIRMAR_EXCLUSAO';
                userStates.set(phoneNumber, userState);
                await client.sendMessage(message.from, 
                    `🗑️ *Confirmar Exclusão*\n\nViagem selecionada:\nData: ${formatarData(viagemParaExcluir.data)}\nDistância: ${viagemParaExcluir.distancia_km}km\nValor: R$ ${viagemParaExcluir.valor}\n\nDigite *SIM* para excluir ou *NÃO* para cancelar.`);
                break;

            case 'CONFIRMAR_EXCLUSAO':
                if (message.body.toUpperCase() === 'SIM') {
                    const viagem = userState.viagemSelecionada;
                    db.run('DELETE FROM viagens WHERE id = ?', [viagem.id], async (err) => {
                        if (err) {
                            await client.sendMessage(message.from, '❌ Erro ao excluir viagem.');
                            console.error(err);
                        } else {
                            await client.sendMessage(message.from, '✅ Viagem excluída com sucesso!');
                        }
                        userStates.delete(phoneNumber);
                    });
                } else {
                    await client.sendMessage(message.from, '❌ Operação cancelada.');
                    userStates.delete(phoneNumber);
                }
                break;

            case 'EDITAR_ABASTECIMENTO':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_ABASTECIMENTOS);
                    userState.step = 'MENU_ABASTECIMENTOS';
                    userStates.set(phoneNumber, userState);
                    return;
                }
                const abastecimentoIndexEdit = parseInt(message.body) - 1;
                if (isNaN(abastecimentoIndexEdit) || !userState.abastecimentos || abastecimentoIndexEdit < 0 || abastecimentoIndexEdit >= userState.abastecimentos.length) {
                    await client.sendMessage(message.from, '❌ Número de abastecimento inválido. Operação cancelada.');
                    userStates.delete(phoneNumber);
                    return;
                }
                const abastecimentoParaEditar = userState.abastecimentos[abastecimentoIndexEdit];
                userState.abastecimentoSelecionado = abastecimentoParaEditar;
                userState.step = 'CONFIRMAR_EDICAO_ABASTECIMENTO';
                userStates.set(phoneNumber, userState);
                await client.sendMessage(message.from, 
                    `✏️ *Editar Abastecimento*\n\nUse o comando abaixo para atualizar o abastecimento:\n!abastecimento ${abastecimentoParaEditar.litros} ${abastecimentoParaEditar.valor} ${abastecimentoParaEditar.posto}\n\n_(Modifique os valores conforme necessário)_`);
                break;

            case 'EXCLUIR_ABASTECIMENTO':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_ABASTECIMENTOS);
                    userState.step = 'MENU_ABASTECIMENTOS';
                    userStates.set(phoneNumber, userState);
                    return;
                }
                const abastecimentoIndex = parseInt(message.body) - 1;
                if (isNaN(abastecimentoIndex) || !userState.abastecimentos || abastecimentoIndex < 0 || abastecimentoIndex >= userState.abastecimentos.length) {
                    await client.sendMessage(message.from, '❌ Número de abastecimento inválido. Operação cancelada.');
                    userStates.delete(phoneNumber);
                    return;
                }
                const abastecimentoParaExcluir = userState.abastecimentos[abastecimentoIndex];
                userState.abastecimentoSelecionado = abastecimentoParaExcluir;
                userState.step = 'CONFIRMAR_EXCLUSAO_ABASTECIMENTO';
                userStates.set(phoneNumber, userState);
                await client.sendMessage(message.from, 
                    `🗑️ *Confirmar Exclusão*\n\nAbastecimento selecionado:\nData: ${formatarData(abastecimentoParaExcluir.data)}\nLitros: ${abastecimentoParaExcluir.litros}L\nValor: R$ ${abastecimentoParaExcluir.valor}\nPosto: ${abastecimentoParaExcluir.posto}\n\nDigite *SIM* para excluir ou *NÃO* para cancelar.`);
                break;

            case 'CONFIRMAR_EXCLUSAO_ABASTECIMENTO':
                if (message.body.toUpperCase() === 'SIM') {
                    const abastecimento = userState.abastecimentoSelecionado;
                    db.run('DELETE FROM abastecimentos WHERE id = ?', [abastecimento.id], async (err) => {
                        if (err) {
                            await client.sendMessage(message.from, '❌ Erro ao excluir abastecimento.');
                            console.error(err);
                        } else {
                            await client.sendMessage(message.from, '✅ Abastecimento excluído com sucesso!');
                        }
                        userStates.delete(phoneNumber);
                    });
                } else {
                    await client.sendMessage(message.from, '❌ Operação cancelada.');
                    userStates.delete(phoneNumber);
                }
                break;

            case 'MENU_CONFIGURACOES':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_CONFIGURACOES);
                    break;
                }
                switch (message.body) {
                    case '1':
                        await client.sendMessage(message.from, MENU_ASSINATURA);
                        userState.step = 'MENU_ASSINATURA';
                        userStates.set(phoneNumber, userState);
                        break;
                    case '2':
                        userState.step = 'CONFIRMAR_RESET';
                        userStates.set(phoneNumber, userState);
                        await client.sendMessage(message.from, 
                            `⚠️ *ATENÇÃO* ⚠️\n\n` +
                            `Você está prestes a apagar *TODOS* os seus dados:\n` +
                            `- Todas as viagens registradas\n` +
                            `- Todos os abastecimentos\n` +
                            `- Todo o histórico\n\n` +
                            `Esta ação é *IRREVERSÍVEL*!\n\n` +
                            `Digite *CONFIRMAR* para prosseguir ou qualquer outra coisa para cancelar.`);
                        break;
                    case '3':
                        await client.sendMessage(message.from, MENU_PRINCIPAL);
                        userState.step = 'MENU';
                        userStates.set(phoneNumber, userState);
                        break;
                    default:
                        await client.sendMessage(message.from, '❌ Opção inválida.\n\n' + MENU_CONFIGURACOES);
                }
                break;

            case 'CONFIRMAR_RESET':
                if (message.body.toUpperCase() === 'CONFIRMAR') {
                    try {
                        // Pegar o ID do cliente
                        const cliente = await new Promise((resolve, reject) => {
                            db.get('SELECT id FROM clientes WHERE telefone = ?', [phoneNumber], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });

                        if (cliente) {
                            // Apagar todas as viagens
                            await new Promise((resolve, reject) => {
                                db.run('DELETE FROM viagens WHERE cliente_id = ?', [cliente.id], (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });

                            // Apagar todos os abastecimentos
                            await new Promise((resolve, reject) => {
                                db.run('DELETE FROM abastecimentos WHERE cliente_id = ?', [cliente.id], (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });

                            await client.sendMessage(message.from, 
                                '✅ Todos os seus dados foram apagados com sucesso!\n\n' +
                                'Retornando ao menu principal...');
                        } else {
                            await client.sendMessage(message.from, '❌ Erro ao identificar cliente.');
                        }
                    } catch (error) {
                        console.error('Erro ao resetar dados:', error);
                        await client.sendMessage(message.from, '❌ Erro ao apagar dados. Tente novamente mais tarde.');
                    }
                } else {
                    await client.sendMessage(message.from, '❌ Operação cancelada.\n\nRetornando ao menu de configurações...');
                }
                
                // Voltar para o menu de configurações
                userState.step = 'MENU_CONFIGURACOES';
                userStates.set(phoneNumber, userState);
                await client.sendMessage(message.from, MENU_CONFIGURACOES);
                break;

            case 'MENU_ASSINATURA':
                if (message.body === '0') {
                    await client.sendMessage(message.from, MENU_ASSINATURA);
                    break;
                }
                switch (message.body) {
                    case '1':
                        // Ver status da assinatura
                        db.get(
                            `SELECT c.*, p.nome as plano_nome, p.valor as plano_valor, p.duracao_dias 
                             FROM clientes c 
                             LEFT JOIN pagamentos pg ON c.id = pg.cliente_id 
                             LEFT JOIN planos p ON pg.plano_id = p.id 
                             WHERE c.telefone = ? 
                             ORDER BY pg.data_pagamento DESC LIMIT 1`,
                            [phoneNumber],
                            async (err, cliente) => {
                                if (err) {
                                    console.error(err);
                                    await client.sendMessage(message.from, '❌ Erro ao buscar status da assinatura.');
                                    return;
                                }

                                let statusMsg = `📊 *Status da Assinatura*\n\n`;
                                
                                if (cliente && cliente.status_assinatura === 'ativo') {
                                    const diasRestantes = Math.ceil((new Date(cliente.proximo_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
                                    statusMsg += `✅ Status: Ativo\n`;
                                    statusMsg += `📅 Vencimento: ${formatarData(cliente.proximo_vencimento)}\n`;
                                    statusMsg += `⏳ Dias restantes: ${diasRestantes}\n`;
                                    statusMsg += `💰 Valor atual: R$ ${formatMoney(cliente.valor_assinatura)}\n`;
                                    statusMsg += `📋 Plano: ${cliente.plano_nome || 'N/A'}\n`;
                                } else {
                                    statusMsg += `❌ Status: Inativo\n\n`;
                                    statusMsg += `Para ativar sua assinatura, selecione a opção *Renovar Assinatura* no menu.\n`;
                                }

                                await client.sendMessage(message.from, statusMsg);
                                await client.sendMessage(message.from, MENU_ASSINATURA);
                            }
                        );
                        break;

                    case '2':
                        // Renovar assinatura
                        db.all('SELECT * FROM planos WHERE ativo = 1', async (err, planos) => {
                            if (err) {
                                console.error(err);
                                await client.sendMessage(message.from, '❌ Erro ao buscar planos disponíveis.');
                                return;
                            }

                            let planosMsg = `*📦 Planos Disponíveis*\n\n`;
                            planos.forEach((plano, index) => {
                                planosMsg += `*${index + 1}.* ${plano.nome}\n`;
                                planosMsg += `💰 Valor: R$ ${formatMoney(plano.valor)}\n`;
                                planosMsg += `⏳ Duração: ${plano.duracao_dias} dias\n`;
                                planosMsg += `📝 ${plano.descricao}\n\n`;
                            });

                            planosMsg += `\nPara assinar, envie o número do plano desejado.`;
                            
                            userState.step = 'SELECIONAR_PLANO';
                            userState.planos = planos;
                            userStates.set(phoneNumber, userState);
                            
                            await client.sendMessage(message.from, planosMsg);
                        });
                        break;

                    case '3':
                        // Cancelar assinatura
                        userState.step = 'CONFIRMAR_CANCELAMENTO';
                        userStates.set(phoneNumber, userState);
                        await client.sendMessage(message.from, 
                            `⚠️ *ATENÇÃO* ⚠️\n\n` +
                            `Você está prestes a *CANCELAR* sua assinatura.\n` +
                            `Ao confirmar:\n` +
                            `- Seu acesso será limitado\n` +
                            `- Não haverá reembolso do período não utilizado\n\n` +
                            `Tem certeza que deseja cancelar?\n\n` +
                            `Digite *CONFIRMAR* para prosseguir ou qualquer outra coisa para cancelar.`);
                        break;

                    case '4':
                        await client.sendMessage(message.from, MENU_CONFIGURACOES);
                        userState.step = 'MENU_CONFIGURACOES';
                        userStates.set(phoneNumber, userState);
                        break;

                    default:
                        await client.sendMessage(message.from, '❌ Opção inválida.\n\n' + MENU_ASSINATURA);
                }
                break;

            case 'SELECIONAR_PLANO':
                const planoIndex = parseInt(message.body) - 1;
                if (isNaN(planoIndex) || !userState.planos || planoIndex < 0 || planoIndex >= userState.planos.length) {
                    await client.sendMessage(message.from, '❌ Opção inválida. Por favor, selecione um plano válido.');
                    return;
                }

                const planoSelecionado = userState.planos[planoIndex];
                userState.planoSelecionado = planoSelecionado;
                userState.step = 'CONFIRMAR_ASSINATURA';
                userStates.set(phoneNumber, userState);

                await client.sendMessage(message.from,
                    `*Confirmar Assinatura*\n\n` +
                    `Plano: ${planoSelecionado.nome}\n` +
                    `Valor: R$ ${formatMoney(planoSelecionado.valor)}\n` +
                    `Duração: ${planoSelecionado.duracao_dias} dias\n\n` +
                    `Para confirmar a assinatura, faça um PIX para a chave:\n` +
                    `📱 *CHAVE PIX AQUI*\n\n` +
                    `Após o pagamento, envie o comprovante como imagem.`);
                break;

            case 'CONFIRMAR_CANCELAMENTO':
                if (message.body.toUpperCase() === 'CONFIRMAR') {
                    db.run(
                        'UPDATE clientes SET status_assinatura = ?, plano = ? WHERE telefone = ?',
                        ['cancelado', 'free', phoneNumber],
                        async (err) => {
                            if (err) {
                                console.error(err);
                                await client.sendMessage(message.from, '❌ Erro ao cancelar assinatura.');
                                return;
                            }
                            await client.sendMessage(message.from, '✅ Assinatura cancelada com sucesso.');
                            await client.sendMessage(message.from, MENU_ASSINATURA);
                        }
                    );
                } else {
                    await client.sendMessage(message.from, '❌ Operação cancelada.');
                    await client.sendMessage(message.from, MENU_ASSINATURA);
                }
                userState.step = 'MENU_ASSINATURA';
                userStates.set(phoneNumber, userState);
                break;

            default:
                // Menu principal
                switch (message.body) {
                    case '1':
                        await client.sendMessage(message.from, MENU_VIAGENS);
                        userState.step = 'MENU_VIAGENS';
                        userStates.set(phoneNumber, userState);
                        break;
                    case '2':
                        await client.sendMessage(message.from, MENU_ABASTECIMENTOS);
                        userState.step = 'MENU_ABASTECIMENTOS';
                        userStates.set(phoneNumber, userState);
                        break;
                    case '3':
                        await commands['!ganhos'](client, message);
                        break;
                    case '4':
                        await commands['!stats'](client, message);
                        break;
                    case '5':
                        await client.sendMessage(message.from, MENU_CONFIGURACOES);
                        userState.step = 'MENU_CONFIGURACOES';
                        userStates.set(phoneNumber, userState);
                        break;
                    case '6':
                        await commands['!ajuda'](client, message);
                        break;
                    default:
                        await client.sendMessage(message.from, MENU_PRINCIPAL);
                }
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        await client.sendMessage(message.from, '❌ Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
    }
};

module.exports = handleMessage; 