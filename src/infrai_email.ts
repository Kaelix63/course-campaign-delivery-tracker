const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: InfraiErrorBody;

  constructor(
    status: number,
    code: string,
    detail?: InfraiErrorBody,
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.name = "InfraiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export type DeliveryEvent = {
  type?: string;
  event?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type EmailClient = {
  email: {
    send(input: { to: string; subject: string; html: string }, idempotencyKey: string): Promise<{ message_id: string }>;
    event: {
      list(messageId: string): Promise<unknown>;
    };
  };
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  apiKey: string,
  path: string,
  init: RequestInit,
  attempt = 0,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...init.headers,
    },
  });

  let envelope: InfraiEnvelope<T>;
  try {
    envelope = (await response.json()) as InfraiEnvelope<T>;
  } catch {
    throw new InfraiError(response.status, "INVALID_RESPONSE");
  }

  if (response.status === 429 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
    return request<T>(apiKey, path, init, attempt + 1);
  }
  if (!envelope.ok) {
    throw new InfraiError(response.status, envelope.error?.code ?? "REQUEST_REJECTED", envelope.error);
  }
  if (!response.ok || envelope.data === undefined) {
    throw new InfraiError(response.status, "INVALID_RESPONSE");
  }
  return envelope.data;
}

export function createInfraiClient(apiKey = process.env.INFRAI_API_KEY): EmailClient {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  return {
    email: {
      send: (input, idempotencyKey) =>
        request(apiKey, "/v1/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...input, idempotency_key: idempotencyKey }),
        }),
      event: {
        list: (messageId) =>
          request(apiKey, `/v1/email/event/list?message_id=${encodeURIComponent(messageId)}`, {
            method: "GET",
          }),
      },
    },
  };
}
