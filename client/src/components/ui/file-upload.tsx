import React, { useState, useRef } from 'react';
import { Upload, FileType2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { useAuthContext } from '@/lib/AuthProvider';
import { uploadToFirebase, uploadToServer, UploadProgress } from '@/services/firebase-upload';
import { ensureFirebaseAuth } from '@/lib/firebase';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  onFileSelect?: (file: File) => void; // 기존 호환성 유지
  onUploadComplete?: (url: string) => void; // 새로운 방식: 업로드 완료 시 URL 전달
  onUploadError?: (error: string) => void; // 업로드 실패 시 콜백
  autoUpload?: boolean; // true면 파일 선택 시 자동 업로드
  className?: string;
  uploadButtonText?: string; // 업로드 버튼 텍스트
}

export function FileUpload({
  accept = '*',
  maxSize = 5 * 1024 * 1024, // 5MB default
  onFileSelect,
  onUploadComplete,
  onUploadError,
  autoUpload = false,
  className,
  uploadButtonText = '업로드',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔥 Firebase Direct Upload: AuthContext에서 업로드 모드 가져오기
  const { uploadMode, isFirebaseReady } = useAuthContext();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const validateFile = (file: File): boolean => {
    // Check if the file type is accepted
    if (accept !== '*') {
      const fileType = file.type;
      const acceptedTypes = accept.split(',').map(type => type.trim());

      if (!acceptedTypes.some(type => {
        if (type.includes('/*')) {
          // Handle wildcards like 'image/*'
          const category = type.split('/')[0];
          return fileType.startsWith(`${category}/`);
        }
        return type === fileType;
      })) {
        setErrorMessage(`지원하지 않는 파일 형식입니다. 허용된 형식: ${accept}`);
        return false;
      }
    }

    // Check file size
    if (maxSize && file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      setErrorMessage(`파일 크기가 너무 큽니다. 최대 ${maxSizeMB}MB까지 업로드 가능합니다.`);
      return false;
    }

    return true;
  };

  const handleFileChange = (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);

    // 기존 API 호환성 유지
    if (onFileSelect) {
      onFileSelect(file);
    }

    // 🔥 자동 업로드 활성화 시 즉시 업로드
    if (autoUpload && onUploadComplete) {
      handleUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  /**
   * 🔥 스마트 업로드 함수
   * uploadMode에 따라 Firebase 또는 서버 업로드를 자동 선택
   * Firebase 실패 시 자동으로 서버 업로드로 Fallback
   */
  const handleUpload = async (file?: File) => {
    const fileToUpload = file || selectedFile;

    if (!fileToUpload) {
      setErrorMessage('업로드할 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      let uploadedUrl: string;

      // 🔥 Firebase Direct Upload 시도
      if (uploadMode === 'FIREBASE' && isFirebaseReady) {
        setUploadStatus('Firebase Storage에 업로드 중...');
        console.log('🔥 Firebase Direct Upload 시작');

        try {
          // Firebase 인증 확인 (토큰 만료 대비)
          const isAuthed = await ensureFirebaseAuth();

          if (!isAuthed) {
            console.warn('⚠️ Firebase 인증 실패, 서버 업로드로 전환');
            throw new Error('Firebase 인증 실패');
          }

          // Firebase 업로드 (진행률 추적)
          const result = await uploadToFirebase(fileToUpload, (progress: UploadProgress) => {
            setUploadProgress(progress.percentage);
            setUploadStatus(`업로드 중... ${progress.percentage.toFixed(1)}%`);
          });

          uploadedUrl = result.url;
          console.log('✅ Firebase 업로드 성공:', uploadedUrl);

        } catch (firebaseError) {
          // 🔄 Fallback: Firebase 실패 시 서버 업로드
          console.warn('⚠️ Firebase 업로드 실패, 서버 업로드로 전환:', firebaseError);
          setUploadStatus('서버 업로드로 전환 중...');
          setUploadProgress(0);

          uploadedUrl = await uploadToServer(fileToUpload);
          console.log('✅ 서버 업로드 성공 (Fallback):', uploadedUrl);
        }
      }
      // 서버 업로드
      else {
        setUploadStatus('서버에 업로드 중...');
        console.log('📤 서버 업로드 시작');

        uploadedUrl = await uploadToServer(fileToUpload);
        setUploadProgress(100);
        console.log('✅ 서버 업로드 성공:', uploadedUrl);
      }

      // 업로드 성공
      setUploadStatus('업로드 완료!');

      if (onUploadComplete) {
        onUploadComplete(uploadedUrl);
      }

      // 상태 초기화
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        setSelectedFile(null);
      }, 1500);

    } catch (error) {
      console.error('❌ 업로드 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.';
      setErrorMessage(errorMsg);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');

      if (onUploadError) {
        onUploadError(errorMsg);
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleManualUpload = () => {
    if (selectedFile) {
      handleUpload(selectedFile);
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {/* 파일 드롭 영역 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-gray-300 hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          ) : (
            <Upload className="h-12 w-12 text-gray-400" />
          )}

          <div className="text-sm text-gray-600">
            {isUploading ? (
              <span className="font-medium text-primary">{uploadStatus}</span>
            ) : selectedFile ? (
              <span className="font-medium text-green-600">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            ) : (
              <>
                <span className="font-medium text-primary">클릭하여 파일 선택</span>
                <span className="text-gray-500"> 또는 드래그 앤 드롭</span>
              </>
            )}
          </div>

          {accept !== '*' && !isUploading && !selectedFile && (
            <p className="text-xs text-gray-500">
              허용된 형식: {accept}
            </p>
          )}

          {maxSize && !isUploading && !selectedFile && (
            <p className="text-xs text-gray-500">
              최대 크기: {(maxSize / (1024 * 1024)).toFixed(1)}MB
            </p>
          )}
        </div>

        {/* 진행률 표시 */}
        {isUploading && uploadProgress > 0 && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="w-full" />
            <p className="mt-1 text-xs text-gray-500 text-center">
              {uploadProgress.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* 수동 업로드 버튼 (autoUpload가 false일 때만 표시) */}
      {!autoUpload && selectedFile && !isUploading && onUploadComplete && (
        <Button
          onClick={handleManualUpload}
          className="mt-4 w-full"
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploadButtonText}
        </Button>
      )}

      {/* 에러 다이얼로그 */}
      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>업로드 오류</AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">{errorMessage}</p>
          </div>
          <AlertDialogFooter>
            <Button onClick={() => setErrorMessage(null)}>확인</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 업로드 모드 디버깅 정보 (개발 환경에서만) */}
      {import.meta.env.DEV && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          업로드 모드: {uploadMode} | Firebase: {isFirebaseReady ? '준비됨' : '미준비'}
        </div>
      )}
    </div>
  );
}