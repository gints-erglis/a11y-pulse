FROM node:18-bullseye

WORKDIR /app

RUN apt-get update -y && apt-get install -y mariadb-client openssl

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]
