/**
 * ElevenLabs Conversational AI Client
 * https://elevenlabs.io/docs/conversational-ai
 */

const API_BASE = 'https://api.elevenlabs.io/v1';

interface AgentConfig {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  language: string;
  voiceId?: string;
}

export class ElevenLabsClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /** Create a Conversational AI agent */
  async createAgent(config: AgentConfig) {
    const res = await fetch(`${API_BASE}/convai/agents/create`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: {
              prompt: config.systemPrompt,
            },
            first_message: config.firstMessage,
            language: config.language,
          },
          tts: {
            voice_id: config.voiceId || 'pNInz6obpgDQGcFmaJgB', // Default Korean-friendly voice
          },
        },
        name: config.name,
      }),
    });

    if (!res.ok) throw new Error(`Create agent failed: ${await res.text()}`);
    return res.json();
  }

  /** List all agents */
  async listAgents() {
    const res = await fetch(`${API_BASE}/convai/agents`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`List agents failed: ${await res.text()}`);
    return res.json();
  }

  /** Get signed URL for conversation WebSocket */
  async getSignedUrl(agentId: string) {
    const res = await fetch(
      `${API_BASE}/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Get signed URL failed: ${await res.text()}`);
    const data = await res.json();
    return data.signed_url as string;
  }
}
