import { sanitizeForLogging } from '../utils/Sanitizer';
import { API_CONFIG } from '../services/shared/Constants';

type EmbedArgs = {
  apiKey: string;
  model?: string;
  inputs: string[];
};

type EmbeddingResponse = {
  embeddings: number[][];
};

interface EmbeddingPayload {
  model: string;
  input: string[];
  encoding_format: string;
}

interface EmbeddingData {
  embedding?: number[];
  index?: number;
}

interface OpenAIEmbeddingResponse {
  data?: EmbeddingData[];
  model?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export async function embed({
  apiKey,
  model = 'text-embedding-3-small',
  inputs,
}: EmbedArgs): Promise<EmbeddingResponse> {
  validateApiKey(apiKey);
  const filteredInputs = validateAndFilterInputs(inputs);
  if (!filteredInputs) return { embeddings: [] };
  
  const payload = createEmbeddingPayload(model, filteredInputs);
  validateRequestSize(payload);
  
  const response = await makeEmbeddingRequest(apiKey, payload);
  return parseEmbeddingResponse(response);
}

function validateApiKey(apiKey: string): void {
  if (!apiKey?.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key');
  }
}

function validateAndFilterInputs(inputs: string[]): string[] | null {
  if (!inputs || inputs.length === 0) {
    return null;
  }

  const filteredInputs = inputs.filter(text => text && text.trim().length > 0);
  if (filteredInputs.length === 0) {
    return null;
  }

  return filteredInputs;
}

function createEmbeddingPayload(model: string, filteredInputs: string[]): EmbeddingPayload {
  const payload = {
    model,
    input: filteredInputs,
    encoding_format: 'float',
  };

  const totalChars = filteredInputs.reduce((sum, text) => sum + text.length, 0);
  const requestSize = JSON.stringify(payload).length;

  console.log(
    `[Embedding Debug] Inputs: ${filteredInputs.length}, Total chars: ${totalChars}, Request size: ${requestSize} bytes`
  );

  return payload;
}

function validateRequestSize(payload: EmbeddingPayload): void {
  const requestSize = JSON.stringify(payload).length;
  if (requestSize > API_CONFIG.MAX_REQUEST_SIZE_BYTES) {
    throw new Error(`Request too large: ${requestSize} bytes (max ~2MB). Reduce chunk count or size.`);
  }
}

async function makeEmbeddingRequest(apiKey: string, payload: EmbeddingPayload): Promise<Response> {
  const response = await fetch(API_CONFIG.OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleApiError(response, payload);
  }

  return response;
}

async function handleApiError(res: Response, payload: EmbeddingPayload): Promise<never> {
  const errorText = await res.text().catch(() => '');
  console.error(`[Embedding Debug] API Error ${res.status}:`, sanitizeForLogging(errorText));
  console.error(`[Embedding Debug] Request payload size: ${JSON.stringify(payload).length} bytes`);

  if (res.status === API_CONFIG.HTTP_UNAUTHORIZED) {
    throw new Error('Embedding API authentication failed');
  } else if (res.status === API_CONFIG.HTTP_RATE_LIMIT) {
    throw new Error('Embedding API rate limit exceeded');
  } else if (res.status >= API_CONFIG.HTTP_SERVER_ERROR) {
    throw new Error('Embedding API server error');
  } else {
    throw new Error(`Embedding API error ${res.status}`);
  }
}

async function parseEmbeddingResponse(response: Response): Promise<EmbeddingResponse> {
  let json: OpenAIEmbeddingResponse;
  try {
    json = await response.json();
  } catch (e) {
    throw new Error('Embedding API returned invalid JSON');
  }
  
  const data = Array.isArray(json?.data) ? json.data : [];
  const vectors = data
    .map((d: EmbeddingData) => (Array.isArray(d?.embedding) ? d.embedding : undefined))
    .filter((v: number[] | undefined): v is number[] => Array.isArray(v));
  console.log(`[Embedding Debug] Success: ${vectors.length} embeddings received`);
  return { embeddings: vectors };
}
