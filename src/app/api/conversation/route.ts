import { NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Default agent ID — will be created via ElevenLabs dashboard or API
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '';

export async function POST() {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
  }

  if (!AGENT_ID) {
    return NextResponse.json({ error: 'ElevenLabs Agent ID not configured' }, { status: 500 });
  }

  try {
    // Get signed URL for WebSocket conversation
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get conversation URL' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
