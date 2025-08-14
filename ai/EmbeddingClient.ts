type EmbedArgs = {
  apiKey: string;
  model?: string;
  inputs: string[];
};

type EmbeddingResponse = {
  embeddings: number[][];
};

export async function embed({ apiKey, model = 'text-embedding-3-small', inputs }: EmbedArgs): Promise<EmbeddingResponse> {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key');
  }
  
  if (!inputs || inputs.length === 0) {
    return { embeddings: [] };
  }

  const filteredInputs = inputs.filter(text => text && text.trim().length > 0);
  if (filteredInputs.length === 0) {
    return { embeddings: [] };
  }

  const totalChars = filteredInputs.reduce((sum, text) => sum + text.length, 0);
  const requestSize = JSON.stringify({ model, input: filteredInputs, encoding_format: 'float' }).length;
  
  console.log(`[Embedding Debug] Inputs: ${filteredInputs.length}, Total chars: ${totalChars}, Request size: ${requestSize} bytes`);
  
  if (requestSize > 2000000) {
    throw new Error(`Request too large: ${requestSize} bytes (max ~2MB). Reduce chunk count or size.`);
  }

  const payload = { 
    model, 
    input: filteredInputs,
    encoding_format: 'float'
  };

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Embedding Debug] API Error ${res.status}:`, errorText);
    console.error(`[Embedding Debug] Request payload size: ${JSON.stringify(payload).length} bytes`);
    console.error(`[Embedding Debug] Sample inputs:`, filteredInputs.slice(0, 3).map(t => t.substring(0, 100)));
    throw new Error(`Embedding API error ${res.status}: ${errorText}`);
  }
  
  const json = await res.json();
  const vectors = (json?.data || []).map((d: any) => d.embedding as number[]);
  console.log(`[Embedding Debug] Success: ${vectors.length} embeddings received`);
  return { embeddings: vectors };
}


