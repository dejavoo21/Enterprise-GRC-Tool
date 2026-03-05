import express from 'express';

const app = express();
const PORT = 3001;

app.get('/health', (_req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'ok' });
});

console.log('About to listen on port', PORT);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Server is actually listening now');
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

