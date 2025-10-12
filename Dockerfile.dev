FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Use tsx watch for development with hot reload
CMD ["npm", "run", "dev"]
