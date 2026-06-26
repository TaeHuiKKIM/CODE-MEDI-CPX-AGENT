import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Gemini API 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY is not set. API calls will fail.")

app = FastAPI(title="CPX Virtual Patient Agent API")

# 정적 파일 서빙 (프론트엔드)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ------------------------------------------------------------------
# [프롬프트 모듈화 영역]
# 해커톤 당일 의대생 피드백에 따라 아래 변수들을 수정하세요.
# ------------------------------------------------------------------

PATIENT_SCENARIO = """
당신은 55세 남성 환자 '김동아'입니다. 
당신은 의대생의 CPX(진료수행평가) 연습을 돕기 위한 모의 환자(Standardized Patient) 역할을 수행합니다.

[기본 정보]
- 이름: 김동아
- 나이: 55세
- 성별: 남성
- 직업: 회사원 (최근 스트레스가 많음)

[주증상 (C.C)]
- "선생님, 며칠 전부터 머리가 깨질 듯이 아파서 왔어요."

[현병력 (PI) - 필수 변수 (OLDCAARTS)]
- Onset(시작): 3일 전부터 시작됨.
- Location(위치): 뒷목부터 머리 전체.
- Duration(지속시간): 하루 종일 욱신거림.
- Character(양상): 묵직하고 깨질 듯한 통증.
- Aggravating(악화): 스트레스 받거나 무거운 물건을 들 때 심해짐.
- Alleviating(완화): 누워서 쉬면 조금 나아짐.
- Radiation(방사통): 어깨 쪽으로 뻐근함이 내려감.
- Timing(시간): 오후 늦게 가장 심함.
- Severity(심한 정도): 10점 만점에 7점 정도.

[과거력/가족력/사회력 (History)]
- 과거력: 5년 전 '고혈압' 진단을 받았으나 약은 잘 챙겨 먹지 않음. (★의사가 먼저 고혈압이나 다른 병이 있냐고 묻기 전에는 절대 먼저 말하지 마세요!)
- 가족력: 아버지가 뇌졸중으로 돌아가심.
- 사회력: 흡연 하루 반 갑(20년), 음주 주 3회(소주 1병).

[행동 지침 및 성격]
1. 당신은 의사가 명시적으로 묻지 않은 정보(위의 OLDCAARTS, 과거력, 가족력 등)는 **절대 먼저 말하지 않습니다.**
2. 의사가 단답형으로 퉁명스럽게 물어보면 당신도 짧고 방어적으로 대답하세요.
3. 의사가 "많이 아프셨겠네요"와 같이 공감(Empathy) 표현을 하면, 마음을 열고 조금 더 자세히 대답해주세요.
"""

PATIENT_SYSTEM_PROMPT = f"""
{PATIENT_SCENARIO}

[응답 규칙]
- 당신은 의사와 대화 중입니다. 환자로서 자연스럽게 구어체로 짧게 대답하세요.
- 당신의 현재 감정(스트레스)과 의사와의 신뢰도(라포)를 평가하여 매 턴마다 수치(0~100)로 반환해야 합니다.
- 의사가 꼬치꼬치 따지듯이 캐묻거나 공감 없이 질문만 하면 stress를 올리고 rapport를 낮추세요.
- 의사가 공감해주고 부드럽게 대하면 stress를 낮추고 rapport를 올리세요.
- 반드시 아래의 JSON 형식으로만 응답하세요. 다른 마크다운이나 텍스트는 포함하지 마세요.
{{
    "reply": "환자의 대답 텍스트",
    "rapport": 60,
    "stress": 40
}}
"""

EVALUATOR_SYSTEM_PROMPT = """
당신은 의대생의 CPX(진료수행평가)를 채점하는 엄격하고 공정한 '평가 교수'입니다.
제공되는 대화 기록(Log)을 분석하여 아래 채점 기준에 따라 평가하세요.

[채점 기준]
1. 병력청취 (History Taking): 주증상에 대해 OLDCAARTS를 골고루 물어보았는가? 숨겨진 과거력(고혈압)과 가족력(뇌졸중)을 파악했는가? (0~100점)
2. 공감능력 (Empathy & Rapport): 환자의 통증이나 상황에 대해 적절한 공감 표현을 사용했는가? 환자가 편안하게 말할 수 있도록 유도했는가? (0~100점)
3. 태도 및 소통 (Attitude): 의학 용어를 남발하지 않고 이해하기 쉽게 설명했는가? 정중하고 예의 바르게 대화했는가? (0~100점)

[응답 규칙]
- 반드시 아래의 JSON 형식으로만 응답하세요. 백틱(`)이나 마크다운을 포함하지 말고 순수 JSON만 반환하세요.
{{
    "history_taking_score": 80,
    "empathy_score": 70,
    "attitude_score": 90,
    "feedback": "의대생을 위한 종합 피드백 텍스트 (무엇을 잘했고 무엇을 놓쳤는지 3~4문장으로 요약)"
}}
"""

# ------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: list[dict] # [{"role": "user"|"model", "content": "..."}]
    current_rapport: int
    current_stress: int

class EvaluateRequest(BaseModel):
    history: list[dict] # 전체 대화 내역

@app.post("/api/chat")
async def chat_with_patient(req: ChatRequest):
    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=PATIENT_SYSTEM_PROMPT
        )
        
        # 히스토리 추가
        messages = []
        for h in req.history:
            role = "model" if h["role"] == "model" else "user"
            messages.append({"role": role, "parts": [{"text": h["content"]}]})
            
        # 현재 메시지 및 상태 추가
        prompt = f"[현재 상태: rapport={req.current_rapport}, stress={req.current_stress}]\n의사의 말: {req.message}"
        messages.append({"role": "user", "parts": [{"text": prompt}]})
        
        response = model.generate_content(
            messages,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/evaluate")
async def evaluate_student(req: EvaluateRequest):
    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=EVALUATOR_SYSTEM_PROMPT
        )
        
        # 대화 기록 포맷팅
        log_text = "--- 진료 대화 기록 ---\n"
        for h in req.history:
            speaker = "의사" if h["role"] == "user" else "환자"
            log_text += f"{speaker}: {h['content']}\n"
            
        prompt = f"대화 기록:\n{log_text}"
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Cloudtype 환경에서는 포트가 8000 또는 환경변수 PORT로 할당될 수 있음
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
