export interface ChatArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  maxTokens?: number;
  debug?: boolean;
}

export async function chat({ apiKey, model, systemPrompt, userText, maxTokens = 512, debug = false }: ChatArgs): Promise<string> {
  const modelName = model || 'gpt-5-mini';
  const payload: any = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
  };
  if (/^gpt-5/i.test(modelName)) payload.max_completion_tokens = maxTokens; else payload.max_tokens = maxTokens;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (debug) {
    console.log('Nova AI status', resp.status, resp.statusText);
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    if (debug) console.error('Nova AI error body', errText);
    throw new Error(`AI request failed (${resp.status}): ${resp.statusText}`);
  }
  const data = await resp.json();
  if (debug) {
    console.log('Nova AI payload', data);
  }
  const choice = data?.choices?.[0];
  const msg = choice?.message;
  let text = '';
  if (typeof msg?.content === 'string') text = msg.content.trim();
  else if (Array.isArray(msg?.content)) text = msg.content.map((p: any) => (p?.text ?? '')).join('').trim();
  else if (typeof (msg as any)?.output_text === 'string') text = (msg as any).output_text.trim();
  return text;
}


