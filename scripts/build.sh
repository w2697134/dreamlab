#!/bin/bash
set -Eeuo pipefail

# Vercel 兼容：设置默认工作目录
if [ -z "${COZE_WORKSPACE_PATH:-}" ]; then
    COZE_WORKSPACE_PATH="$(pwd)"
fi

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install

echo "Building the Next.js project..."
pnpm next build --no-turbopack

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
