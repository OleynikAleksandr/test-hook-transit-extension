import * as vscode from 'vscode';
import * as express from 'express';
import { Request, Response } from 'express';

let server: any = null;
let outputChannel: vscode.OutputChannel;
let hookEnabled = false;
let originalEnvValue: string | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Roo Hook Tester v4 extension is now active!');
    
    // Создаем канал вывода для логов
    outputChannel = vscode.window.createOutputChannel('Roo Hook Tester v4');
    outputChannel.show();
    outputChannel.appendLine('🚀 Roo Hook Tester v6 активирован!');
    outputChannel.appendLine(`📍 Время: ${new Date().toISOString()}`);
    
    // Сохраняем оригинальное значение переменной окружения
    originalEnvValue = process.env.ROO_HOOK_URL;
    
    // Создаем HTTP сервер для получения хуков
    const app = express();
    app.use(express.json({ limit: '50mb' }));

    // Главный обработчик хука
    app.post('/', (req: Request, res: Response) => {
        outputChannel.appendLine('\n=== 📥 ПЕРЕХВАЧЕН ЗАПРОС К AI ===');
        outputChannel.appendLine(`Время: ${new Date().toISOString()}`);
        outputChannel.appendLine(`Request type: ${req.body.type}`);
        
        if (req.body.type === 'api_request' && req.body.data) {
            const data = req.body.data;
            const lastMessage = data.messages?.[data.messages.length - 1];
            
            // Правильно обрабатываем content - может быть строкой или массивом объектов
            let contentText = '';
            if (lastMessage) {
                if (typeof lastMessage.content === 'string') {
                    contentText = lastMessage.content;
                } else if (Array.isArray(lastMessage.content)) {
                    // Извлекаем только текстовые части
                    contentText = lastMessage.content
                        .filter((item: any) => item.type === 'text')
                        .map((item: any) => item.text)
                        .join(' ');
                } else {
                    contentText = JSON.stringify(lastMessage.content);
                }
                
                outputChannel.appendLine(`\n📝 СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:`);
                outputChannel.appendLine(`"${contentText}"`);
            }
            
            // Показываем уведомление  
            vscode.window.showInformationMessage(
                `🎯 Перехвачено: "${contentText.substring(0, 50)}..."`
            );
            
            // Формируем прямой ответ от hook (БЕЗ обращения к AI!)
            const directResponse = `🤖 ЭТО ОТВЕТ ОТ HOOK-РАСШИРЕНИЯ!

Я перехватил ваше сообщение: "${contentText}"

Это сообщение НЕ от AI модели, а от вашего локального расширения.
Хук работает корректно! 

Детали перехвата:
- Время: ${new Date().toISOString()}
- Длина оригинального системного промпта: ${data.systemPrompt?.length || 0} символов
- Количество сообщений в истории: ${data.messages?.length || 0}
- Hook версия: v6

🚫 ЗАПРОС К AI ЗАБЛОКИРОВАН! 🚫
Этот ответ создан локально без обращения к AI провайдеру.

Если вы видите это сообщение - значит перехват работает! 🎉`;

            outputChannel.appendLine('\n🚫 БЛОКИРУЮ ЗАПРОС К AI И ВОЗВРАЩАЮ ПРЯМОЙ ОТВЕТ');
            
            // Возвращаем прямой ответ (блокируем AI)
            res.json({
                directResponse: directResponse,
                modifiedMetadata: {
                    ...data.metadata,
                    hookIntercepted: true,
                    hookVersion: 'v6',
                    interceptTime: new Date().toISOString(),
                    aiBlocked: true
                }
            });
            
        } else {
            outputChannel.appendLine('⚠️ Неизвестный формат запроса');
            res.json({ passthrough: true });
        }
    });

    // Запускаем сервер
    const startServer = () => {
        try {
            server = app.listen(3000, () => {
                outputChannel.appendLine('\n✅ Hook server запущен на порту 3000');
                vscode.window.showInformationMessage('✅ Hook Server запущен');
            });
            
            server.on('error', (error: any) => {
                outputChannel.appendLine(`❌ Ошибка сервера: ${error.message}`);
                if (error.code === 'EADDRINUSE') {
                    vscode.window.showErrorMessage('❌ Порт 3000 уже занят!');
                }
            });
            
        } catch (error: any) {
            outputChannel.appendLine(`❌ Не удалось запустить сервер: ${error.message}`);
            vscode.window.showErrorMessage(`❌ Ошибка: ${error.message}`);
        }
    };

    // Функция активации хука
    const activateHook = () => {
        if (!hookEnabled) {
            // Определяем правильный URL для WSL окружения
            // В WSL Windows хост доступен через IP шлюза
            const hookUrl = process.platform === 'win32' ? 'http://localhost:3000' : 'http://172.21.240.1:3000';
            
            // Устанавливаем переменную окружения глобально для всех процессов VS Code
            process.env.ROO_HOOK_URL = hookUrl;
            
            // Также пытаемся установить через vscode.env (если доступно)
            try {
                // Уведомляем все расширения о новой переменной
                vscode.commands.executeCommand('setContext', 'roo.hookUrl', hookUrl);
            } catch (e) {
                outputChannel.appendLine(`⚠️ Не удалось установить контекст: ${e}`);
            }
            hookEnabled = true;
            
            outputChannel.appendLine('\n🔥 ХУК АКТИВИРОВАН!');
            outputChannel.appendLine(`Platform: ${process.platform}`);
            outputChannel.appendLine(`ROO_HOOK_URL = ${process.env.ROO_HOOK_URL}`);
            
            vscode.window.showInformationMessage(
                '🔥 Hook активирован! Все запросы к AI будут перехвачены.',
                'OK'
            );
            
            // Запускаем сервер если не запущен
            if (!server) {
                startServer();
            }
        }
    };

    // Функция деактивации хука
    const deactivateHook = () => {
        if (hookEnabled) {
            // Восстанавливаем оригинальное значение
            if (originalEnvValue) {
                process.env.ROO_HOOK_URL = originalEnvValue;
            } else {
                delete process.env.ROO_HOOK_URL;
            }
            hookEnabled = false;
            
            outputChannel.appendLine('\n🛑 ХУК ДЕАКТИВИРОВАН!');
            outputChannel.appendLine(`ROO_HOOK_URL = ${process.env.ROO_HOOK_URL || 'удалена'}`);
            
            vscode.window.showInformationMessage(
                '🛑 Hook деактивирован. Roo Code работает в обычном режиме.'
            );
        }
    };

    // Команда для запуска хука
    let startCommand = vscode.commands.registerCommand('roo-hook-tester.start', () => {
        outputChannel.appendLine('\n▶️ Команда: Start Hook');
        activateHook();
    });

    // Команда для остановки хука
    let stopCommand = vscode.commands.registerCommand('roo-hook-tester.stop', () => {
        outputChannel.appendLine('\n⏹️ Команда: Stop Hook');
        deactivateHook();
        
        // Останавливаем сервер
        if (server) {
            server.close();
            server = null;
            outputChannel.appendLine('🛑 Сервер остановлен');
        }
    });

    // Команда для проверки статуса
    let statusCommand = vscode.commands.registerCommand('roo-hook-tester.status', () => {
        outputChannel.appendLine('\n📊 СТАТУС:');
        outputChannel.appendLine(`- Hook активен: ${hookEnabled ? 'ДА ✅' : 'НЕТ ❌'}`);
        outputChannel.appendLine(`- Сервер запущен: ${server ? 'ДА ✅' : 'НЕТ ❌'}`);
        outputChannel.appendLine(`- ROO_HOOK_URL: ${process.env.ROO_HOOK_URL || 'не установлена'}`);
        
        const status = hookEnabled ? '✅ Hook активен' : '❌ Hook не активен';
        vscode.window.showInformationMessage(`Статус: ${status}`);
    });

    // Команда для очистки логов
    let clearCommand = vscode.commands.registerCommand('roo-hook-tester.clear', () => {
        outputChannel.clear();
        outputChannel.appendLine('🧹 Логи очищены');
    });

    // Автоматически активируем хук при старте (опционально)
    const autoStart = context.globalState.get<boolean>('autoStartHook', false);
    if (autoStart) {
        outputChannel.appendLine('\n🤖 Автозапуск хука...');
        activateHook();
    }

    // Команда для переключения автозапуска
    let toggleAutoStartCommand = vscode.commands.registerCommand('roo-hook-tester.toggleAutoStart', async () => {
        const current = context.globalState.get<boolean>('autoStartHook', false);
        await context.globalState.update('autoStartHook', !current);
        vscode.window.showInformationMessage(
            `Автозапуск хука: ${!current ? 'включен ✅' : 'выключен ❌'}`
        );
    });

    context.subscriptions.push(
        startCommand, 
        stopCommand, 
        statusCommand, 
        clearCommand, 
        toggleAutoStartCommand, 
        outputChannel
    );

    // Показываем инструкцию при старте
    vscode.window.showInformationMessage(
        'Roo Hook v6 готов! Используйте Ctrl+Shift+P → "Start Hook"',
        'Запустить сейчас'
    ).then(selection => {
        if (selection === 'Запустить сейчас') {
            vscode.commands.executeCommand('roo-hook-tester.start');
        }
    });
}

export function deactivate() {
    if (server) {
        server.close();
        server = null;
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
    // Восстанавливаем оригинальное значение переменной
    if (originalEnvValue) {
        process.env.ROO_HOOK_URL = originalEnvValue;
    } else {
        delete process.env.ROO_HOOK_URL;
    }
}