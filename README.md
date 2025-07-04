# 🔄 Roo Hook Transit Extension - VS Code Extension

## 📋 Описание

VS Code расширение для экспериментов с динамической фильтрацией промптов в Roo Code. Поддерживает несколько режимов работы: от полного перехвата до умной замены системных промптов заранее подготовленными вариантами.

## 🎯 Основные возможности

- ✅ **Транзитный режим** - сохранение оригинальных запросов без изменений
- ✅ **Mock режим** - замена запросов заранее подготовленными вариантами
- ✅ **Однократная запись** - предотвращение дублей при сохранении
- ✅ **Умная фильтрация** - тестирование сокращенных системных промптов
- ✅ **Детальное логирование** - полная диагностика процесса

## 🚀 Установка

### Быстрая установка:
1. Скачайте последнюю версию из `releases/`
2. В VS Code: `Ctrl+Shift+P`
3. `Extensions: Install from VSIX`
4. Выберите файл: `roo-hook-transit-0.1.3.vsix`

### Сборка из исходников:
```bash
cd /mnt/d/RooCodeHook/test-hook-transit-extension
npm install
npm run compile
./build-v4.sh
```

## 🔧 Команды

| Команда | Описание |
|---------|----------|
| `Start Roo Hook` | Активировать hook сервер |
| `Stop Roo Hook` | Деактивировать hook |
| `Roo Hook Status` | Проверить статус |
| `Clear Roo Hook Logs` | Очистить логи |
| `Toggle Auto Start Hook` | Включить/выключить автозапуск |

## 📊 Режимы работы

### 1. 🎭 Mock режим (приоритетный)
Если в корне воркспейса есть файл `mock-request.json`, extension использует его вместо оригинального запроса.

**Пример использования:**
```bash
# Файл mock-request.json уже создан и содержит:
# - Системный промпт только с read_file инструментом  
# - Запрос о чтении README.md
# - Environment_details только с одним файлом
# - Экономия: ~90% размера промпта
```

### 2. 💾 Транзитный режим (по умолчанию)
Сохраняет оригинальные запросы в файлы для анализа:
- `captured-system-prompt-{timestamp}.txt`
- `captured-user-request-{timestamp}.txt`  
- `captured-all-messages-{timestamp}.json`
- `captured-metadata-{timestamp}.json`

## 🧪 Тестирование динамической фильтрации

### Сценарий 1: Тест минимального промпта
1. Убедитесь что `mock-request.json` существует
2. Активируйте hook: `Start Roo Hook`
3. Задайте любой вопрос в Roo Code
4. AI получит только инструмент `read_file` вместо 20+ инструментов

### Сценарий 2: Анализ оригинальных запросов  
1. Удалите `mock-request.json` (если есть)
2. Активируйте hook: `Start Roo Hook`
3. Задайте вопрос в Roo Code
4. Анализируйте сохраненные файлы `captured-*`

## 📋 Логи и диагностика

**Просмотр логов:**
1. `View → Output` (или `Ctrl+Shift+U`)
2. Выберите: `Roo Hook Transit Extension`

**Примеры логов:**

**Mock режим:**
```
🎭 НАЙДЕН MOCK ФАЙЛ - ИСПОЛЬЗУЕМ ЕГО ВМЕСТО ОРИГИНАЛА!
📄 Mock системный промпт: 4500 символов
📄 Mock сообщения: 1 шт.
🎭 MOCK режим активен!
```

**Транзитный режим:**
```
💾 ФАЙЛЫ СОХРАНЕНЫ (ОДНОКРАТНО):
- Системный промпт: captured-system-prompt-2025-06-28T18-09-20-862Z.txt
- Запрос пользователя: captured-user-request-2025-06-28T18-09-20-862Z.txt
```

## 🛠️ Структура проекта

```
test-hook-transit-extension/
├── src/
│   └── extension.ts           # Основной код с логикой режимов
├── out/
│   └── extension.js           # Скомпилированный код
├── releases/
│   ├── roo-hook-transit-0.1.0.vsix  # Оригинальная версия
│   ├── roo-hook-transit-0.1.1.vsix  # Транзитный режим
│   ├── roo-hook-transit-0.1.2.vsix  # Однократная запись
│   └── roo-hook-transit-0.1.3.vsix  # Mock режим ✨
├── package.json               # Конфигурация
├── CHANGELOG.md              # История изменений
└── README.md                 # Эта документация
```

## 📝 Технические детали

### Формат mock-request.json:
```json
{
  "type": "api_request",
  "data": {
    "systemPrompt": "Сокращенный промпт только с read_file",
    "messages": [
      {
        "role": "user", 
        "content": [
          {"type": "text", "text": "Запрос пользователя"},
          {"type": "text", "text": "environment_details с одним файлом"}
        ]
      }
    ],
    "metadata": {"mode": "code", "taskId": "mock-experiment"}
  }
}
```

### Hook Response формат:
```json
{
  "modifiedSystemPrompt": "Системный промпт",
  "modifiedMessages": "Сообщения",
  "modifiedMetadata": {
    "hookIntercepted": true,
    "hookVersion": "transit-mock-v1.3",
    "mode": "MOCK_OVERRIDE",
    "mockFile": "mock-request.json"
  }
}
```

## 🎯 История версий

- **v0.1.0**: Оригинальная "банановая" замена
- **v0.1.1**: Транзитный режим с автосохранением  
- **v0.1.2**: Однократная запись без дублей
- **v0.1.3**: Mock режим для экспериментов ✨

## 🔬 Цели исследования

1. **Динамическая фильтрация** - оставлять только релевантные инструменты
2. **Оптимизация промптов** - сокращение размера на 90%+
3. **Фокусировка задач** - концентрация AI на конкретной задаче
4. **Измерение эффективности** - сравнение результатов полных и сокращенных промптов

---

**Статус**: ✅ Готов к экспериментам с динамической фильтрацией  
**Цель**: Создание системы умной оптимизации AI запросов  
**Результат**: Платформа для тестирования минимально необходимых частей системного промпта