export type BackgroundRemovalOutputType = 'foreground' | 'background';
export type BackgroundRemovalModelSize = 'small' | 'medium';

export interface BackgroundRemovalResult {
  url: string;
  gsPath: string;
  fileName: string;
}

export interface BackgroundRemovalOptions {
  type?: BackgroundRemovalOutputType;
  quality?: number;
  model?: BackgroundRemovalModelSize;
}

export interface ProviderRemoveBackgroundOptions {
  model: BackgroundRemovalModelSize;
  quality: number;
}

export interface BackgroundRemovalProvider {
  removeBackground(
    imageBuffer: Buffer,
    options: ProviderRemoveBackgroundOptions
  ): Promise<Buffer>;
  checkHealth(): Promise<BackgroundRemovalHealth>;
}

export interface BackgroundRemovalHealth {
  configured: boolean;
  healthy: boolean;
  provider: string;
  message?: string;
}
