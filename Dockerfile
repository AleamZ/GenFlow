# GenFlow — single Node service serving the API + the built web UI.
FROM node:22-slim

WORKDIR /app

# Install dependencies (root + both workspaces) using the lockfile.
COPY package.json package-lock.json ./
COPY analyzer/package.json analyzer/package.json
COPY web/package.json web/package.json
RUN npm ci

# Copy the rest and build the web app (→ web/dist).
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# The platform may override PORT; the server reads process.env.PORT.
ENV PORT=5174
EXPOSE 5174

CMD ["npm", "start"]
