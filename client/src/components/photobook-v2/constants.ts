import { AlbumConfig } from './types';

export const DPI = 300;
export const DISPLAY_DPI = 150;
const CM_TO_INCH = 1 / 2.54;

export const ALBUM_SIZES: Record<string, AlbumConfig> = {
  '8x8': {
    id: '8x8',
    name: '8 x 8 (21.1cm x 21.1cm)',
    widthInches: 21.1 * CM_TO_INCH,
    heightInches: 21.1 * CM_TO_INCH,
    dpi: DPI,
  },
  '8x10': {
    id: '8x10',
    name: '8 x 10 (28.1cm x 21.1cm)',
    widthInches: 28.1 * CM_TO_INCH,
    heightInches: 21.1 * CM_TO_INCH,
    dpi: DPI,
  },
  '10x10': {
    id: '10x10',
    name: '10 x 10 (26.2cm x 26.2cm)',
    widthInches: 26.2 * CM_TO_INCH,
    heightInches: 26.2 * CM_TO_INCH,
    dpi: DPI,
  },
  '12x12': {
    id: '12x12',
    name: '12 x 12 (31.3cm x 31.3cm)',
    widthInches: 31.3 * CM_TO_INCH,
    heightInches: 31.3 * CM_TO_INCH,
    dpi: DPI,
  },
  'A4': {
    id: 'A4',
    name: 'A4 (21cm x 29.7cm)',
    widthInches: 21 * CM_TO_INCH,
    heightInches: 29.7 * CM_TO_INCH,
    dpi: DPI,
  },
};

export const INITIAL_ALBUM = ALBUM_SIZES['8x8'];

export const BLEED_INCHES = 0.3 * CM_TO_INCH;
