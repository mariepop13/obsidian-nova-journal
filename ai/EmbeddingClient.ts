type EmbedArgs = {
  apiKey: string;
  model?: string;
  inputs: string[];
};

type EmbeddingResponse = {
  embeddings: number[][];
};

export async function embed({ apiKey, model = 'text-embedding-3-small', inputs }: EmbedArgs): Promise<EmbeddingResponse> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) {
    throw new Error('Embedding request failed');
  }
  const json = await res.json();
  const vectors = (json?.data || []).map((d: any) => d.embedding as number[]);
  return { embeddings: vectors };
}


