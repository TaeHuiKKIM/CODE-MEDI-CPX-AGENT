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

const evalModal = document.getElementById('eval-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const restartBtn = document.getElementById('restart-btn');
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
    bubble.className = `max-w-[75%] px-4 py-2.5 rounded-3xl shadow-sm text-sm ${
        isUser 
        ? 'bg-blue-500 text-white rounded-br-sm' 
        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
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
        sendBtn.innerHTML = '보내기';
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
        
        // Show full-screen evaluation modal
        evalModal.classList.remove('hidden');
        evalModal.classList.add('flex');
        
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
                    backgroundColor: 'rgba(236, 72, 153, 0.2)', // Pink-500 with opacity
                    borderColor: 'rgba(236, 72, 153, 1)',
                    pointBackgroundColor: 'rgba(236, 72, 153, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(236, 72, 153, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
                        grid: { color: 'rgba(0, 0, 0, 0.1)' },
                        pointLabels: { color: 'rgba(0, 0, 0, 0.7)', font: { size: 14, weight: 'bold' } },
                        ticks: {
                            color: 'rgba(0, 0, 0, 0.5)',
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
        
        evaluateBtn.innerHTML = '<i class="fas fa-check-circle mr-1"></i> 평가 완료';
        
    } catch (error) {
        console.error(error);
        alert('평가 중 오류가 발생했습니다.');
        evaluateBtn.disabled = false;
        evaluateBtn.innerHTML = '<i class="fas fa-check-circle mr-1"></i> 진료 종료 (채점)';
    }
});

// Modal Controls
closeModalBtn.addEventListener('click', () => {
    evalModal.classList.add('hidden');
    evalModal.classList.remove('flex');
});

restartBtn.addEventListener('click', () => {
    location.reload(); // Refresh page to start a new session
});
