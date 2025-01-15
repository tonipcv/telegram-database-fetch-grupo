require('dotenv').config();

const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cors = require('cors');

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

async function initializeDatabase() {
  try {
    await prisma.$connect();
    console.log('Conectado ao banco de dados via Prisma');
    
    // Tenta fazer uma consulta simples para verificar se as tabelas existem
    await prisma.tradeSignal.findFirst();
    console.log('Tabela TradeSignal existe e está acessível.');
    await prisma.message.findFirst();
    console.log('Tabela Message existe e está acessível.');
  } catch (error) {
    console.error('Erro ao conectar ou verificar o banco de dados:', error);
    throw error; // Propaga o erro para ser tratado na inicialização principal
  }
}

// Configuração do CORS
app.use(cors());

// Middleware para logar todas as atualizações
bot.use((ctx, next) => {
  console.log('Recebida atualização:', JSON.stringify(ctx.update, null, 2));
  return next();
});

bot.command('start', (ctx) => {
    console.log('Comando /start recebido');
    ctx.reply('Olá! Estou funcionando e pronto para salvar mensagens do grupo alvo.');
});

bot.on(['message', 'channel_post'], async (ctx) => {
    console.log('Mensagem ou post de canal recebido:', JSON.stringify(ctx.update, null, 2));
    
    const message = ctx.message || ctx.channelPost;
    const chat = ctx.chat;

    console.log('ID do chat atual:', chat.id);
    console.log('Tipo do chat:', chat.type);

    const targetId = process.env.TARGET_ID;
    console.log('ID alvo (do .env):', targetId);
    console.log('Tipo do ID alvo:', typeof targetId);

    if (!targetId) {
        console.error('TARGET_ID não está definido no arquivo .env');
        return;
    }

    if (chat.id.toString() !== targetId) {
        console.log(`Mensagem não é do alvo. Chat ID: ${chat.id}, Target ID: ${targetId}`);
        return;
    }

    console.log('Mensagem é do alvo. Processando...');

    try {
        console.log('Tentando salvar a mensagem no banco de dados...');
        console.log('Texto da mensagem:', message.text);
        
        // Salvar a mensagem no banco de dados com o messageId
        const savedMessage = await prisma.message.create({
            data: {
                text: message.text,
                messageId: message.message_id.toString()
            },
        });
        console.log('Mensagem salva com sucesso:', JSON.stringify(savedMessage, null, 2));
    } catch (error) {
        console.error('Erro ao processar a mensagem:', error);
        console.error('Stack trace:', error.stack);
    }
});

bot.on(['edited_message', 'edited_channel_post'], async (ctx) => {
    console.log('Mensagem editada recebida:', JSON.stringify(ctx.update, null, 2));
    
    const editedMessage = ctx.editedMessage || ctx.editedChannelPost;
    const chat = ctx.chat;

    console.log('ID do chat atual:', chat.id);
    console.log('Tipo do chat:', chat.type);

    const targetId = process.env.TARGET_ID;

    if (!targetId || chat.id.toString() !== targetId) {
        console.log(`Mensagem não é do alvo. Chat ID: ${chat.id}, Target ID: ${targetId}`);
        return;
    }

    try {
        console.log('Tentando atualizar a mensagem no banco de dados...');
        console.log('Novo texto da mensagem:', editedMessage.text);
        
        // Primeiro, encontrar a mensagem usando messageId
        const existingMessage = await prisma.message.findUnique({
            where: {
                messageId: editedMessage.message_id.toString()
            }
        });

        if (!existingMessage) {
            console.log('Mensagem não encontrada no banco de dados');
            return;
        }

        // Atualizar a mensagem usando o ID
        const updatedMessage = await prisma.message.update({
            where: {
                id: existingMessage.id
            },
            data: {
                text: editedMessage.text
            }
        });

        console.log('Mensagem atualizada com sucesso:', JSON.stringify(updatedMessage, null, 2));
    } catch (error) {
        console.error('Erro ao atualizar a mensagem:', error);
        console.error('Stack trace:', error.stack);
    }
});

bot.on('polling_error', (error) => {
  console.error('Erro de polling:', error);
});

bot.catch((err) => {
  console.error('Erro no bot:', err);
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limita a 100 mensagens mais recentes
    });
    res.json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicione a nova rota aqui
app.get('/messages/text', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      select: {
        text: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limita a 100 mensagens mais recentes
    });
    const textOnly = messages.map(message => message.text);
    res.json(textOnly);
  } catch (error) {
    console.error('Erro ao buscar textos das mensagens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`API rodando na porta ${server.address().port}`);
      resolve(server);
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Porta ${PORT} já está em uso. Tentando a próxima...`);
        server.close();
        startServer(PORT + 1).then(resolve).catch(reject);
      } else {
        reject(error);
      }
    });
  });
}

async function main() {
  try {
    await initializeDatabase();
    const server = await startServer();
    await bot.launch();
    console.log('Bot iniciado, conectado ao banco de dados e servidor Express rodando');

    // Encerrar o bot e fechar a conexão do Prisma quando o processo for encerrado
    process.on('SIGINT', async () => {
      bot.stop('SIGINT');
      await prisma.$disconnect();
      server.close(() => {
        console.log('Servidor HTTP fechado');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Erro na inicialização:', error);
    process.exit(1);
  }
}

main();
