FROM node:20-alpine

WORKDIR /app

# Build the frontend service from the repo root because the linked Railway
# service points at this directory instead of /frontend.
COPY frontend/package*.json ./

RUN npm install

COPY frontend/ ./

RUN npm run build

RUN npm install -g serve

ENV PORT=3000

CMD ["sh", "start.sh"]
