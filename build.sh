#!/bin/bash

# Build script for Roo Hook Transit Extension

echo "🔨 Building Roo Hook Transit Extension..."

# Compile TypeScript
echo "📦 Compiling TypeScript..."
npm run compile

# Package VSIX
echo "📦 Creating VSIX package..."
npx vsce package --no-dependencies

# Create releases directory if not exists
mkdir -p releases

# Move VSIX to releases
echo "📁 Moving VSIX to releases folder..."
mv *.vsix releases/

echo "✅ Build complete! VSIX file is in releases/"
echo "📦 Install with: code --install-extension releases/roo-hook-transit-0.1.0.vsix"