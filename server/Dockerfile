FROM node:22-bookworm-slim

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Copy server source
COPY server ./

# Copy shared types from frontend
COPY src/lib/types.ts src/lib/contracts.ts /app/src/lib/

# Generate Prisma client
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate

# Build TypeScript
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
