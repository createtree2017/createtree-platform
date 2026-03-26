import React from "react";
import { Leaf } from "lucide-react";

interface CreationTreeProgressProps {
    completedTopics: number;
    totalTopics: number;
    isAllCompleted: boolean;
    treeName?: string; // Default to "사과몽"
    stageImages?: string[]; // DB에서 내려온 단계별 이미지 URL 배열
}

export default function CreationTreeProgress({
    completedTopics,
    totalTopics,
    isAllCompleted,
    treeName = "사과몽",
    stageImages = [],
}: CreationTreeProgressProps) {
    // 1. 관리자가 설정한 단계 이미지 수를 최대 레벨로 사용 (없으면 기본 10단계)
    const maxLevel = stageImages.length > 0 ? stageImages.length : 10;
    const safeTotal = totalTopics > 0 ? totalTopics : 1;
    const progressPercent = (completedTopics / safeTotal) * 100;

    let currentLevel = Math.ceil((progressPercent / 100) * maxLevel);
    if (currentLevel < 1) currentLevel = 1;
    if (currentLevel > maxLevel) currentLevel = maxLevel;
    if (completedTopics >= safeTotal) currentLevel = maxLevel;
    if (completedTopics === 0) currentLevel = 1;

    // 이미지 경로: DB 배열 우선, 없으면 정적 파일 폴백
    const stageIndex = currentLevel - 1;
    const treeImagePath = stageImages.length > 0
        ? (stageImages[Math.min(stageIndex, stageImages.length - 1)] || '/icons/icon-192x192.png')
        : `/src/assets/images/tree/apple_mong_stage_${currentLevel}.png`;

    return (
        <div className="w-full relative flex flex-col items-center mb-8 mt-2">
            {/* Status Pill */}
            <div className="bg-black/30 backdrop-blur-md px-5 py-2 rounded-full flex items-center gap-2 border border-white/10 z-10 mb-[-1rem]">
                <Leaf className="h-5 w-5 text-green-400" />
                <p className="text-gray-200 text-sm font-bold tracking-wide shadow-sm">
                    Lv.{currentLevel} {treeName}
                </p>
            </div>

            {/* Tree Avatar / Hero Character Container */}
            <div className="w-full relative flex justify-center py-4 min-h-[340px] items-center">
                {/* Subtle dark glow behind the tree */}
                <div className="absolute w-48 h-48 bg-gradient-to-tr from-amber-500/10 to-transparent rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

                <div
                    className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center"
                    key={`tree-level-${currentLevel}`}
                >
                    <img
                        src={treeImagePath}
                        alt={`Level ${currentLevel} Tree`}
                        className="w-full h-full object-contain drop-shadow-2xl transition-all duration-700"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/icons/icon-192x192.png';
                        }}
                    />
                </div>
            </div>

        </div>
    );
}
