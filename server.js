const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory data stores
const users = new Map(); // { username: socketId }
const groups = new Map(); // { groupId: { name, members: [username] } }
const privateMessages = new Map(); // { userPair: [messages] }
const groupMessages = new Map(); // { groupId: [messages] }

// Helper functions
function getUserPair(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Serve static files
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    
    let currentUser = null;
    
    // New user joined
    socket.on('new user', (username) => {
        // Store user
        users.set(username, socket.id);
        currentUser = username;
        
        // Notify all clients
        io.emit('user joined', username);
        updateUserLists();
    });
    
    // Global message
    socket.on('global message', (message) => {
        io.emit('global message', message);
    });
    
    // Private message
    socket.on('private message', (data) => {
        const { sender, recipient, message, timestamp } = data;
        
        // Store message
        const userPair = getUserPair(sender, recipient);
        if (!privateMessages.has(userPair)) {
            privateMessages.set(userPair, []);
        }
        privateMessages.get(userPair).push(data);
        
        // Send to recipient if online
        if (users.has(recipient)) {
            io.to(users.get(recipient)).emit('private message', data);
        }
        
        // Also send back to sender for their UI
        socket.emit('private message', data);
    });
    
    // Create group
    socket.on('create group', (data) => {
        const groupId = Date.now().toString();
        const group = {
            id: groupId,
            name: data.name,
            members: [data.creator]
        };
        
        groups.set(groupId, group);
        
        // Notify all clients
        io.emit('group created', group);
        updateGroupLists();
    });
    
    // Group message
   // Group message
socket.on('group message', (data) => {
    const { groupId, sender, message, timestamp } = data;

    if (groups.has(groupId)) {
        // Store message
        if (!groupMessages.has(groupId)) {
            groupMessages.set(groupId, []);
        }
        groupMessages.get(groupId).push(data);

        // Send to all group members
        const group = groups.get(groupId);
        group.members.forEach(member => {
            if (users.has(member)) {
                io.to(users.get(member)).emit('group message', data);
            }
        });
    }
});

    
    // Load private chat history
    socket.on('load private history', (data) => {
        const userPair = getUserPair(data.user1, data.user2);
        if (privateMessages.has(userPair)) {
            socket.emit('private history', privateMessages.get(userPair));
        } else {
            socket.emit('private history', []);
        }
    });
    
    // Load group chat history
    socket.on('load group history', (groupId) => {
        if (groupMessages.has(groupId)) {
            socket.emit('group history', groupMessages.get(groupId));
        } else {
            socket.emit('group history', []);
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        if (currentUser) {
            users.delete(currentUser);
            io.emit('user left', currentUser);
            updateUserLists();
        }
        console.log('User disconnected:', socket.id);
    });
    
    // Helper function to update user lists
    function updateUserLists() {
        const userList = Array.from(users.keys()).map(username => ({
            username,
            online: true
        }));
        io.emit('update users', userList);
    }
    
    // Helper function to update group lists
    function updateGroupLists() {
        const groupList = Array.from(groups.values());
        io.emit('update groups', groupList);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});