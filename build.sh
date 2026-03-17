#!/usr/bin/env bash
set -e

echo "==> Installing frontend dependencies..."
npm install --prefix frontend

echo "==> Building frontend..."
npm run build --prefix frontend

echo "==> Copying frontend dist into backend/public..."
rm -rf backend/public
cp -r frontend/dist backend/public

echo "==> Installing backend dependencies..."
npm install --prefix backend

echo "==> Build complete."
