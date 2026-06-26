# CODE MEDI CPX Agent MVP 🚀

의대생의 진료수행평가(CPX)를 돕는 **LLM 기반 가상 환자 에이전트 및 평가 웹 서비스**입니다.  
본 프로젝트는 단순한 챗봇이 아닌, **'채점자 겸용 하이브리드 에이전트'** 구조로 설계되어 실제 까다로운 환자를 완벽히 모사하고 진료 후에는 날카로운 피드백을 제공합니다.

---
## 작동 사진

<img width="2860" height="1690" alt="스크린샷 2026-06-26 110152" src="https://github.com/user-attachments/assets/8d10370e-80e7-4fd3-a177-aff279565f91" />


---

## 🌟 핵심 기획 및 기능

1. **하이브리드 모드 지원 (환자 ↔ 평가자)**
   - **진료 중**: 의사가 묻지 않은 내용은 절대 먼저 말하지 않는 까다로운 환자 연기.
   - **진료 후**: 대화 로그를 기반으로 병력청취(OLDCAARTS), 공감능력, 태도를 자동 채점 및 피드백.
2. **동적 라포(Rapport) 시스템 & 실시간 대시보드**
   - 의사의 공감 표현에 따라 환자의 호감도와 스트레스 수치가 변화하며 프론트엔드 Progress Bar에 실시간 반영.
3. **Web Speech API 적용 (STT / TTS)**
   - 키보드 없이 **음성**만으로 가상 환자와 대화하는 리얼한 진료 환경 제공.
4. **시나리오 퀵 주입 구조 (Vibe Coding)**
   - `main.py`의 `PATIENT_SCENARIO` 변수에 당일 주어지는 질병 정보(JSON/Markdown)를 넣는 것만으로 즉시 새로운 에이전트 생성 가능.

---

## 🛠 기술 스택

- **Backend**: Python 3.11+, FastAPI, Pydantic
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (CDN), Chart.js
- **AI**: Gemini 2.5 Flash API (`google-generativeai`)

---

## 💻 로컬 실행 방법 (Local Setup)

1. **저장소 클론 및 폴더 이동**
   ```bash
   git clone https://github.com/TaeHuiKKIM/CODE-MEDI-CPX-AGENT.git
   cd CODE-MEDI-CPX-AGENT
   ```

2. **패키지 설치**
   ```bash
   pip install -r requirements.txt
   ```

3. **환경 변수 설정 (`.env`)**
   프로젝트 루트 폴더에 `.env` 파일을 생성하고 아래와 같이 Gemini API 키를 입력합니다.
   ```env
   GEMINI_API_KEY=당신의_제미나이_API_키
   ```
   *(※ `.env` 파일은 `.gitignore`에 등록되어 있으므로 안전합니다.)*

4. **서버 실행**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **브라우저 접속**
   [http://localhost:8000/static/index.html](http://localhost:8000/static/index.html) 접속

---

## ☁️ Cloudtype.io 1분 배포 가이드 (해커톤 시연용)

심사 전, 누구나 스마트폰으로 접속해 볼 수 있도록 Cloudtype에 배포합니다.

1. [Cloudtype.io](https://cloudtype.io/) 로그인 후 **새 프로젝트** 생성
2. **GitHub 저장소 가져오기** 선택 후 `CODE-MEDI-CPX-AGENT` 레포지토리 연결
3. 언어/프레임워크: **FastAPI** 선택
4. 포트 번호: `8000` 입력
5. **환경변수 설정**: `GEMINI_API_KEY`와 키 값을 추가
6. **배포하기** 클릭! (약 1~2분 소요 후 도메인 생성됨)

---

## 📚 관련 문서
- [해커톤 필승 전략 및 CPX 도메인 지식 가이드](./docs/hackathon_strategy.md)
