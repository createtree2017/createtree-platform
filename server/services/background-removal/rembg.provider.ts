import type {
  BackgroundRemovalHealth,
  BackgroundRemovalModelSize,
  BackgroundRemovalProvider,
  ProviderRemoveBackgroundOptions,
} from './backgroundRemoval.types';

const DEFAULT_TIMEOUT_MS = 60_000;
const PROVIDER_NAME = 'rembg-http';

function getServiceUrl(): string | null {
  const rawUrl = process.env.BACKGROUND_REMOVAL_SERVICE_URL?.trim();
  if (!rawUrl) return null;
  return rawUrl.replace(/\/+$/, '');
}

function getTimeoutMs(): number {
  const rawTimeout = Number(process.env.BACKGROUND_REMOVAL_TIMEOUT_MS);
  return Number.isFinite(rawTimeout) && rawTimeout > 0
    ? rawTimeout
    : DEFAULT_TIMEOUT_MS;
}

function resolveRembgModel(model: BackgroundRemovalModelSize): string {
  if (model === 'small') {
    return process.env.BACKGROUND_REMOVAL_MODEL_SMALL || 'isnet-general-use';
  }

  return process.env.BACKGROUND_REMOVAL_MODEL_MEDIUM || 'birefnet-general';
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = getTimeoutMs()
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export class RembgHttpProvider implements BackgroundRemovalProvider {
  async removeBackground(
    imageBuffer: Buffer,
    options: ProviderRemoveBackgroundOptions
  ): Promise<Buffer> {
    const serviceUrl = getServiceUrl();
    if (!serviceUrl) {
      throw new Error('BACKGROUND_REMOVAL_SERVICE_URL 환경변수가 설정되지 않았습니다');
    }

    const formData = new FormData();
    formData.append(
      'image',
      new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }),
      'image.png'
    );
    formData.append('model', resolveRembgModel(options.model));
    formData.append('quality', String(options.quality));

    const response = await fetchWithTimeout(`${serviceUrl}/remove-background`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `rembg service failed (${response.status}): ${errorText || response.statusText}`
      );
    }

    const result = await response.arrayBuffer();
    return Buffer.from(result);
  }

  async checkHealth(): Promise<BackgroundRemovalHealth> {
    const serviceUrl = getServiceUrl();
    if (!serviceUrl) {
      return {
        configured: false,
        healthy: false,
        provider: PROVIDER_NAME,
        message: 'BACKGROUND_REMOVAL_SERVICE_URL is not configured',
      };
    }

    try {
      const response = await fetchWithTimeout(`${serviceUrl}/health`, {
        method: 'GET',
      }, 10_000);

      return {
        configured: true,
        healthy: response.ok,
        provider: PROVIDER_NAME,
        message: response.ok ? 'ok' : `health check failed: ${response.status}`,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        provider: PROVIDER_NAME,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
