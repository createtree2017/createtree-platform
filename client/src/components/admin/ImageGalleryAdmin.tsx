import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadMedia, shareMedia } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

// Image Gallery Component
interface ImageItem {
    id: number;
    title: string;
    url?: string;
    transformedUrl?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    createdAt: string;
    type?: string;
    style?: string;
    isFavorite?: boolean;
}

export default function ImageGalleryAdmin() {
    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalImages, setTotalImages] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const imagesPerPage = 10;

    // 페이지 변경 시 쿼리 갱신
    useEffect(() => {
        // 페이지가 변경되면 쿼리가 자동으로 다시 실행됨 (queryKey에 currentPage가 포함되어 있음)
        console.log(`페이지 변경: ${currentPage}`);
    }, [currentPage]);

    // 새로운 캐시 키 생성용 카운터
    const [refreshCounter, setRefreshCounter] = useState(0);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["/api/admin/images", currentPage],
        staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
        refetchOnWindowFocus: false, // 자동 갱신 제거
        refetchOnMount: true, // 마운트 시에만 새로 불러오기

        // API 요청 함수
        queryFn: async () => {
            const response = await fetch(`/api/admin/images?page=${currentPage}&limit=${imagesPerPage}`, {
                credentials: 'include',
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                }
            });

            if (!response.ok) {
                throw new Error("이미지 목록을 불러오는 데 실패했습니다");
            }

            const result = await response.json();
            // API 응답에서 페이지네이션 정보 업데이트
            if (result.pagination) {
                setTotalImages(result.pagination.totalItems || result.pagination.total);
                setTotalPages(result.pagination.totalPages);
            }

            return result;
        }
    });

    // 이미지 데이터 추출
    const images = data?.images || [];

    const queryClient = useQueryClient();

    const [viewImageDialog, setViewImageDialog] = useState(false);
    const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

    const handleViewImage = (image: ImageItem) => {
        setSelectedImage(image);
        setViewImageDialog(true);
    };

    // 이미지 형식 선택 상태 (기본값은 PNG)
    const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

    const handleDownloadClick = (image: ImageItem) => {
        setSelectedImage(image);
        setDownloadDialogOpen(true);
    };

    const handleDownload = async (image: ImageItem, format: 'png' | 'jpeg' = 'png') => {
        try {
            // 이미지 URL 가져오기
            const imageUrl = image.transformedUrl || image.url;
            if (!imageUrl) {
                throw new Error("이미지 URL이 유효하지 않습니다.");
            }

            // 이미지 다운로드 링크 생성 및 자동 클릭
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = `${image.title || 'image'}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 다운로드 대화상자 닫기
            setDownloadDialogOpen(false);

            toast({
                title: "다운로드 중",
                description: `이미지가 ${format.toUpperCase()} 형식으로 다운로드됩니다.`,
            });

            // 백엔드 API도 호출하여 로그 기록
            try {
                await downloadMedia(image.id, 'image');
            } catch (backendError) {
                console.warn("백엔드 다운로드 로깅 실패:", backendError);
            }
        } catch (error) {
            console.error("Error downloading image:", error);
            toast({
                title: "다운로드 실패",
                description: "이미지 다운로드 중 오류가 발생했습니다.",
                variant: "destructive",
            });
        }
    };

    const handleShare = async (image: ImageItem) => {
        try {
            const result = await shareMedia(image.id, 'image');
            console.log("공유 응답:", result);

            if (result.shareUrl) {
                // Copy to clipboard
                try {
                    await navigator.clipboard.writeText(result.shareUrl);
                    toast({
                        title: "공유 링크 생성됨",
                        description: "공유 링크가 클립보드에 복사되었습니다.",
                    });
                    // URL 열기
                    window.open(result.shareUrl, '_blank');
                } catch (clipboardErr) {
                    console.error("클립보드 복사 실패:", clipboardErr);
                    toast({
                        title: "공유 링크 생성됨",
                        description: `공유 URL: ${result.shareUrl}`,
                    });
                    // URL 열기
                    window.open(result.shareUrl, '_blank');
                }
            } else {
                toast({
                    title: "공유 실패",
                    description: "유효한 공유 링크를 얻지 못했습니다.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error sharing image:", error);
            toast({
                title: "공유 실패",
                description: "이미지 공유 링크 생성 중 오류가 발생했습니다.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold">전체 이미지 갤러리 (관리자 모니터링)</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        {totalImages > 0 && `총 ${totalImages}개 이미지 • 썸네일 우선 로딩으로 최적화됨`}
                    </p>
                </div>
                <div className="flex space-x-2">
                    <Button
                        onClick={() => refetch()}
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                    >
                        {isLoading ? "새로고침 중..." : "새로고침"}
                    </Button>
                </div>
            </div>

            {isLoading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600">이미지 로딩 중...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-medium">이미지 로딩 실패</p>
                    <p className="text-sm">{(error as Error).message}</p>
                </div>
            )}

            {images.length === 0 && !isLoading && (
                <div className="text-center py-12 text-gray-500">
                    <div className="mb-4">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-lg font-medium">아직 생성된 이미지가 없습니다</p>
                    <p className="text-sm">사용자들이 이미지를 생성하면 여기에 표시됩니다</p>
                </div>
            )}

            {images.length > 0 && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
                        {images.map((image: ImageItem) => (
                            <div key={image.id} className="relative group">
                                <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-300 transition-colors">
                                    <img
                                        src={image.url || ''} // 썸네일 우선 URL (서버에서 resolveImageUrl 적용됨)
                                        alt={image.title || `이미지 ${image.id}`}
                                        className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                                        onClick={() => handleViewImage(image)}
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            // 인라인 SVG fallback (네트워크 요청 없음)
                                            target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f0f0f0'/%3E%3Ctext x='200' y='200' font-family='Arial' font-size='16' fill='%23999' text-anchor='middle' dominant-baseline='middle'%3EError%3C/text%3E%3C/svg%3E`;
                                            target.onerror = null; // 무한 루프 방지
                                        }}
                                        loading="lazy" // 브라우저 네이티브 lazy loading
                                    />

                                    {/* 사용자 정보 오버레이 */}
                                    <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                                        {(image as any).username || '알 수 없음'}
                                    </div>

                                    {/* 이미지 정보 오버레이 */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white p-3">
                                        <div className="font-medium text-sm truncate">{image.title || `이미지 ${image.id}`}</div>
                                        <div className="text-xs text-gray-300 flex justify-between items-center">
                                            <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                                            <span className="bg-blue-500 px-2 py-0.5 rounded-full text-xs">
                                                ID: {image.id}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center space-x-4 py-4 border-t">
                            <Button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                size="sm"
                                variant="outline"
                            >
                                처음
                            </Button>
                            <Button
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                size="sm"
                                variant="outline"
                            >
                                이전
                            </Button>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                    페이지 {currentPage} / {totalPages}
                                </span>
                                <span className="text-xs text-gray-500">
                                    (총 {totalImages}개 이미지)
                                </span>
                            </div>
                            <Button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                size="sm"
                                variant="outline"
                            >
                                다음
                            </Button>
                            <Button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                size="sm"
                                variant="outline"
                            >
                                마지막
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
