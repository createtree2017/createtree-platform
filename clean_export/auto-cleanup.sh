#!/bin/bash
# 자동 서버 정리 스크립트
# 매일 자동 실행용

echo "$(date): 자동 정리 시작" >> cleanup.log

# 7일 이상 오래된 임시 파일 삭제
find uploads/ -name "file-*" -mtime +7 -delete 2>/dev/null
find uploads/ -name "image-*" -mtime +7 -delete 2>/dev/null  
find uploads/ -name "thumbnail-*" -mtime +7 -delete 2>/dev/null

# 빈 폴더 정리
find uploads/ -type d -empty -delete 2>/dev/null

# 10MB 이상 로그 파일 정리
find . -name "*.log" -size +10M -delete 2>/dev/null

echo "$(date): 자동 정리 완료" >> cleanup.log
