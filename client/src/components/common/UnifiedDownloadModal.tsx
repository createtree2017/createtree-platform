import { useState, useEffect } from "react";
import { X, Download, FileImage, FileText, Loader2 } from "lucide-react";
import { 
  ExportFormat, 
  ExportCategoryConfig, 
  DesignData, 
  VariantConfig,
  exportDesigns,
  fetchExportConfig
} from "../../services/exportService";

interface UnifiedDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  categorySlug: string;
  designs: DesignData[];
  variantConfig: VariantConfig;
  projectTitle: string;
}

const FORMAT_ICONS: Record<ExportFormat, typeof FileImage> = {
  webp: FileImage,
  jpeg: FileImage,
  pdf: FileText,
};

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  webp: "고화질, 작은 용량 (웹 최적화)",
  jpeg: "범용 포맷 (높은 호환성)",
  pdf: "인쇄용 (모든 디자인 한 파일)",
};

export const UnifiedDownloadModal: React.FC<UnifiedDownloadModalProps> = ({
  isOpen,
  onClose,
  categorySlug,
  designs,
  variantConfig,
  projectTitle,
}) => {
  const [config, setConfig] = useState<ExportCategoryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<ExportFormat>("jpeg");
  const [qualityValue, setQualityValue] = useState<string>("print");
  const [includeBleed, setIncludeBleed] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && categorySlug) {
      setLoading(true);
      setError(null);
      fetchExportConfig(categorySlug)
        .then((cfg) => {
          setConfig(cfg);
          if (cfg.exportFormats.length > 0 && !cfg.exportFormats.includes(format)) {
            setFormat(cfg.exportFormats[0]);
          }
          if (cfg.qualityOptions.length > 0) {
            const defaultQuality = cfg.qualityOptions.find(q => q.dpi === cfg.defaultDpi);
            setQualityValue(defaultQuality?.value || cfg.qualityOptions[0].value);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch export config:", err);
          setError("내보내기 설정을 불러오는데 실패했습니다");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, categorySlug]);

  if (!isOpen) return null;

  const selectedQuality = config?.qualityOptions.find(q => q.value === qualityValue);
  const dpi = selectedQuality?.dpi || config?.defaultDpi || 300;

  const handleExport = async () => {
    if (!config || designs.length === 0) return;
    
    setIsExporting(true);
    setProgress(0);

    try {
      const safeFilename = projectTitle.replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
      
      await exportDesigns(
        designs,
        variantConfig,
        { format, qualityValue, dpi, includeBleed },
        safeFilename,
        (current, total) => setProgress(Math.round((current / total) * 100))
      );
      
      setProgress(100);
      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setProgress(0);
      }, 500);
    } catch (err) {
      console.error("Export failed:", err);
      setError("내보내기에 실패했습니다");
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

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-4">{error}</div>
        ) : config ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                파일 형식
              </label>
              <div className="space-y-2">
                {config.exportFormats.map((fmt) => {
                  const Icon = FORMAT_ICONS[fmt];
                  return (
                    <label
                      key={fmt}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        format === fmt
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={fmt}
                        checked={format === fmt}
                        onChange={(e) => setFormat(e.target.value as ExportFormat)}
                        className="sr-only"
                      />
                      <Icon className={`w-5 h-5 mr-3 ${
                        format === fmt ? "text-indigo-600" : "text-gray-400"
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{fmt.toUpperCase()}</div>
                        <div className="text-xs text-gray-500">{FORMAT_DESCRIPTIONS[fmt]}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                품질 설정
              </label>
              <div className="space-y-2">
                {config.qualityOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      qualityValue === option.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quality"
                      value={option.value}
                      checked={qualityValue === option.value}
                      onChange={(e) => setQualityValue(e.target.value)}
                      className="sr-only"
                    />
                    <div className="w-5 h-5 mr-3 rounded-full border-2 flex items-center justify-center ${
                      qualityValue === option.value 
                        ? 'border-indigo-600' 
                        : 'border-gray-300'
                    }">
                      {qualityValue === option.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{option.label}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {config.supportsBleed && (
              <div>
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <div>
                    <div className="font-medium text-gray-900">도련 포함</div>
                    <div className="text-xs text-gray-500">인쇄 시 여백 (각 {variantConfig.bleedMm}mm)</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeBleed}
                    onChange={(e) => setIncludeBleed(e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                </label>
              </div>
            )}

            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>내보내는 중...</span>
                  <span>{progress}%</span>
                </div>
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
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  내보내는 중...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  다운로드 ({designs.length}개 디자인)
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default UnifiedDownloadModal;
