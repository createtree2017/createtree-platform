
export enum ImageStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  SUCCESS = 'success',
  ERROR = 'error',
}

export type SnapCategory = 'daily' | 'travel' | 'film';

export interface GeneratedImage {
  id: number;
  prompt: string;
  src: string | null;
  status: ImageStatus;
  category: SnapCategory;
}

export interface UploadedImage {
  base64: string;
  mimeType: string;
  objectUrl: string;
}

export interface Prompt {
  text: string;
  category: SnapCategory;
  type: 'individual' | 'couple';
  gender: 'female' | 'male' | 'unisex';
}