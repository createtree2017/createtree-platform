import { getStorage, ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from "firebase/storage";
import { getCurrentFirebaseUser } from '@/lib/firebase';

/**
 * Firebase Direct Upload 서비스
 * 클라이언트에서 Firebase Storage에 직접 파일을 업로드합니다.
 */

export interface UploadProgress {
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
}

export interface UploadResult {
    url: string;
    storagePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}

/**
 * Firebase Storage에 파일 업로드
 * @param file - 업로드할 파일
 * @param onProgress - 진행률 콜백 (선택)
 * @returns 업로드된 파일의 다운로드 URL 및 메타데이터
 */
export async function uploadToFirebase(
    file: File,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
    const user = getCurrentFirebaseUser();

    if (!user) {
        throw new Error('Firebase 인증이 필요합니다. 로그인 후 다시 시도해주세요.');
    }

    const storage = getStorage();

    // 파일 경로: uploads/user_{userId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // 안전한 파일명
    const filePath = `uploads/${user.uid}/${timestamp}_${safeFileName}`;
    const storageRef = ref(storage, filePath);

    console.log(`🔥 Firebase 업로드 시작: ${filePath} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // 🔥 업로드 태스크 생성 (진행률 추적 가능)
    const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type
    });

    return new Promise((resolve, reject) => {
        // ⏱️ 10초 타임아웃: CORS 등 네트워크 에러 시 Firebase SDK가 무한 재시도하므로
        // 타임아웃으로 강제 실패 처리하여 서버 업로드 fallback이 작동하도록 함
        const uploadTimeout = setTimeout(() => {
            console.warn('⏱️ Firebase 업로드 타임아웃 (10초), 업로드 취소 및 서버 업로드로 전환');
            uploadTask.cancel();
        }, 10000);

        uploadTask.on(
            'state_changed',
            // 진행률 핸들러
            (snapshot: UploadTaskSnapshot) => {
                const progress: UploadProgress = {
                    bytesTransferred: snapshot.bytesTransferred,
                    totalBytes: snapshot.totalBytes,
                    percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                };

                if (onProgress) {
                    onProgress(progress);
                }

                // 진행이 있으면 타임아웃 연장 (정상 업로드 중)
                if (progress.percentage > 0) {
                    clearTimeout(uploadTimeout);
                }

                console.log(`📊 업로드 진행률: ${progress.percentage.toFixed(1)}%`);
            },
            // 에러 핸들러
            (error) => {
                clearTimeout(uploadTimeout);
                console.error('❌ Firebase 업로드 실패:', error);

                // Firebase 에러 코드에 따른 사용자 친화적 메시지
                let userMessage = '파일 업로드에 실패했습니다.';

                if (error.code === 'storage/unauthorized') {
                    userMessage = '업로드 권한이 없습니다. 로그인 상태를 확인해주세요.';
                } else if (error.code === 'storage/canceled') {
                    userMessage = 'Firebase 업로드 시간 초과, 서버 업로드로 전환합니다.';
                } else if (error.code === 'storage/quota-exceeded') {
                    userMessage = '저장 공간이 부족합니다.';
                }

                reject(new Error(userMessage));
            },
            // 완료 핸들러
            async () => {
                clearTimeout(uploadTimeout);
                try {
                    // 다운로드 URL 받기
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('✅ Firebase 업로드 완료:', downloadURL);

                    const result: UploadResult = {
                        url: downloadURL,
                        storagePath: filePath,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type
                    };

                    // 🔥 서버에 URL 저장 (DB 기록)
                    try {
                        const saveResponse = await fetch('/api/save-url', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                                imageUrl: result.url,
                                storagePath: result.storagePath,
                                fileName: result.fileName,
                                fileSize: result.fileSize,
                                mimeType: result.mimeType
                            })
                        });

                        if (!saveResponse.ok) {
                            console.warn('⚠️ 서버 URL 저장 실패, 하지만 파일은 업로드됨:', await saveResponse.text());
                        } else {
                            const saveData = await saveResponse.json();
                            console.log('✅ 서버 DB에 URL 저장 완료:', saveData.imageId);
                        }
                    } catch (saveError) {
                        console.error('❌ 서버 URL 저장 중 오류 (파일은 업로드됨):', saveError);
                        // 파일은 이미 업로드되었으므로 에러를 throw하지 않음
                    }

                    resolve(result);
                } catch (error) {
                    console.error('❌ 다운로드 URL 받기 실패:', error);
                    reject(error);
                }
            }
        );
    });
}

/**
 * 서버 업로드 (기존 방식)
 * Firebase 업로드 실패 시 Fallback으로 사용
 */
export async function uploadToServer(file: File): Promise<string> {
    console.log('📤 서버 업로드 시작 (기존 방식)');

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`서버 업로드 실패: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ 서버 업로드 완료:', data.url);

    return data.url;
}

/**
 * 다중 파일 업로드 진행률
 */
export interface MultiFileProgress {
    completedFiles: number;
    totalFiles: number;
    currentFile: number;
    currentFileProgress: number;
    currentFileName: string;
}

/**
 * 다중 파일을 Firebase에 병렬 업로드
 * 
 * @param files - 업로드할 파일 배열
 * @param onProgress - 전체 진행률 콜백 (선택)
 * @returns 업로드된 파일들의 URL 배열
 * 
 * @throws 하나라도 실패하면 롤백 후 에러 throw
 * 
 * @example
 * const urls = await uploadMultipleToFirebase(files, (progress) => {
 *   console.log(`${progress.completedFiles}/${progress.totalFiles} 완료`);
 * });
 */
export async function uploadMultipleToFirebase(
    files: File[],
    onProgress?: (progress: MultiFileProgress) => void
): Promise<string[]> {
    if (files.length === 0) {
        throw new Error('업로드할 파일이 없습니다');
    }

    const totalFiles = files.length;
    let completedFiles = 0;
    const uploadedUrls: string[] = [];
    const uploadedPaths: string[] = [];

    console.log(`🔥 다중 파일 업로드 시작: ${totalFiles}개`);

    try {
        // 병렬 업로드 (Promise.all 사용)
        const uploadPromises = files.map(async (file, index) => {
            console.log(`📤 [${index + 1}/${totalFiles}] ${file.name} 업로드 시작`);

            const result = await uploadToFirebase(file, (fileProgress) => {
                // 개별 파일 진행률을 전체 진행률로 변환
                if (onProgress) {
                    onProgress({
                        completedFiles,
                        totalFiles,
                        currentFile: index + 1,
                        currentFileProgress: fileProgress.percentage,
                        currentFileName: file.name
                    });
                }
            });

            // 성공한 파일 기록
            uploadedUrls.push(result.url);
            uploadedPaths.push(result.storagePath);

            completedFiles++;

            // 파일 완료 진행률 업데이트
            if (onProgress) {
                onProgress({
                    completedFiles,
                    totalFiles,
                    currentFile: index + 1,
                    currentFileProgress: 100,
                    currentFileName: file.name
                });
            }

            console.log(`✅ [${index + 1}/${totalFiles}] ${file.name} 업로드 완료`);

            return result.url;
        });

        // 모든 업로드 완료 대기 (하나라도 실패하면 전체 실패)
        const urls = await Promise.all(uploadPromises);

        console.log(`🎉 전체 업로드 완료: ${urls.length}개 파일`);

        return urls;

    } catch (error) {
        // 실패 시 이미 업로드된 파일들 삭제 (rollback)
        console.error('❌ 업로드 실패, 롤백 시작:', error);

        await rollbackUploadedFiles(uploadedPaths);

        throw new Error(
            error instanceof Error
                ? error.message
                : '파일 업로드 중 오류가 발생했습니다'
        );
    }
}

/**
 * 업로드된 파일들 삭제 (롤백)
 * 
 * @param storagePaths - 삭제할 파일 경로 배열
 */
async function rollbackUploadedFiles(storagePaths: string[]): Promise<void> {
    if (storagePaths.length === 0) {
        console.log('ℹ️ 롤백할 파일 없음');
        return;
    }

    console.log(`🔄 롤백 시작: ${storagePaths.length}개 파일 삭제`);

    const storage = getStorage();
    const deletePromises = storagePaths.map(async (path) => {
        try {
            const fileRef = ref(storage, path);
            const { deleteObject } = await import('firebase/storage');
            await deleteObject(fileRef);
            console.log(`✅ 롤백 완료: ${path}`);
        } catch (err) {
            // 삭제 실패해도 계속 진행 (이미 삭제되었을 수 있음)
            console.warn(`⚠️ 롤백 실패 (무시): ${path}`, err);
        }
    });

    await Promise.allSettled(deletePromises);
    console.log('🔄 롤백 완료');
}
