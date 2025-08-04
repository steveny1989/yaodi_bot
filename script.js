document.addEventListener('DOMContentLoaded', () => {
    // 请将此URL替换为你正在运行的服务器地址和端口
    // 例如：'http://127.0.0.1:5002/api/chat/stream'
    const apiUrl = 'https://yaodi-bot.thinkboxs.com/api/chat/stream';
    //const apiUrl = 'http://127.0.0.1:5002/api/chat/stream';
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    // 发送消息到API并显示回复
    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        // 在聊天历史中显示用户消息
        appendMessage(message, 'user');
        userInput.value = '';

        try {
            // 显示AI正在思考的占位符
            const botMessagePlaceholder = appendMessage('', 'bot');

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
                                // 可以在这里处理音频生成
                                if (messageId) {
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

    // 生成音频的函数
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
                    const audio = new Audio(audioData.audio_url);
                    audio.play();
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

    // 将消息添加到聊天历史中
    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.textContent = text;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight; // 自动滚动到底部
        return messageDiv; // 返回消息元素以便后续更新
    }

    // 更新消息内容
    function updateMessage(element, newText) {
        element.textContent = newText;
        chatHistory.scrollTop = chatHistory.scrollHeight; // 自动滚动到底部
    }

    // 绑定事件
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
});