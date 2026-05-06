FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve for production
RUN npm install -g serve

# Railway provides PORT dynamically
ENV PORT=3000

# Serve the built app on PORT
CMD serve -s dist -l $PORT
