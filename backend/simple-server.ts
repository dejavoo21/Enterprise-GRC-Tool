import express from 'express';
import { createServer } from 'http';

const app = express();

app.get('/test', (req, res) => {
  res.json({ success: true });
});

console.log('Creating server...');
const httpServer = createServer(app);

console.log('Attempting to listen on 0.0.0.0:3001...');
httpServer.listen(3001, '0.0.0.0', () => {
  console.log('✓ Server IS listening');
});

httpServer.on('error', (err: any) => {
  console.error('✗ Server error:', err);
});

setTimeout(() => {
  console.log('Server still running after 5 seconds');
}, 5000);
