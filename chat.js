document.addEventListener('DOMContentLoaded', () => {
    // Get username from session storage
    const username = sessionStorage.getItem('username');
    if (!username) {
        window.location.href = 'index.html';
        return;
    }
    
    // Set current username in UI
    document.getElementById('currentUsername').textContent = username;
    
    // Initialize Socket.io
    const socket = io();
    
    // UI Elements
    const messages = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const usersList = document.getElementById('usersList');
    const groupsList = document.getElementById('groupsList');
    const logoutButton = document.getElementById('logoutButton');
    const currentChat = {
        type: 'global', // 'global', 'private', or 'group'
        id: null,       // username for private, group id for group
        name: 'Global Chat'
    };
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
    
    // Logout functionality
    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('username');
        window.location.href = 'index.html';
    });
    
    // Send message
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            const messageData = {
                sender: username,
                message: message,
                timestamp: new Date().toISOString()
            };
            
            if (currentChat.type === 'global') {
                socket.emit('global message', messageData);
                addMessage(messageData, 'sent');
            } 
            else if (currentChat.type === 'private') {
                socket.emit('private message', {
                    ...messageData,
                    recipient: currentChat.id
                });
                addMessage(messageData, 'sent');
            }
            else if (currentChat.type === 'group') {
                socket.emit('group message', {
                    ...messageData,
                    groupId: currentChat.id
                });
                addMessage(messageData, 'sent');
            }
            
            messageInput.value = '';
        }
    }
    
    // Send message on button click or Enter key
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Add message to UI
    function addMessage(data, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="sender">${data.sender}</div>
            <div class="content">${data.message}</div>
            <div class="timestamp">${timestamp}</div>
        `;
        
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }
    
    // Add notification to UI
    function addNotification(text) {
        const notificationElement = document.createElement('div');
        notificationElement.classList.add('notification');
        notificationElement.textContent = text;
        messages.appendChild(notificationElement);
        messages.scrollTop = messages.scrollHeight;
    }
    
    // Select user for private chat
    function selectUser(user) {
        // Update current chat
        currentChat.type = 'private';
        currentChat.id = user.username;
        currentChat.name = user.username;
        
        // Update UI
        document.getElementById('chatTitle').textContent = `Private: ${user.username}`;
        
        // Highlight selected user
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.user-item[data-username="${user.username}"]`).classList.add('active');
        
        // Clear messages and load chat history
        messages.innerHTML = '';
        socket.emit('load private history', {
            user1: username,
            user2: user.username
        });
    }
    
    // Select group for group chat
    function selectGroup(group) {
        // Update current chat
        currentChat.type = 'group';
        currentChat.id = group.id;
        currentChat.name = group.name;
        
        // Update UI
        document.getElementById('chatTitle').textContent = `Group: ${group.name}`;
        
        // Highlight selected group
        document.querySelectorAll('.group-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.group-item[data-group-id="${group.id}"]`).classList.add('active');
        
        // Clear messages and load group history
        messages.innerHTML = '';
        socket.emit('load group history', group.id);
    }
    
    // Create group
    document.getElementById('createGroupButton').addEventListener('click', () => {
        const groupName = document.getElementById('newGroupName').value.trim();
        if (groupName) {
            socket.emit('create group', {
                name: groupName,
                creator: username
            });
            document.getElementById('newGroupName').value = '';
        }
    });
    
    // Socket.io event handlers
    socket.on('connect', () => {
        // Notify server about the new user
        socket.emit('new user', username);
    });
    
    // Update user list
    socket.on('update users', (users) => {
        usersList.innerHTML = '';
        users.forEach(user => {
            if (user.username !== username) {
                const userElement = document.createElement('div');
                userElement.classList.add('user-item');
                userElement.setAttribute('data-username', user.username);
                
                userElement.innerHTML = `
                    <span>${user.username}</span>
                    <div class="status ${user.online ? 'online' : ''}"></div>
                `;
                
                userElement.addEventListener('click', () => selectUser(user));
                usersList.appendChild(userElement);
            }
        });
    });
    
    // Update group list
    socket.on('update groups', (groups) => {
        groupsList.innerHTML = '';
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.classList.add('group-item');
            groupElement.setAttribute('data-group-id', group.id);
            groupElement.textContent = group.name;
            
            groupElement.addEventListener('click', () => selectGroup(group));
            groupsList.appendChild(groupElement);
        });
    });
    
    // Handle global messages
    socket.on('global message', (message) => {
        if (currentChat.type === 'global') {
            addMessage(message, 'received');
        }
    });
    
    // Handle private messages
    socket.on('private message', (message) => {
        if ((currentChat.type === 'private' && currentChat.id === message.sender) || 
            message.sender === username) {
            addMessage(message, 'received');
        }
    });
    
    // Handle group messages
    socket.on('group message', (message) => {
        if (currentChat.type === 'group' && currentChat.id === message.groupId) {
            addMessage(message, 'received');
        }
    });
    
    // Load private chat history
    socket.on('private history', (history) => {
        messages.innerHTML = '';
        history.forEach(message => {
            const type = message.sender === username ? 'sent' : 'received';
            addMessage(message, type);
        });
    });
    
    // Load group chat history
    socket.on('group history', (history) => {
        messages.innerHTML = '';
        history.forEach(message => {
            const type = message.sender === username ? 'sent' : 'received';
            addMessage(message, type);
        });
    });
    
    // Notifications
    socket.on('user joined', (user) => {
        addNotification(`${user} joined the chat`);
    });
    
    socket.on('user left', (user) => {
        addNotification(`${user} left the chat`);
    });
    
    socket.on('group created', (group) => {
        addNotification(`Group "${group.name}" created`);
    });
    
    socket.on('user joined group', (data) => {
        addNotification(`${data.user} joined group "${data.group}"`);
    });
});