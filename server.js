// Simple WebSocket signaling server for walkie talkie
// Install: npm install ws
// Run: node server.js

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Create HTTP server first
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Walkie Talkie Signaling Server Running\n');
});

// Create WebSocket server on top of HTTP server
const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomId -> Set of clients

console.log('Walkie Talkie Signaling Server starting on port', PORT);

wss.on('connection', (ws) => {
    let currentRoom = null;
    
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    // Join a room
                    currentRoom = data.room;
                    
                    if (!rooms.has(currentRoom)) {
                        rooms.set(currentRoom, new Set());
                    }
                    
                    const room = rooms.get(currentRoom);
                    room.add(ws);
                    
                    console.log(`Client joined room: ${currentRoom} (${room.size} clients)`);
                    
                    // Notify other clients in the room
                    room.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'peer-joined' }));
                        }
                    });
                    break;

                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    // Forward signaling messages to other clients in the room
                    if (currentRoom && rooms.has(currentRoom)) {
                        const room = rooms.get(currentRoom);
                        room.forEach(client => {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(data));
                            }
                        });
                    }
                    break;

                case 'talking':
                case 'stopped':
                    // Forward status messages
                    if (currentRoom && rooms.has(currentRoom)) {
                        const room = rooms.get(currentRoom);
                        room.forEach(client => {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({ type: data.type }));
                            }
                        });
                    }
                    break;

                case 'leave':
                    handleLeave(ws, currentRoom);
                    currentRoom = null;
                    break;
            }
        } catch (err) {
            console.error('Error handling message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        handleLeave(ws, currentRoom);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

function handleLeave(ws, roomId) {
    if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(ws);
        
        console.log(`Client left room: ${roomId} (${room.size} clients remaining)`);
        
        // Notify other clients
        room.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'peer-left' }));
            }
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty)`);
        }
    }
}

console.log('\nServer ready! Clients can connect to:');
console.log('ws://localhost:8080 (local testing)');
console.log('Or deploy to get a public wss:// URL');
