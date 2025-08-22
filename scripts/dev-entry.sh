#!/usr/bin/env bash

echo "deps…"
if [[ ! -x node_modules/.bin/next ]]; then
  npm ci || npm install
fi

echo "prisma generate…"
npx prisma generate

echo "starting next dev…"
exec node node_modules/next/dist/bin/next dev -H 0.0.0.0 -p 3000
