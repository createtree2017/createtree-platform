import React from "react";
import { Target, Droplets, Sun, Leaf } from "lucide-react";

interface CreationTreeProgressProps {
    completedTopics: number;
    totalTopics: number;
    isAllCompleted: boolean;
    treeName?: string; // Default to "창조트리" if user hasn't named it
}

export default function CreationTreeProgress({
    completedTopics,
    totalTopics,
    isAllCompleted,
    treeName = "사과몽",
}: CreationTreeProgressProps) {
    // 1. Calculate Progress Level (1 to 10)
    // Avoid division by zero
    const safeTotal = totalTopics > 0 ? totalTopics : 1;
    const progressPercent = (completedTopics / safeTotal) * 100;

    let currentLevel = Math.ceil((progressPercent / 100) * 10);
    // Boundary checks
    if (currentLevel < 1) currentLevel = 1; // Stage 1 min
    if (currentLevel > 10) currentLevel = 10; // Stage 10 max

    // Exception: If 100% completed, enforce level 10
    if (completedTopics >= safeTotal) currentLevel = 10;

    // Fallback: if totalTopics is very large but completed is 0, keep it at level 1
    if (completedTopics === 0) currentLevel = 1;

    // Image path resolution
    const treeImagePath = `/src/assets/images/tree/apple_mong_stage_${currentLevel}.png`;

    return (
        <div className="w-full relative flex flex-col items-center mb-8 mt-2">
            {/* Status Pill */}
            <div className="bg-black/30 backdrop-blur-md px-5 py-2 rounded-full flex items-center gap-2 border border-white/10 z-10 mb-[-1rem]">
                <Leaf className="h-5 w-5 text-green-400" />
                <p className="text-gray-200 text-sm font-bold tracking-wide shadow-sm">
                    Lv.{currentLevel} 쑥쑥 자라는 {treeName}
                </p>
            </div>

            {/* Tree Avatar / Hero Character Container */}
            <div className="w-full relative flex justify-center py-6 min-h-[220px] items-center">
                {/* Subtle dark glow behind the tree */}
                <div className="absolute w-48 h-48 bg-gradient-to-tr from-amber-500/10 to-transparent rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

                <div
                    className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center animate-in fade-in zoom-in duration-500"
                    key={`tree-level-${currentLevel}`} // Re-render animation on level change
                >
                    <img
                        src={treeImagePath}
                        alt={`Level ${currentLevel} Tree`}
                        className="w-full h-full object-contain drop-shadow-2xl transition-all duration-700"
                        // Handle image load error securely
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/icons/icon-192x192.png'; // fallback
                        }}
                    />
                </div>
            </div>

            {/* Frequency Board (Water Drops) */}
            <div className="w-full bg-black/40 backdrop-blur-md rounded-[2rem] p-5 border border-white/10 shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-amber-100 font-bold text-base flex items-center gap-2">
                        <Droplets className="h-5 w-5 text-blue-400" />
                        미션을 완료해주세요!
                    </h4>
                    <span className="text-xs font-semibold text-blue-200 bg-blue-900/50 px-2 py-1 rounded-lg border border-blue-800">
                        {completedTopics}/{totalTopics}
                    </span>
                </div>

                {/* Slots Grid */}
                <div className="flex flex-wrap gap-2 justify-center sm:gap-3">
                    {Array.from({ length: totalTopics }).map((_, index) => {
                        const isFilled = index < completedTopics;
                        const isLastSlot = index === totalTopics - 1;
                        // Dynamically scale slots based on total count to fit container
                        const slotSize = totalTopics > 15 ? 'w-8 h-8 sm:w-10 sm:h-10' : totalTopics > 8 ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12 sm:w-14 sm:h-14';

                        // Last slot visually distinct (Goal/Sun)
                        if (isLastSlot) {
                            return (
                                <div
                                    key={index}
                                    className={`${slotSize} rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-300 ${isFilled
                                            ? 'bg-yellow-900/40 border-2 border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.3)]'
                                            : 'bg-white/5 border border-dashed border-amber-500/40'
                                        }`}
                                >
                                    {isFilled ? (
                                        <Sun className={`h-1/2 w-1/2 text-yellow-500 z-10 ${isFilled && index + 1 === completedTopics ? 'animate-pulse' : ''}`} />
                                    ) : (
                                        <Target className="h-1/2 w-1/2 text-amber-500/40" />
                                    )}
                                </div>
                            );
                        }

                        // Normal slots (Water drops)
                        return (
                            <div
                                key={index}
                                className={`${slotSize} rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-300 ${isFilled
                                        ? 'bg-blue-900/40 border-2 border-blue-400/80 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                        : 'bg-white/5 border border-dashed border-gray-600'
                                    }`}
                            >
                                {isFilled ? (
                                    <>
                                        <div className="absolute inset-0 bg-blue-400/10"></div>
                                        <Droplets className="h-1/2 w-1/2 text-blue-400 z-10" />
                                    </>
                                ) : (
                                    <span className="material-symbols-outlined text-gray-600 text-[16px]">add</span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {!isAllCompleted && (
                    <p className="text-center text-xs text-gray-400 mt-1 font-medium">
                        남은 미션을 수행하고 창조트리를 키워보세요!
                    </p>
                )}
            </div>
        </div>
    );
}
