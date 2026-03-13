import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '';

/**
 * Twilio Incoming Call Webhook
 * Twilio → TwiML (WebSocket stream) → ElevenLabs Conversational AI
 */
export async function POST(request: NextRequest) {
  // Get the host for WebSocket URL
  const host = request.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'ws' : 'wss';

  // Return TwiML that connects to our WebSocket relay
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ko-KR">안녕하세요, HOBBYTAN AI 콜센터입니다. 잠시만 기다려주세요.</Say>
  <Connect>
    <Stream url="${protocol}://${host}/callcenter-ai/api/twilio/stream">
      <Parameter name="agentId" value="${AGENT_ID}" />
    </Stream>
  </Connect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
