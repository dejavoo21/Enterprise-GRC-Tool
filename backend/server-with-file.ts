import net from 'net';
import express from 'express';
import fs from 'fs';

const app = express();

app.get('/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ success: true });
});

const PORT = 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  const msg = `Server listening on port ${PORT}`;
  console.log(msg);
  fs.writeFileSync('server-status.txt', msg + '\n' + new Date().toISOString());
});

server.on('error', (err: any) => {
  const msg = `Server error: ${err.message}`;
  console.error(msg);
  fs.writeFileSync('server-error.txt', msg);
});

// Handle SIGINT gracefully
process.on('SIGINT', () => {
  console.log('Server stopped');
  fs.writeFileSync('server-status.txt', 'Server stopped\n' + new Date().toISOString());
  process.exit(0);
});
