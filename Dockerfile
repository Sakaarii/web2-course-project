FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN DATABASE_URL="mysql://user:pass@localhost:3306/db" npx prisma generate

COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "echo \"DATABASE_URL=$DATABASE_URL\" && npx prisma migrate deploy && npm start"]

# CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
