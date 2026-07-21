FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p uploads/fallback && chown -R node:node uploads

ENV NODE_ENV=production
USER node

EXPOSE 5000
CMD ["node", "server.js"]
