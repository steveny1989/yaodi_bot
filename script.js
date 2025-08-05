document.addEventListener('DOMContentLoaded', () => {
    // 请将此URL替换为你正在运行的服务器地址和端口
    // 例如：'http://127.0.0.1:5002/api/chat/stream'
    const apiUrl = 'https://yaodi-bot.thinkboxs.com/api/chat/stream';
    //const apiUrl = 'http://127.0.0.1:5002/api/chat/stream';
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const muteButton = document.getElementById('mute-button');
    const muteIcon = muteButton.querySelector('.mute-icon');

    // 静音状态管理
    let isMuted = localStorage.getItem('chatMuted') === 'true';
    let hasUserInteracted = false; // 跟踪用户是否已交互
    
    // 初始化静音状态
    function initializeMuteState() {
        updateMuteButton();
    }
    
    // 更新静音按钮状态
    function updateMuteButton() {
        if (isMuted) {
            muteButton.classList.add('muted');
            muteIcon.innerHTML = `
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            `;
            muteButton.title = '取消静音';
        } else {
            muteButton.classList.remove('muted');
            muteIcon.innerHTML = `
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            `;
            muteButton.title = '静音';
        }
    }
    
    // 切换静音状态
    function toggleMute() {
        isMuted = !isMuted;
        localStorage.setItem('chatMuted', isMuted.toString());
        updateMuteButton();
        hasUserInteracted = true; // 标记用户已交互
    }

    // 备用头像的SVG数据
    const fallbackBotAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiMwMDdiZmYiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBmaWxsPSJ3aGl0ZSI+Cjx0ZXh0IHg9IjIwIiB5PSIyOCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5b6I8L3RleHQ+Cjwvc3ZnPgo8L3N2Zz4K';

    // 发送消息到API并显示回复
    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        // 标记用户已交互
        hasUserInteracted = true;

        // 在聊天历史中显示用户消息
        appendMessage(message, 'user');
        userInput.value = '';

        try {
            // 显示AI正在思考的占位符
            const botMessagePlaceholder = appendTypingIndicator();

            // 发送流式请求到API
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            // 检查响应是否成功
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let messageId = null;
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'text') {
                                fullResponse += data.content;
                                updateMessage(botMessagePlaceholder, fullResponse);
                            } else if (data.type === 'finished') {
                                messageId = data.message_id;
                                // 如果非静音状态且用户已交互，处理音频生成
                                if (!isMuted && messageId && hasUserInteracted) {
                                    generateAudio(messageId, fullResponse);
                                }
                            } else if (data.type === 'error') {
                                updateMessage(botMessagePlaceholder, data.content);
                            }
                        } catch (e) {
                            console.error('解析流式数据失败:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            appendMessage('抱歉，连接到AI时出错，请稍后再试。', 'bot');
        }
    }

    // 生成音频的函数 - 增强移动端兼容性
    async function generateAudio(messageId, textContent = null) {
        try {
            const requestBody = { message_id: messageId };
            if (textContent) {
                requestBody.text = textContent;
            }
            
            const audioResponse = await fetch('https://yaodi-bot.thinkboxs.com/api/audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (audioResponse.ok) {
                const audioData = await audioResponse.json();
                if (audioData.audio_url) {
                    await playAudioWithMobileSupport(audioData.audio_url);
                }
            } else {
                console.error('音频API响应状态:', audioResponse.status);
                const errorData = await audioResponse.json();
                console.error('音频API请求失败:', audioResponse.status);
                console.error('错误详情:', errorData);
            }
        } catch (error) {
            console.error('音频生成失败:', error);
        }
    }

    // 增强的音频播放函数，支持移动端
    async function playAudioWithMobileSupport(audioUrl) {
        try {
            const audio = new Audio();
            
            // 设置音频属性以改善移动端兼容性
            audio.preload = 'auto';
            audio.volume = 0.8; // 设置适中的音量
            
            // 监听音频加载完成
            audio.addEventListener('canplaythrough', () => {
                console.log('音频加载完成，准备播放');
            });
            
            // 监听播放开始
            audio.addEventListener('play', () => {
                console.log('音频开始播放');
            });
            
            // 监听播放错误
            audio.addEventListener('error', (e) => {
                console.error('音频播放错误:', e);
            });
            
            // 设置音频源
            audio.src = audioUrl;
            
            // 尝试播放音频
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                await playPromise;
                console.log('音频播放成功');
            }
            
        } catch (error) {
            console.error('音频播放失败:', error);
            
            // 如果是自动播放策略错误，尝试用户交互后播放
            if (error.name === 'NotAllowedError') {
                console.log('自动播放被阻止，需要用户交互');
                // 可以在这里添加一个提示，告诉用户点击屏幕来启用音频
                showAudioPermissionHint();
            }
        }
    }

    // 显示音频权限提示
    function showAudioPermissionHint() {
        // 创建一个临时的提示元素
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 1000;
            text-align: center;
        `;
        hint.textContent = '点击屏幕任意位置启用音频播放';
        document.body.appendChild(hint);
        
        // 3秒后自动移除提示
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 3000);
        
        // 点击提示时移除
        hint.addEventListener('click', () => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        });
    }

    // 将消息添加到聊天历史中
    function appendMessage(text, sender) {
        if (sender === 'user') {
            // 用户消息：只显示消息内容，右对齐
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'user-message');
            messageDiv.textContent = text;
            chatHistory.appendChild(messageDiv);
            chatHistory.scrollTop = chatHistory.scrollHeight;
            return messageDiv;
        } else {
            // AI消息：显示头像和消息
            const messageWrapper = document.createElement('div');
            messageWrapper.classList.add('message-wrapper', 'bot-message-wrapper');
            
            // 创建头像
            const avatar = document.createElement('div');
            avatar.classList.add('avatar', 'bot-avatar');
            avatar.innerHTML = `<img src="https://github.com/steveny1989.png?size=80" alt="姚迪头像" onerror="this.src='${fallbackBotAvatar}'">`;
            
            // 创建消息内容
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'bot-message');
            messageDiv.textContent = text;
            
            // 组装消息
            messageWrapper.appendChild(avatar);
            messageWrapper.appendChild(messageDiv);
            chatHistory.appendChild(messageWrapper);
            chatHistory.scrollTop = chatHistory.scrollHeight;
            return messageDiv;
        }
    }

    // 添加动态加载指示器
    function appendTypingIndicator() {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', 'bot-message-wrapper');
        
        // 创建头像
        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot-avatar');
        avatar.innerHTML = `<img src="https://github.com/steveny1989.png?size=80" alt="姚迪头像" onerror="this.src='${fallbackBotAvatar}'">`;
        
        // 创建动态加载指示器
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot-message');
        messageDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        
        // 组装消息
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(messageDiv);
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageDiv;
    }

    // 更新消息内容
    function updateMessage(element, newText) {
        element.innerHTML = newText;
        chatHistory.scrollTop = chatHistory.scrollHeight; // 自动滚动到底部
    }

    // 初始化
    initializeMuteState();

    // 绑定事件
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
    muteButton.addEventListener('click', toggleMute);
    
    // 添加页面点击事件来启用音频
    document.addEventListener('click', () => {
        hasUserInteracted = true;
    }, { once: true });
});