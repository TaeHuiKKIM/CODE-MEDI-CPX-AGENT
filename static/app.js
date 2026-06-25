// DOM Elements
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const micPulse = document.getElementById('mic-pulse');
const evaluateBtn = document.getElementById('evaluate-btn');

const rapportVal = document.getElementById('rapport-val');
const rapportBar = document.getElementById('rapport-bar');
const stressVal = document.getElementById('stress-val');
const stressBar = document.getElementById('stress-bar');

const evalArea = document.getElementById('eval-area');
const evalChartCtx = document.getElementById('eval-chart').getContext('2d');
const evalFeedback = document.getElementById('eval-feedback');

// State
let history = []; // [{'role': 'user'|'model', 'content': '...'}]
let currentRapport = 50;
let currentStress = 30;
let radarChart = null;

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isRecording = true;
        micPulse.classList.remove('opacity-0', 'scale-150');
        micPulse.classList.add('animate-ping', 'opacity-75');
        micBtn.classList.replace('text-gray-300', 'text-red-500');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        sendMessage();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
} else {
    console.warn("Web Speech API is not supported in this browser.");
    micBtn.style.display = 'none';
}

function startRecording() {
    if (recognition && !isRecording) {
        recognition.start();
    }
}

function stopRecording() {
    isRecording = false;
    micPulse.classList.add('opacity-0', 'scale-150');
    micPulse.classList.remove('animate-ping', 'opacity-75');
    micBtn.classList.replace('text-red-500', 'text-gray-300');
}

micBtn.addEventListener('click', () => {
    if (isRecording) {
        recognition.stop();
    } else {
        startRecording();
    }
});

// Speech Synthesis (TTS)
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        utterance.pitch = 0.9; // 약간 낮은 톤으로 50대 남성 느낌
        window.speechSynthesis.speak(utterance);
    }
}

// UI Helpers
function appendMessage(role, text) {
    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `flex w-full ${isUser ? 'justify-end' : 'justify-start'} fade-in`;
    
    const bubble = document.createElement('div');
    bubble.className = `max-w-[75%] px-5 py-3 rounded-2xl shadow-md ${
        isUser 
        ? 'bg-blue-600 text-white rounded-br-sm' 
        : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm'
    }`;
    bubble.textContent = text;
    
    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateStatus(rapport, stress) {
    currentRapport = Math.max(0, Math.min(100, rapport));
    currentStress = Math.max(0, Math.min(100, stress));
    
    rapportVal.textContent = `${currentRapport}%`;
    rapportBar.style.width = `${currentRapport}%`;
    
    stressVal.textContent = `${currentStress}%`;
    stressBar.style.width = `${currentStress}%`;
}

function setLoading(isLoading) {
    sendBtn.disabled = isLoading;
    chatInput.disabled = isLoading;
    if (isLoading) {
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        chatInput.focus();
    }
}

// Chat API Logic
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    appendMessage('user', text);
    chatInput.value = '';
    setLoading(true);

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: history,
                current_rapport: currentRapport,
                current_stress: currentStress
            })
        });

        if (!res.ok) throw new Error('API Error');
        
        const data = await res.json();
        
        // Save history
        history.push({ role: 'user', content: text });
        history.push({ role: 'model', content: data.reply });
        
        appendMessage('model', data.reply);
        updateStatus(data.rapport, data.stress);
        speak(data.reply);
        
    } catch (error) {
        console.error(error);
        appendMessage('model', '죄송합니다. 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Evaluate API Logic
evaluateBtn.addEventListener('click', async () => {
    if (history.length === 0) {
        alert("대화 기록이 없습니다.");
        return;
    }
    
    evaluateBtn.disabled = true;
    evaluateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 채점 중...';
    
    try {
        const res = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: history })
        });
        
        if (!res.ok) throw new Error('API Error');
        
        const data = await res.json();
        
        // Show evaluation area
        evalArea.classList.remove('hidden');
        evalArea.classList.add('flex');
        
        evalFeedback.textContent = data.feedback;
        
        // Render Chart
        if (radarChart) radarChart.destroy();
        radarChart = new Chart(evalChartCtx, {
            type: 'radar',
            data: {
                labels: ['병력청취 (History)', '공감능력 (Empathy)', '태도 (Attitude)'],
                datasets: [{
                    label: 'Score',
                    data: [data.history_taking_score, data.empathy_score, data.attitude_score],
                    backgroundColor: 'rgba(139, 92, 246, 0.4)', // Purple
                    borderColor: 'rgba(139, 92, 246, 1)',
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(139, 92, 246, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 12 } },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            backdropColor: 'transparent',
                            min: 0,
                            max: 100,
                            stepSize: 20
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
        
        evaluateBtn.style.display = 'none'; // Hide button after evaluation
        
    } catch (error) {
        console.error(error);
        alert('평가 중 오류가 발생했습니다.');
        evaluateBtn.disabled = false;
        evaluateBtn.innerHTML = '<i class="fas fa-clipboard-check mr-2"></i> 진료 종료 및 평가받기';
    }
});
