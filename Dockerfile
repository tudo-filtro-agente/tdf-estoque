FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY . .

RUN npm run build --workspace=apps/api

EXPOSE 3001

CMD ["sh", "-c", "cd apps/api && npm start"]
