FROM node:22-bookworm-slim
WORKDIR /app/server
COPY server/package*.json ./
COPY package.json /app/package.json
RUN npm ci
COPY server ./
COPY src/lib/types.ts src/lib/contracts.ts /app/src/lib/
RUN ln -s /app/server/node_modules /app/node_modules
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
