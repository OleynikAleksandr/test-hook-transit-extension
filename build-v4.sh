#!/bin/bash
VERSION=$(node -p "require('./package.json').version")
echo "🔨 Сборка Roo Hook Tester v$VERSION..."

# Компилируем TypeScript
echo "📦 Компиляция TypeScript..."
npx tsc src/extension-v4.ts --outDir out --module commonjs --target es2019 --lib es2019 --sourceMap

# Упаковка расширения
echo "📦 Создание VSIX пакета..."
npx vsce package --no-dependencies

echo "✅ Готово! Файл: roo-hook-tester-$VERSION.vsix"