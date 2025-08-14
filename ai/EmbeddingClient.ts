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

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ 
      model, 
      input: filteredInputs,
      encoding_format: 'float'
    }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${errorText}`);
  }
  
  const json = await res.json();
  const vectors = (json?.data || []).map((d: any) => d.embedding as number[]);
  return { embeddings: vectors };
}


