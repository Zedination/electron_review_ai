async function requestOpenAIServerCompatible(prompt, endpoint, targetElement, scrollAnchor, commentBox) {
    targetElement.innerHTML = ``;
    let htmlPrefix = `
    <style>
        @import url('/css/github-markdown.min.css');
    </style>
    <article class="markdown-body">`;

    let htmlSuffix = `</article>`;

    let mdContent = '';
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "model": "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7,
        "max_tokens": -1,
        "stream": true
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };
    const response = await fetch(`${endpoint}/chat/completions`, requestOptions);
    if (!response.ok) {
        throw new Error(`Lỗi: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;

    // khi bắt đầu hỏi AI, scroll đến vị trí đầu tiên của câu trả lời của AI
    scrollAnchor.style.top = '0';
    scrollAnchor.scrollIntoView({ behavior: 'smooth' });
    while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
            if (line === '[DONE]') {
                done = true;
                break;
            }
            if (line.startsWith('data: ')) {
                const json = JSON.parse(line.slice(6));
                const content = json.choices[0].delta?.content;
                if (content) {
                    mdContent += content;
                    targetElement.innerHTML = marked.parse(mdContent);
                    // scroll tự động để hiển thị nội dung mới nhất
                    if (commentBox.offsetHeight > window.innerHeight) {
                        scrollAnchor.style.top = '';
                        scrollAnchor.style.bottom = `${window.innerHeight}px`;
                        scrollAnchor.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        }
    }
}