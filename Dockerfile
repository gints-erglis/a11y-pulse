FROM node:18-bullseye

RUN groupadd -r nodeapp && useradd -m -r -g nodeapp -u 1010 nodeapp

WORKDIR /app

RUN apt-get update -y && apt-get install -y mariadb-client openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN chown -R nodeapp:nodeapp /app

USER nodeapp

CMD ["npm", "run", "dev"]
