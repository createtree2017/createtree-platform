import { useState } from 'react';
import { X, Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { ExportFormat, ExportQuality, ExportOptions, exportAllDesigns } from '../../utils/postcardExport';
import { PostcardDesign, VariantConfig } from './types';

interface DownloadFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  designs: PostcardDesign[];
  variantConfig: VariantConfig;
  projectTitle: string;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string; icon: typeof FileImage }[] = [
  { value: 'webp', label: 'WebP', description: '고화질, 작은 용량 (웹 최적화)', icon: FileImage },
  { value: 'jpeg', label: 'JPEG', description: '범용 포맷 (높은 호환성)', icon: FileImage },
  { value: 'pdf', label: 'PDF', description: '인쇄용 (모든 디자인 한 파일)', icon: FileText },
];

const QUALITY_OPTIONS: { value: ExportQuality; label: string; description: string }[] = [
  { value: 'high', label: '고화질 (150 DPI)', description: '빠른 다운로드, 화면 보기용' },
  { value: 'print', label: '인쇄용 (300 DPI)', description: '최고 품질, 인쇄 추천' },
];

export const DownloadFormatModal: React.FC<DownloadFormatModalProps> = ({
  isOpen,
  onClose,
  designs,
  variantConfig,
  projectTitle,
}) => {
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState<ExportQuality>('print');
  const [includeBleed, setIncludeBleed] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    try {
      const options: ExportOptions = { format, quality, includeBleed };
      const safeFilename = projectTitle.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
      
      await exportAllDesigns(designs, variantConfig, options, safeFilename);
      
      setProgress(100);
      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setProgress(0);
      }, 500);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">다운로드 설정</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isExporting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              파일 형식
            </label>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    format === option.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={option.value}
                    checked={format === option.value}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    className="sr-only"
                  />
                  <option.icon className={`w-5 h-5 mr-3 ${
                    format === option.value ? 'text-indigo-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              품질 설정
            </label>
            <div className="space-y-2">
              {QUALITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    quality === option.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="quality"
                    value={option.value}
                    checked={quality === option.value}
                    onChange={(e) => setQuality(e.target.value as ExportQuality)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors">
              <input
                type="checkbox"
                checked={includeBleed}
                onChange={(e) => setIncludeBleed(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div className="ml-3 flex-1">
                <div className="font-medium text-gray-900">재단선 포함</div>
                <div className="text-xs text-gray-500">인쇄 시 필요한 여백 영역 포함</div>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600 mb-4">
              총 {designs.length}개 디자인을 다운로드합니다
              {format === 'pdf' && ' (1개 PDF 파일)'}
              {format !== 'pdf' && designs.length > 1 && ` (${designs.length}개 파일)`}
            </div>

            {isExporting && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting || designs.length === 0}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  다운로드 중...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  다운로드
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
