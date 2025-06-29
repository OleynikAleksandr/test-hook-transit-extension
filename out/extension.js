"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const express = require("express");
const fs = require("fs");
const path = require("path");
let server = null;
let outputChannel;
let hookEnabled = false;
let originalEnvValue;
let capturedRequests = new Set(); // Кэш для предотвращения дублей
function activate(context) {
    console.log('Roo Hook Transit Extension v1 is now active!');
    // Создаем канал вывода для логов
    outputChannel = vscode.window.createOutputChannel('Roo Hook Transit Extension');
    outputChannel.show();
    outputChannel.appendLine('🚀 Roo Hook Transit Extension v1 активирован!');
    outputChannel.appendLine(`📍 Время: ${new Date().toISOString()}`);
    // Сохраняем оригинальное значение переменной окружения
    originalEnvValue = process.env.ROO_HOOK_URL;
    // Создаем HTTP сервер для получения хуков
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    // Главный обработчик хука - старый API (версии 3.22.0)
    app.post('/', (req, res) => {
        outputChannel.appendLine('\n=== 📥 ПЕРЕХВАЧЕН ЗАПРОС К AI ===');
        outputChannel.appendLine(`Время: ${new Date().toISOString()}`);
        outputChannel.appendLine(`Request type: ${req.body.type}`);
        if (req.body.type === 'api_request' && req.body.data) {
            // 🎯 ПРОВЕРЯЕМ НАЛИЧИЕ MOCK ФАЙЛА
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const mockFilePath = path.join(workspaceRoot, 'mock-request.json');
            if (fs.existsSync(mockFilePath)) {
                outputChannel.appendLine('\n🎭 НАЙДЕН MOCK ФАЙЛ - ИСПОЛЬЗУЕМ MOCK!');
                try {
                    const mockData = JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
                    outputChannel.appendLine(`📄 Mock системный промпт: ${mockData.data.systemPrompt.length} символов`);
                    outputChannel.appendLine(`📄 Mock сообщения: ${mockData.data.messages.length} шт.`);
                    outputChannel.appendLine(`📄 Mock метаданные: ${JSON.stringify(mockData.data.metadata)}`);
                    // Возвращаем MOCK данные вместо оригинальных
                    res.json({
                        modifiedSystemPrompt: mockData.data.systemPrompt,
                        modifiedMessages: mockData.data.messages,
                        modifiedMetadata: {
                            ...mockData.data.metadata,
                            hookIntercepted: true,
                            hookVersion: 'transit-mock-v1.3',
                            mode: 'MOCK_OVERRIDE',
                            mockFile: 'mock-request.json'
                        }
                    });
                    vscode.window.showInformationMessage('🎭 MOCK режим активен!');
                    return;
                }
                catch (error) {
                    outputChannel.appendLine(`❌ Ошибка чтения mock файла: ${error.message}`);
                    vscode.window.showErrorMessage(`Ошибка mock файла: ${error.message}`);
                    // Продолжаем с оригинальными данными
                }
            }
            // 📡 ОБЫЧНЫЙ РЕЖИМ - если нет mock файла или ошибка
            const data = req.body.data;
            const lastMessage = data.messages?.[data.messages.length - 1];
            // Правильно обрабатываем content - может быть строкой или массивом объектов
            let contentText = '';
            if (lastMessage) {
                if (typeof lastMessage.content === 'string') {
                    contentText = lastMessage.content;
                }
                else if (Array.isArray(lastMessage.content)) {
                    // Извлекаем только текстовые части
                    contentText = lastMessage.content
                        .filter((item) => item.type === 'text')
                        .map((item) => item.text)
                        .join(' ');
                }
                else {
                    contentText = JSON.stringify(lastMessage.content);
                }
                outputChannel.appendLine(`\n📝 СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:`);
                outputChannel.appendLine(`"${contentText}"`);
            }
            // Показываем уведомление  
            vscode.window.showInformationMessage(`🎯 Перехвачено: "${contentText.substring(0, 50)}..."`);
            // 💾 ТРАНЗИТНЫЙ РЕЖИМ - СОХРАНЯЕМ ВСЕ БЕЗ ИЗМЕНЕНИЙ
            const originalSystemPrompt = data.systemPrompt || '';
            // 🔒 ОДНОКРАТНАЯ ЗАПИСЬ - проверяем дубли
            const requestHash = contentText + '|' + originalSystemPrompt.length;
            if (capturedRequests.has(requestHash)) {
                outputChannel.appendLine('⚠️ ДУБЛИКАТ ЗАПРОСА - пропускаем сохранение');
                // Возвращаем данные без сохранения
                res.json({
                    modifiedSystemPrompt: originalSystemPrompt,
                    modifiedMessages: data.messages,
                    modifiedMetadata: {
                        ...data.metadata,
                        hookIntercepted: true,
                        hookVersion: 'transit-passthrough-v1.1',
                        mode: 'PASSTHROUGH_DUPLICATE_SKIPPED'
                    }
                });
                return;
            }
            // 📝 ПРОВЕРКА НА ПУСТЫЕ ДАННЫЕ
            if (!originalSystemPrompt || originalSystemPrompt.length < 100) {
                outputChannel.appendLine('⚠️ ПУСТОЙ СИСТЕМНЫЙ ПРОМПТ - пропускаем сохранение');
                res.json({ passthrough: true });
                return;
            }
            if (!contentText || contentText.length < 5) {
                outputChannel.appendLine('⚠️ ПУСТОЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ - пропускаем сохранение');
                res.json({ passthrough: true });
                return;
            }
            try {
                // Добавляем в кэш для предотвращения дублей
                capturedRequests.add(requestHash);
                // Сохраняем полный системный промпт в корень воркспейса
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                // Файл для системного промпта
                const systemPromptFile = path.join(workspaceRoot, `captured-system-prompt-${timestamp}.txt`);
                fs.writeFileSync(systemPromptFile, originalSystemPrompt, 'utf8');
                // Файл для запроса пользователя  
                const userRequestFile = path.join(workspaceRoot, `captured-user-request-${timestamp}.txt`);
                fs.writeFileSync(userRequestFile, contentText, 'utf8');
                // Файл для всех сообщений (JSON) - только если есть данные
                if (data.messages && data.messages.length > 0) {
                    const allMessagesFile = path.join(workspaceRoot, `captured-all-messages-${timestamp}.json`);
                    fs.writeFileSync(allMessagesFile, JSON.stringify(data.messages, null, 2), 'utf8');
                }
                // Файл для метаданных - только если есть данные
                if (data.metadata && Object.keys(data.metadata).length > 0) {
                    const metadataFile = path.join(workspaceRoot, `captured-metadata-${timestamp}.json`);
                    fs.writeFileSync(metadataFile, JSON.stringify(data.metadata, null, 2), 'utf8');
                }
                outputChannel.appendLine('\n💾 ФАЙЛЫ СОХРАНЕНЫ (ОДНОКРАТНО):');
                outputChannel.appendLine(`- Системный промпт: captured-system-prompt-${timestamp}.txt`);
                outputChannel.appendLine(`- Запрос пользователя: captured-user-request-${timestamp}.txt`);
                outputChannel.appendLine(`- Хэш запроса: ${requestHash.substring(0, 20)}...`);
                vscode.window.showInformationMessage(`💾 Данные сохранены ОДНОКРАТНО: ${timestamp}`);
                // Очищаем кэш старых запросов (оставляем только последние 10)
                if (capturedRequests.size > 10) {
                    const oldEntries = Array.from(capturedRequests).slice(0, capturedRequests.size - 10);
                    oldEntries.forEach(entry => capturedRequests.delete(entry));
                }
            }
            catch (error) {
                outputChannel.appendLine(`❌ Ошибка сохранения: ${error.message}`);
            }
            outputChannel.appendLine('\n🚀 ТРАНЗИТНЫЙ РЕЖИМ - ПЕРЕДАЕМ БЕЗ ИЗМЕНЕНИЙ');
            outputChannel.appendLine(`Системный промпт: ${originalSystemPrompt.length} символов`);
            outputChannel.appendLine(`Сообщения пользователя: ${data.messages?.length || 0} шт.`);
            // Возвращаем ОРИГИНАЛЬНЫЕ данные без изменений (транзитный режим)
            res.json({
                modifiedSystemPrompt: originalSystemPrompt,
                modifiedMessages: data.messages,
                modifiedMetadata: {
                    ...data.metadata,
                    hookIntercepted: true,
                    hookVersion: 'transit-passthrough-v1',
                    interceptTime: new Date().toISOString(),
                    mode: 'PASSTHROUGH_WITH_CAPTURE'
                }
            });
        }
        else {
            outputChannel.appendLine('⚠️ Неизвестный формат запроса');
            res.json({ passthrough: true });
        }
    });
    // Новый обработчик хука для версий 3.22.5+ (новый API endpoint)
    app.post('/api/hook', (req, res) => {
        outputChannel.appendLine('\n=== 📥 ПЕРЕХВАЧЕН ЗАПРОС К AI (NEW API) ===');
        outputChannel.appendLine(`Время: ${new Date().toISOString()}`);
        outputChannel.appendLine(`Новый формат данных (прямой):`);
        // В новом API данные приходят напрямую, без обертки {type: 'api_request', data: ...}
        const data = req.body;
        if (data && data.systemPrompt) {
            // 🎯 ПРОВЕРЯЕМ НАЛИЧИЕ MOCK ФАЙЛА
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const mockFilePath = path.join(workspaceRoot, 'mock-request.json');
            if (fs.existsSync(mockFilePath)) {
                outputChannel.appendLine('\n🎭 НАЙДЕН MOCK ФАЙЛ - ИСПОЛЬЗУЕМ MOCK!');
                try {
                    const mockData = JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
                    outputChannel.appendLine(`📄 Mock системный промпт: ${mockData.data.systemPrompt.length} символов`);
                    outputChannel.appendLine(`📄 Mock сообщения: ${mockData.data.messages.length} шт.`);
                    outputChannel.appendLine(`📄 Mock метаданные: ${JSON.stringify(mockData.data.metadata)}`);
                    // Возвращаем MOCK данные в новом формате (без обертки)
                    res.json({
                        modifiedSystemPrompt: mockData.data.systemPrompt,
                        modifiedMessages: mockData.data.messages,
                        modifiedMetadata: {
                            ...mockData.data.metadata,
                            hookIntercepted: true,
                            hookVersion: 'transit-mock-v1.4-new-api',
                            mode: 'MOCK_OVERRIDE',
                            mockFile: 'mock-request.json'
                        }
                    });
                    vscode.window.showInformationMessage('🎭 MOCK режим активен!');
                    return;
                }
                catch (error) {
                    outputChannel.appendLine(`❌ Ошибка чтения mock файла: ${error.message}`);
                    vscode.window.showErrorMessage(`Ошибка mock файла: ${error.message}`);
                    // Продолжаем с оригинальными данными
                }
            }
            // 📡 ОБЫЧНЫЙ РЕЖИМ - если нет mock файла или ошибка
            const lastMessage = data.messages?.[data.messages.length - 1];
            // Правильно обрабатываем content - может быть строкой или массивом объектов
            let contentText = '';
            if (lastMessage) {
                if (typeof lastMessage.content === 'string') {
                    contentText = lastMessage.content;
                }
                else if (Array.isArray(lastMessage.content)) {
                    // Извлекаем только текстовые части
                    contentText = lastMessage.content
                        .filter((item) => item.type === 'text')
                        .map((item) => item.text)
                        .join(' ');
                }
                else {
                    contentText = JSON.stringify(lastMessage.content);
                }
                outputChannel.appendLine(`\n📝 СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:`);
                outputChannel.appendLine(`"${contentText}"`);
            }
            // Показываем уведомление  
            vscode.window.showInformationMessage(`🎯 Перехвачено (NEW API): "${contentText.substring(0, 50)}..."`);
            // 💾 ТРАНЗИТНЫЙ РЕЖИМ - СОХРАНЯЕМ ВСЕ БЕЗ ИЗМЕНЕНИЙ
            const originalSystemPrompt = data.systemPrompt || '';
            // 🔒 ОДНОКРАТНАЯ ЗАПИСЬ - проверяем дубли
            const requestHash = contentText + '|' + originalSystemPrompt.length;
            if (capturedRequests.has(requestHash)) {
                outputChannel.appendLine('⚠️ ДУБЛИКАТ ЗАПРОСА - пропускаем сохранение');
                // Возвращаем данные без сохранения
                res.json({
                    modifiedSystemPrompt: originalSystemPrompt,
                    modifiedMessages: data.messages,
                    modifiedMetadata: {
                        ...data.metadata,
                        hookIntercepted: true,
                        hookVersion: 'transit-passthrough-v1.4-new-api',
                        mode: 'PASSTHROUGH_DUPLICATE_SKIPPED'
                    }
                });
                return;
            }
            // 📝 ПРОВЕРКА НА ПУСТЫЕ ДАННЫЕ
            if (!originalSystemPrompt || originalSystemPrompt.length < 100) {
                outputChannel.appendLine('⚠️ ПУСТОЙ СИСТЕМНЫЙ ПРОМПТ - пропускаем сохранение');
                res.json({ passthrough: true });
                return;
            }
            if (!contentText || contentText.length < 5) {
                outputChannel.appendLine('⚠️ ПУСТОЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ - пропускаем сохранение');
                res.json({ passthrough: true });
                return;
            }
            try {
                // Добавляем в кэш для предотвращения дублей
                capturedRequests.add(requestHash);
                // Сохраняем полный системный промпт в корень воркспейса
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                // Файл для системного промпта
                const systemPromptFile = path.join(workspaceRoot, `captured-system-prompt-${timestamp}.txt`);
                fs.writeFileSync(systemPromptFile, originalSystemPrompt, 'utf8');
                // Файл для запроса пользователя  
                const userRequestFile = path.join(workspaceRoot, `captured-user-request-${timestamp}.txt`);
                fs.writeFileSync(userRequestFile, contentText, 'utf8');
                // Файл для всех сообщений (JSON) - только если есть данные
                if (data.messages && data.messages.length > 0) {
                    const allMessagesFile = path.join(workspaceRoot, `captured-all-messages-${timestamp}.json`);
                    fs.writeFileSync(allMessagesFile, JSON.stringify(data.messages, null, 2), 'utf8');
                }
                // Файл для метаданных - только если есть данные
                if (data.metadata && Object.keys(data.metadata).length > 0) {
                    const metadataFile = path.join(workspaceRoot, `captured-metadata-${timestamp}.json`);
                    fs.writeFileSync(metadataFile, JSON.stringify(data.metadata, null, 2), 'utf8');
                }
                outputChannel.appendLine('\n💾 ФАЙЛЫ СОХРАНЕНЫ (ОДНОКРАТНО):');
                outputChannel.appendLine(`- Системный промпт: captured-system-prompt-${timestamp}.txt`);
                outputChannel.appendLine(`- Запрос пользователя: captured-user-request-${timestamp}.txt`);
                outputChannel.appendLine(`- Хэш запроса: ${requestHash.substring(0, 20)}...`);
                vscode.window.showInformationMessage(`💾 Данные сохранены ОДНОКРАТНО: ${timestamp}`);
                // Очищаем кэш старых запросов (оставляем только последние 10)
                if (capturedRequests.size > 10) {
                    const oldEntries = Array.from(capturedRequests).slice(0, capturedRequests.size - 10);
                    oldEntries.forEach(entry => capturedRequests.delete(entry));
                }
            }
            catch (error) {
                outputChannel.appendLine(`❌ Ошибка сохранения: ${error.message}`);
            }
            outputChannel.appendLine('\n🚀 ТРАНЗИТНЫЙ РЕЖИМ - ПЕРЕДАЕМ БЕЗ ИЗМЕНЕНИЙ');
            outputChannel.appendLine(`Системный промпт: ${originalSystemPrompt.length} символов`);
            outputChannel.appendLine(`Сообщения пользователя: ${data.messages?.length || 0} шт.`);
            // Возвращаем ОРИГИНАЛЬНЫЕ данные без изменений (транзитный режим)
            res.json({
                modifiedSystemPrompt: originalSystemPrompt,
                modifiedMessages: data.messages,
                modifiedMetadata: {
                    ...data.metadata,
                    hookIntercepted: true,
                    hookVersion: 'transit-passthrough-v1.4-new-api',
                    interceptTime: new Date().toISOString(),
                    mode: 'PASSTHROUGH_WITH_CAPTURE'
                }
            });
        }
        else {
            outputChannel.appendLine('⚠️ Неизвестный формат запроса (новый API)');
            res.json({ passthrough: true });
        }
    });
    // Функция запуска сервера
    const startServer = () => {
        try {
            server = app.listen(3000, () => {
                outputChannel.appendLine('🌐 Сервер запущен на порту 3000');
                outputChannel.appendLine('📡 Готов к приему хуков от Roo Code');
            });
            server.on('error', (error) => {
                outputChannel.appendLine(`❌ Ошибка сервера: ${error.message}`);
                vscode.window.showErrorMessage(`Ошибка запуска сервера: ${error.message}`);
            });
        }
        catch (error) {
            outputChannel.appendLine(`❌ Не удалось запустить сервер: ${error.message}`);
            vscode.window.showErrorMessage(`Не удалось запустить сервер: ${error.message}`);
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
            }
            catch (e) {
                outputChannel.appendLine(`⚠️ Не удалось установить контекст: ${e}`);
            }
            hookEnabled = true;
            outputChannel.appendLine('\n🔥 ХУК АКТИВИРОВАН!');
            outputChannel.appendLine(`Platform: ${process.platform}`);
            outputChannel.appendLine(`ROO_HOOK_URL = ${process.env.ROO_HOOK_URL}`);
            vscode.window.showInformationMessage('🔥 Hook активирован! Все запросы к AI будут перехвачены.', 'OK');
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
            }
            else {
                delete process.env.ROO_HOOK_URL;
            }
            hookEnabled = false;
            outputChannel.appendLine('\n🛑 ХУК ДЕАКТИВИРОВАН!');
            outputChannel.appendLine(`ROO_HOOK_URL = ${process.env.ROO_HOOK_URL || 'удалена'}`);
            vscode.window.showInformationMessage('🛑 Hook деактивирован. Roo Code работает в обычном режиме.');
        }
    };
    // Команда для запуска хука
    let startCommand = vscode.commands.registerCommand('roo-hook-transit.start', () => {
        outputChannel.appendLine('\n▶️ Команда: Start Hook');
        activateHook();
    });
    // Команда для остановки хука
    let stopCommand = vscode.commands.registerCommand('roo-hook-transit.stop', () => {
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
    let statusCommand = vscode.commands.registerCommand('roo-hook-transit.status', () => {
        outputChannel.appendLine('\n📊 СТАТУС:');
        outputChannel.appendLine(`- Hook активен: ${hookEnabled ? 'ДА ✅' : 'НЕТ ❌'}`);
        outputChannel.appendLine(`- Сервер запущен: ${server ? 'ДА ✅' : 'НЕТ ❌'}`);
        outputChannel.appendLine(`- ROO_HOOK_URL: ${process.env.ROO_HOOK_URL || 'не установлена'}`);
        const status = hookEnabled ? '✅ Hook активен' : '❌ Hook не активен';
        vscode.window.showInformationMessage(`Статус: ${status}`);
    });
    // Команда для очистки логов
    let clearCommand = vscode.commands.registerCommand('roo-hook-transit.clear', () => {
        outputChannel.clear();
        outputChannel.appendLine('🧹 Логи очищены');
    });
    // Автоматически активируем хук при старте (опционально)
    const autoStart = context.globalState.get('autoStartHook', false);
    if (autoStart) {
        outputChannel.appendLine('\n🤖 Автозапуск хука...');
        activateHook();
    }
    // Команда для сброса сессии - теперь очищает кэш запросов
    let resetSessionCommand = vscode.commands.registerCommand('roo-hook-transit.resetSession', () => {
        capturedRequests.clear();
        outputChannel.appendLine('\n🔄 КЭШ ЗАПРОСОВ ОЧИЩЕН');
        vscode.window.showInformationMessage('🔄 Кэш запросов очищен');
    });
    // Команда для переключения автозапуска
    let toggleAutoStartCommand = vscode.commands.registerCommand('roo-hook-transit.toggleAutoStart', async () => {
        const current = context.globalState.get('autoStartHook', false);
        await context.globalState.update('autoStartHook', !current);
        vscode.window.showInformationMessage(`Автозапуск ${!current ? 'включен' : 'выключен'}`);
    });
    // Регистрируем команды для очистки
    context.subscriptions.push(startCommand, stopCommand, statusCommand, clearCommand, resetSessionCommand, toggleAutoStartCommand);
}
exports.activate = activate;
function deactivate() {
    if (server) {
        server.close();
        server = null;
    }
    // Восстанавливаем оригинальное значение переменной окружения
    if (originalEnvValue) {
        process.env.ROO_HOOK_URL = originalEnvValue;
    }
    else {
        delete process.env.ROO_HOOK_URL;
    }
    console.log('Roo Hook Transit Extension deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map