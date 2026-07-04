# Stage 1 — build React frontend
FROM node:22-alpine AS client-build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_KEY=$VITE_SUPABASE_KEY
WORKDIR /app/client
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2 — Express API serving built React
FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
COPY --from=client-build /app/client/dist ./public
EXPOSE 10000
CMD ["node", "src/server.js"]
