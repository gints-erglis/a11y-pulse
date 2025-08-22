FROM node:18-bullseye

RUN groupadd -r nodeapp && useradd -m -r -g nodeapp -u 1010 nodeapp

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=false \
    PUPPETEER_PRODUCT=chrome \
    PUPPETEER_CACHE_DIR=/home/nodeapp/.cache/puppeteer

RUN apt-get update -y && apt-get install -y \
    mariadb-client \
    openssl \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libdrm2 \
    libxshmfence1 \
    libgbm1 \
    libgtk-3-0 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/nodeapp/.cache/puppeteer \
             /app/node_modules \
             /app/.next \
             /app/reports \
    && chown -R nodeapp:nodeapp /home/nodeapp/.cache /app

COPY package*.json ./

COPY . .

RUN chown -R nodeapp:nodeapp /app

USER nodeapp

CMD ["npm", "run", "dev"]
