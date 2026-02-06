import React, { useRef, useState, useEffect } from "react";

/**
 * 공유 RichTextEditor 컴포넌트
 * - 굵게 (Bold)
 * - 색상 선택 (7개 프리셋 + 커스텀 색상)
 * - 글자 크기 조절 (작게/보통/크게/아주 크게)
 * - 한글 IME 입력 지원 (onCompositionStart/End)
 */

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const internalValueRef = useRef<string>('');
    const isInitializedRef = useRef(false);
    const isComposingRef = useRef(false);
    const [lastCustomColor, setLastCustomColor] = useState<string | null>(null);
    const colorInputRef = useRef<HTMLInputElement>(null);

    // value prop이 변경될 때마다 동기화
    useEffect(() => {
        if (editorRef.current) {
            const newValue = value || '';

            // 초기화 시 또는 외부에서 value가 변경된 경우 업데이트
            if (!isInitializedRef.current || newValue !== internalValueRef.current) {
                // 한글 조합 중이 아니고 포커스가 없을 때만 업데이트
                if (!isComposingRef.current && document.activeElement !== editorRef.current) {
                    editorRef.current.innerHTML = newValue;
                    internalValueRef.current = newValue;
                    isInitializedRef.current = true;
                }
            }
        }
    }, [value]);

    const applyFormat = (command: string, cmdValue?: string) => {
        // styleWithCSS를 활성화하여 span style로 색상/크기 적용
        if (command === 'foreColor' || command === 'fontSize') {
            document.execCommand('styleWithCSS', false, 'true');
        }
        document.execCommand(command, false, cmdValue);
        editorRef.current?.focus();
        syncContent();
    };

    const syncContent = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            internalValueRef.current = html;
            onChange(html);
        }
    };

    const handleCustomColorChange = (color: string) => {
        setLastCustomColor(color);
        applyFormat('foreColor', color);
    };

    const handleInput = () => {
        // 한글 조합 중에는 onChange를 호출하지 않음
        if (!isComposingRef.current) {
            syncContent();
        }
    };

    const handleCompositionStart = () => {
        isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
        isComposingRef.current = false;
        // 조합 완료 후 onChange 호출
        syncContent();
    };

    // 글자 크기 적용 - Selection API로 span 직접 적용
    const applyFontSize = (sizeRem: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            editorRef.current?.focus();
            return;
        }

        const range = selection.getRangeAt(0);
        if (range.collapsed) {
            // 선택 영역이 없으면 무시
            editorRef.current?.focus();
            return;
        }

        // 선택된 텍스트를 span으로 감싸기
        const span = document.createElement('span');
        span.style.fontSize = sizeRem;

        try {
            range.surroundContents(span);
        } catch (e) {
            // 복잡한 선택 영역의 경우 extractContents 사용
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }

        // 선택 해제
        selection.removeAllRanges();

        editorRef.current?.focus();
        syncContent();
    };

    const presetColors = [
        { color: '#ffffff', label: '흰색 (기본)' },
        { color: '#000000', label: '검정' },
        { color: '#ef4444', label: '빨강' },
        { color: '#3b82f6', label: '파랑' },
        { color: '#22c55e', label: '초록' },
        { color: '#f59e0b', label: '주황' },
        { color: '#8b5cf6', label: '보라' },
    ];

    const fontSizes = [
        { value: '0.8rem', label: '작게', icon: 'A', className: 'text-xs' },
        { value: '1rem', label: '보통', icon: 'A', className: 'text-sm' },
        { value: '1.25rem', label: '크게', icon: 'A', className: 'text-base' },
        { value: '1.5rem', label: '아주 크게', icon: 'A', className: 'text-lg' },
    ];

    return (
        <div className="border rounded-md">
            <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
                {/* 굵게 버튼 */}
                <button
                    type="button"
                    className="h-8 px-2 rounded hover:bg-accent"
                    onClick={() => applyFormat('bold')}
                    title="굵게"
                >
                    <span className="font-bold">B</span>
                </button>

                <div className="w-px h-6 bg-border mx-1" />

                {/* 글자 크기 */}
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">크기:</span>
                    {fontSizes.map((size) => (
                        <button
                            key={size.value}
                            type="button"
                            className={`h-7 w-7 rounded hover:bg-accent flex items-center justify-center ${size.className}`}
                            onClick={() => applyFontSize(size.value)}
                            title={size.label}
                        >
                            {size.icon}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                {/* 색상 선택 */}
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">색상:</span>
                    {presetColors.map(({ color, label }) => (
                        <button
                            key={color}
                            type="button"
                            className={`w-6 h-6 rounded border hover:scale-110 transition-transform ${color === '#ffffff' ? 'border-gray-400 bg-white' : 'border-gray-300'
                                }`}
                            style={{ backgroundColor: color }}
                            onClick={() => applyFormat('foreColor', color)}
                            title={label}
                        />
                    ))}
                    <div className="w-px h-5 bg-border mx-1" />
                    {lastCustomColor && (
                        <button
                            type="button"
                            className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                            style={{ backgroundColor: lastCustomColor }}
                            onClick={() => applyFormat('foreColor', lastCustomColor)}
                            title={`직전 선택 색상: ${lastCustomColor}`}
                        />
                    )}
                    <label className="relative cursor-pointer" title="직접 색상 선택">
                        <input
                            ref={colorInputRef}
                            type="color"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            value={lastCustomColor || '#000000'}
                            onChange={(e) => handleCustomColorChange(e.target.value)}
                        />
                        <div className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform flex items-center justify-center bg-gradient-to-br from-red-400 via-green-400 to-blue-400">
                            <span className="text-[10px] text-white font-bold drop-shadow">+</span>
                        </div>
                    </label>
                </div>
            </div>
            <div
                ref={editorRef}
                contentEditable
                className="min-h-[80px] p-3 text-sm focus:outline-none whitespace-pre-wrap [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
                onInput={handleInput}
                onBlur={handleInput}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                data-placeholder={placeholder}
            />
        </div>
    );
}

export default RichTextEditor;
