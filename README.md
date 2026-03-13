# 🤖 HOBBYTAN AI 콜센터

ElevenLabs Conversational AI + Twilio 기반 AI 콜센터 자동화 시스템

## Architecture

```
고객 전화 → Twilio → TwiML WebSocket → ElevenLabs Conversational AI
                                              ↕
브라우저 UI → WebSocket → ElevenLabs Conversational AI
```

## Tech Stack

- **Frontend:** Next.js 14 + Tailwind CSS + TypeScript
- **AI Voice:** ElevenLabs Conversational AI (WebSocket)
- **Telephony:** Twilio (Incoming Call → TwiML Stream)
- **Hosting:** Firebase Hosting

## Setup

```bash
# 1. Install
npm install

# 2. Configure .env.local
ELEVENLABS_API_KEY=your_key
ELEVENLABS_AGENT_ID=your_agent_id  # Create at elevenlabs.io dashboard
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+82xxx

# 3. Run
npm run dev
```

## Features

### 웹 브라우저 통화
- 실시간 AI 상담원 음성 대화
- 마이크 음소거/해제
- 대화 텍스트 실시간 표시

### Twilio 전화 연동
- 수신 전화 → AI 자동 응대
- TwiML Media Stream → ElevenLabs WebSocket 릴레이

## ElevenLabs Agent 설정

ElevenLabs 대시보드에서 Conversational AI Agent 생성:
1. https://elevenlabs.io/app/conversational-ai
2. Create Agent → 한국어 설정
3. System Prompt에 콜센터 응대 스크립트 입력
4. Agent ID를 `.env.local`에 설정

## Deployment

```bash
npm run build
firebase deploy --only hosting
```

## Project: CALLBOT-001
HOBBYTAN-COUNCIL 의회 프로젝트
