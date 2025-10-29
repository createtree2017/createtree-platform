import React, { useState, useCallback, useEffect } from 'react';
import { SNAPSHOT_PROMPTS } from './constants';
import { generateSnapshotImage, generateNewPrompts, generateMorePrompts, generateStudioVideo } from './services/geminiService';
import type { GeneratedImage, UploadedImage, Prompt, SnapCategory } from './types';
import { ImageStatus } from './types';
import { UploadCloudIcon, GalleryIcon, RetryIcon, PlusCircleIcon } from './components/Icons';
import ImageCard from './components/ImageCard';
import Modal from './components/Modal';
import { translations, Language } from './translations';

type GenerationMode = 'individual' | 'couple';
type StyleOption = 'mix' | 'daily' | 'travel' | 'film';
type Gender = 'female' | 'male';

const ImageUploader: React.FC<{
    id: string;
    image: UploadedImage | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    title: string;
    aspect: string;
    t: (key: string) => string;
}> = ({ id, image, onChange, title, aspect, t }) => (
    <label htmlFor={id} className={`w-full ${aspect} border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-gray-800/50 transition-colors`}>
        {image ? (
            <img src={image.objectUrl} alt={`${title} preview`} className="max-h-full max-w-full object-contain rounded-md" />
        ) : (
            <>
                <UploadCloudIcon className="w-8 h-8 text-gray-500 mb-2"/>
                <span className="text-gray-400 font-medium text-sm">{title}</span>
                <span className="text-xs text-gray-500 mt-1">{t('uploadClick')}</span>
            </>
        )}
        <input id={id} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={onChange} />
    </label>
);


const ControlPanel: React.FC<{
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'individual' | 'woman' | 'man') => void;
    onGenerate: () => void;
    onRetryFailed: () => void;
    individualImage: UploadedImage | null;
    womanImage: UploadedImage | null;
    manImage: UploadedImage | null;
    isGenerating: boolean;
    hasFailedImages: boolean;
    generationMode: GenerationMode;
    onGenerationModeChange: (mode: GenerationMode) => void;
    styleOption: StyleOption;
    onStyleOptionChange: (option: StyleOption) => void;
    gender: Gender;
    onGenderChange: (gender: Gender) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}> = ({ 
    onFileChange, onGenerate, onRetryFailed, 
    individualImage, womanImage, manImage,
    isGenerating, hasFailedImages, 
    generationMode, onGenerationModeChange,
    styleOption, onStyleOptionChange, gender, onGenderChange,
    language, setLanguage, t
}) => {
    
    const isGenerateButtonDisabled = () => {
        if (isGenerating) return true;
        if (generationMode === 'individual') {
            return !individualImage;
        }
        if (generationMode === 'couple') {
            return !womanImage || !manImage;
        }
        return true;
    };
    
    return (
    <section className="w-full lg:w-[400px] lg:h-screen lg:flex-shrink-0 bg-[#1a1a1a] p-6 flex flex-col text-gray-300 lg:border-r border-b lg:border-b-0 border-gray-700/50">
        <div className="mb-8 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold text-white">{t('appTitle')}</h1>
                <p className="text-sm text-gray-400 mt-1">{t('appDescription')}</p>
            </div>
             <div className="relative flex-shrink-0 ml-2">
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 appearance-none"
                    aria-label={t('languageSelectorLabel')}
                >
                    <option value="ko">🇰🇷 한국어</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="ja">🇯🇵 日本語</option>
                </select>
            </div>
        </div>
        
        <div className="lg:flex-grow lg:overflow-y-auto lg:pr-2 space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-indigo-600 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center mr-2">1</span>
                    {t('step1')}
                </h2>
                <div className="flex space-x-2 rounded-lg bg-gray-800 p-1">
                    <button onClick={() => onGenerationModeChange('individual')} className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${generationMode === 'individual' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('individualMode')}</button>
                    <button onClick={() => onGenerationModeChange('couple')} className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${generationMode === 'couple' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('coupleMode')}</button>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-indigo-600 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center mr-2">2</span>
                    {t('step2')}
                </h2>
                {generationMode === 'individual' ? (
                     <>
                        <ImageUploader id="individual-upload" image={individualImage} onChange={(e) => onFileChange(e, 'individual')} title={t('uploadTitleIndividual')} aspect="aspect-video" t={t} />
                        <p className="text-xs text-gray-500 mt-2 text-center">{t('uploadTipIndividual')}</p>
                     </>
                ) : (
                    <>
                        <div className="flex space-x-4">
                           <ImageUploader id="woman-upload" image={womanImage} onChange={(e) => onFileChange(e, 'woman')} title={t('uploadTitleWoman')} aspect="aspect-[3/4]" t={t} />
                           <ImageUploader id="man-upload" image={manImage} onChange={(e) => onFileChange(e, 'man')} title={t('uploadTitleMan')} aspect="aspect-[3/4]" t={t} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">{t('uploadTipCouple')}</p>
                    </>
                )}
            </div>

            <div>
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-indigo-600 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center mr-2">3</span>
                    {t('step3')}
                </h2>
                <div className="space-y-4">
                    {generationMode === 'individual' && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">{t('gender')}</h3>
                            <div className="flex space-x-2 rounded-lg bg-gray-800 p-1">
                                <button onClick={() => onGenderChange('female')} className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${gender === 'female' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('female')}</button>
                                <button onClick={() => onGenderChange('male')} className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${gender === 'male' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('male')}</button>
                            </div>
                        </div>
                    )}
                     <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('styleConcept')}</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-800 p-1">
                            <button onClick={() => onStyleOptionChange('mix')} className={`w-full rounded-md py-2 text-xs font-medium transition-colors ${styleOption === 'mix' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('styleMix')}</button>
                            <button onClick={() => onStyleOptionChange('daily')} className={`w-full rounded-md py-2 text-xs font-medium transition-colors ${styleOption === 'daily' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('styleDaily')}</button>
                            <button onClick={() => onStyleOptionChange('travel')} className={`w-full rounded-md py-2 text-xs font-medium transition-colors ${styleOption === 'travel' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('styleTravel')}</button>
                             <button onClick={() => onStyleOptionChange('film')} className={`w-full rounded-md py-2 text-xs font-medium transition-colors ${styleOption === 'film' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('styleFilm')}</button>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                 <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-indigo-600 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center mr-2">4</span>
                    {t('step4')}
                </h2>
                <p className="text-sm text-gray-400 mb-4">{t('generateDescription')}</p>
                <button 
                    onClick={onGenerate} 
                    disabled={isGenerateButtonDisabled()}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                >
                    {isGenerating ? t('generating') : t('generateStart')}
                </button>
                 <p className="text-xs text-gray-500 mt-2 text-center">{t('generateLimit')}</p>
                 <p className="text-xs text-gray-500 mt-2 text-center">
                    <a href="https://www.threads.com/@choi.openai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">@choi.openai</a> {t('followMessage')}
                 </p>
                {hasFailedImages && !isGenerating && (
                    <button
                        onClick={onRetryFailed}
                        className="w-full mt-4 bg-yellow-600 text-white font-bold py-3 px-4 rounded-md hover:bg-yellow-500 transition-all flex items-center justify-center space-x-2"
                    >
                        <RetryIcon />
                        <span>{t('retryFailed')}</span>
                    </button>
                )}
            </div>
             {isGenerating && (
                <div className="text-center text-sm text-yellow-400 p-3 bg-yellow-900/50 rounded-lg">
                    <p>{t('generatingWaitMessage')}</p>
                </div>
            )}
        </div>
    </section>
)};


const App: React.FC = () => {
    const [individualImage, setIndividualImage] = useState<UploadedImage | null>(null);
    const [womanImage, setWomanImage] = useState<UploadedImage | null>(null);
    const [manImage, setManImage] = useState<UploadedImage | null>(null);

    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
    const [selectedImageForModal, setSelectedImageForModal] = useState<GeneratedImage | null>(null);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const [generationMode, setGenerationMode] = useState<GenerationMode>('individual');
    const [styleOption, setStyleOption] = useState<StyleOption>('mix');
    const [gender, setGender] = useState<Gender>('female');
    
    const [language, setLanguage] = useState<Language>('ko');

    useEffect(() => {
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'ja') setLanguage('ja');
        else if (browserLang === 'en') setLanguage('en');
        else setLanguage('ko');
    }, []);

    const t = useCallback((key: string, params?: Record<string, any>): string => {
        let text = translations[language][key] || translations['en'][key] || key;
        if (params) {
          Object.keys(params).forEach(pKey => {
            text = text.replace(`{{${pKey}}}`, String(params[pKey]));
          });
        }
        return text;
    }, [language]);
    
    useEffect(() => {
        document.documentElement.lang = language;
        document.title = t('appTitle');
    }, [language, t]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'individual' | 'woman' | 'man') => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const [header, base64Data] = result.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
                
                const newImage = {
                    base64: base64Data,
                    mimeType: mimeType,
                    objectUrl: URL.createObjectURL(file),
                };

                if (type === 'individual') {
                    if (individualImage?.objectUrl) URL.revokeObjectURL(individualImage.objectUrl);
                    setIndividualImage(newImage);
                } else if (type === 'woman') {
                    if (womanImage?.objectUrl) URL.revokeObjectURL(womanImage.objectUrl);
                    setWomanImage(newImage);
                } else {
                    if (manImage?.objectUrl) URL.revokeObjectURL(manImage.objectUrl);
                    setManImage(newImage);
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const generateSingleImage = useCallback(async (baseImgs: UploadedImage[], imageToGenerate: GeneratedImage) => {
        setGeneratedImages((prev) => prev.map((img) =>
            img.id === imageToGenerate.id ? { ...img, status: ImageStatus.GENERATING } : img
        ));

        try {
            const newImageBase64 = await generateSnapshotImage(baseImgs, imageToGenerate.prompt);
            const imageUrl = `data:image/png;base64,${newImageBase64}`;
            setGeneratedImages((prev) => prev.map((img) =>
                img.id === imageToGenerate.id ? { ...img, src: imageUrl, status: ImageStatus.SUCCESS } : img
            ));
        } catch (error) {
            console.error(`Failed to generate image for prompt: ${imageToGenerate.prompt}`, error);
            setGeneratedImages((prev) => prev.map((img) =>
                img.id === imageToGenerate.id ? { ...img, status: ImageStatus.ERROR } : img
            ));
        }
    }, []);

    const shuffleArray = <T,>(array: T[]): T[] => {
        return [...array].sort(() => Math.random() - 0.5);
    };

    const anyGenerationInProgress = isGenerating || isGeneratingMore;

    const handleGenerateClick = useCallback(async () => {
        let sourceImages: UploadedImage[] = [];
        if (generationMode === 'individual' && individualImage) {
            sourceImages = [individualImage];
        } else if (generationMode === 'couple' && womanImage && manImage) {
            sourceImages = [womanImage, manImage];
        }

        if (sourceImages.length === 0 || anyGenerationInProgress) return;

        setIsGenerating(true);
        
        const filteredPrompts = SNAPSHOT_PROMPTS.filter(p => {
            if (generationMode === 'couple') return p.type === 'couple';
            return p.type === 'individual' && (p.gender === gender || p.gender === 'unisex');
        });

        const getPromptsForCategory = (cat: SnapCategory) => filteredPrompts.filter(p => p.category === cat);

        let selectedPrompts: Prompt[] = [];
        if (styleOption === 'mix') {
            selectedPrompts = [
                ...shuffleArray(getPromptsForCategory('daily')).slice(0, 4),
                ...shuffleArray(getPromptsForCategory('travel')).slice(0, 3),
                ...shuffleArray(getPromptsForCategory('film')).slice(0, 3),
            ];
        } else {
            selectedPrompts = shuffleArray(getPromptsForCategory(styleOption)).slice(0, 10);
        }

        const initialImages = shuffleArray(selectedPrompts).map((prompt, i) => ({
            id: i,
            prompt: prompt.text,
            src: null,
            status: ImageStatus.PENDING,
            category: prompt.category,
        }));
        setGeneratedImages(initialImages);

        const generationPromises = initialImages.map(image => generateSingleImage(sourceImages, image));
        await Promise.all(generationPromises);
        setIsGenerating(false);
    }, [individualImage, womanImage, manImage, generationMode, styleOption, gender, anyGenerationInProgress, generateSingleImage]);

    const handleGetMoreClick = useCallback(async () => {
        let sourceImages: UploadedImage[] = [];
        if (generationMode === 'individual' && individualImage) {
            sourceImages = [individualImage];
        } else if (generationMode === 'couple' && womanImage && manImage) {
            sourceImages = [womanImage, manImage];
        }
        
        if (sourceImages.length === 0 || anyGenerationInProgress) return;

        setIsGenerating(true);

        const usedPrompts = new Set(generatedImages.map(img => img.prompt));
        
        const availableStaticPrompts = SNAPSHOT_PROMPTS.filter(p => {
            if (generationMode === 'couple') return p.type === 'couple' && !usedPrompts.has(p.text);
            return p.type === 'individual' && (p.gender === gender || p.gender === 'unisex') && !usedPrompts.has(p.text);
        });

        let promptsToConsider: Prompt[];
        if (styleOption === 'mix') {
            promptsToConsider = availableStaticPrompts;
        } else {
            promptsToConsider = availableStaticPrompts.filter(p => p.category === styleOption);
        }

        let additionalPrompts: Prompt[] = [];
        let fetchedFromAI = false;

        if (promptsToConsider.length > 0) {
            additionalPrompts = shuffleArray(promptsToConsider);
        } else {
            fetchedFromAI = true;
            try {
                const genderForPromptGen = generationMode === 'couple' ? 'unisex' : gender;
                const newPromptsData = await generateMorePrompts(
                    Array.from(usedPrompts),
                    styleOption,
                    generationMode,
                    genderForPromptGen
                );

                additionalPrompts = newPromptsData.map(p => ({
                    text: p.text,
                    category: p.category,
                    type: generationMode,
                    gender: genderForPromptGen,
                }));
            } catch(error) {
                console.error("Failed to generate new prompts for 'get more'", error);
                alert(t('alertNewPromptFail'));
                setIsGenerating(false);
                return;
            }
        }

        if (additionalPrompts.length === 0) {
            const message = fetchedFromAI 
                ? t('alertAINoNewIdeas')
                : t('alertNoMoreStyles');
            alert(message);
            setIsGenerating(false);
            return;
        }

        const newImages = shuffleArray(additionalPrompts).slice(0, 10).map((prompt, i) => ({
            id: generatedImages.length + i,
            prompt: prompt.text,
            src: null,
            status: ImageStatus.PENDING,
            category: prompt.category,
        }));
        
        if (newImages.length === 0) {
             const message = t('alertNoMoreStyles');
            alert(message);
            setIsGenerating(false);
            return;
        }

        setGeneratedImages(prev => [...prev, ...newImages]);

        const generationPromises = newImages.map(image => generateSingleImage(sourceImages, image));
        await Promise.all(generationPromises);
        setIsGenerating(false);
    }, [individualImage, womanImage, manImage, generationMode, generatedImages, anyGenerationInProgress, styleOption, gender, generateSingleImage, t]);

    const handleRetryFailedClick = useCallback(async () => {
        const failedImages = generatedImages.filter(img => img.status === ImageStatus.ERROR);
        
        let sourceImages: UploadedImage[] = [];
        if (generationMode === 'individual' && individualImage) {
            sourceImages = [individualImage];
        } else if (generationMode === 'couple' && womanImage && manImage) {
            sourceImages = [womanImage, manImage];
        }

        if (failedImages.length === 0 || sourceImages.length === 0 || anyGenerationInProgress) return;

        setIsGenerating(true);
        const retryPromises = failedImages.map(image => generateSingleImage(sourceImages, image));
        await Promise.all(retryPromises);
        setIsGenerating(false);
    }, [individualImage, womanImage, manImage, generationMode, generatedImages, anyGenerationInProgress, generateSingleImage]);

    const handleRetryOneImage = useCallback(async (imageId: number) => {
        const imageToRetry = generatedImages.find(img => img.id === imageId);
        
        let sourceImages: UploadedImage[] = [];
        if (generationMode === 'individual' && individualImage) {
            sourceImages = [individualImage];
        } else if (generationMode === 'couple' && womanImage && manImage) {
            sourceImages = [womanImage, manImage];
        }

        if (!imageToRetry || sourceImages.length === 0 || anyGenerationInProgress) return;
        
        await generateSingleImage(sourceImages, imageToRetry);
    }, [individualImage, womanImage, manImage, generationMode, generatedImages, anyGenerationInProgress, generateSingleImage]);
    
    const handleCreateMore = useCallback(async (sourceImage: GeneratedImage) => {
        if (!sourceImage.src || anyGenerationInProgress) return;

        setIsGeneratingMore(true);
        setSelectedImageForModal(null);

        const newImagePlaceholders = Array.from({ length: 5 }).map((_, i) => ({
            id: generatedImages.length + i,
            prompt: "새로운 스타일을 구상 중입니다...",
            src: null,
            status: ImageStatus.GENERATING,
            category: sourceImage.category,
        }));
        setGeneratedImages(prev => [...prev, ...newImagePlaceholders]);

        try {
            const newPrompts = await generateNewPrompts(sourceImage.prompt);

            const [header, base64Data] = sourceImage.src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            const sourceUploadedImage: UploadedImage = { base64: base64Data, mimeType, objectUrl: '' };

            const imagesToGenerate = newImagePlaceholders.map((placeholder, i) => ({
                ...placeholder,
                prompt: newPrompts[i] || sourceImage.prompt,
            }));

            setGeneratedImages(prev => prev.map(img => {
                const match = imagesToGenerate.find(g => g.id === img.id);
                return match ? match : img;
            }));

            // For "create more", we always use the single source image, even in couple mode.
            const generationPromises = imagesToGenerate.map(img => generateSingleImage([sourceUploadedImage], img));
            await Promise.all(generationPromises);

        } catch (error) {
            console.error("Failed to create more images:", error);
            alert(t('alertCreateMoreFail'));
            setGeneratedImages(prev => prev.map(img => 
                newImagePlaceholders.some(p => p.id === img.id) ? { ...img, status: ImageStatus.ERROR } : img
            ));
        } finally {
            setIsGeneratingMore(false);
        }

    }, [generatedImages, anyGenerationInProgress, generateSingleImage, t]);
    
    const handleCreateVideo = useCallback(async () => {
        if (!selectedImageForModal?.src || isGeneratingVideo || anyGenerationInProgress) return;

        setIsGeneratingVideo(true);
        setGeneratedVideoUrl(null);

        try {
            const [header, base64Data] = selectedImageForModal.src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            const sourceImage: UploadedImage = { base64: base64Data, mimeType, objectUrl: '' };
            const videoPrompt = "A short, subtle animation of this snapshot. The scene comes to life with very gentle movements, like hair softly blowing in the wind, a slow blink, or a slight, natural shift in expression. The camera must remain completely still, preserving the original framing and composition. The goal is to create a 'live photo' or cinemagraph effect, not a full video.";
            
            const videoUrl = await generateStudioVideo(sourceImage, videoPrompt);
            setGeneratedVideoUrl(videoUrl);

        } catch (error) {
            console.error("Failed to create video:", error);
            alert(t('alertVideoFail'));
        } finally {
            setIsGeneratingVideo(false);
        }
    }, [selectedImageForModal, isGeneratingVideo, anyGenerationInProgress, t]);


    const hasFailedImages = generatedImages.some(img => img.status === ImageStatus.ERROR);

    return (
        <div className="flex flex-col lg:flex-row min-h-screen w-full bg-[#121212] text-white font-sans">
            <ControlPanel 
                onFileChange={handleFileChange}
                onGenerate={handleGenerateClick}
                onRetryFailed={handleRetryFailedClick}
                individualImage={individualImage}
                womanImage={womanImage}
                manImage={manImage}
                isGenerating={anyGenerationInProgress}
                hasFailedImages={hasFailedImages}
                generationMode={generationMode}
                onGenerationModeChange={setGenerationMode}
                styleOption={styleOption}
                onStyleOptionChange={setStyleOption}
                gender={gender}
                onGenderChange={setGender}
                language={language}
                setLanguage={setLanguage}
                t={t}
            />
            <main className="flex-1 bg-[#1e1e1e] p-4 md:p-8 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-200">{t('galleryTitle')}</h2>
                    {generatedImages.length > 0 && !anyGenerationInProgress && (
                        <button 
                            onClick={handleGetMoreClick}
                            className="flex items-center space-x-2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 transition-all text-sm"
                        >
                            <PlusCircleIcon />
                            <span>{t('generateMore')}</span>
                        </button>
                    )}
                </div>
                <div className="flex-1 lg:overflow-y-auto lg:pr-2">
                    {generatedImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {generatedImages.map((image) => (
                               <ImageCard key={image.id} image={image} onView={setSelectedImageForModal} onRetry={handleRetryOneImage} t={t} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 border-2 border-dashed border-gray-700 rounded-xl p-4 text-center">
                            <GalleryIcon className="w-16 h-16 text-gray-600"/>
                            <h3 className="mt-4 text-lg font-semibold text-gray-400">{t('galleryEmptyTitle')}</h3>
                            <p className="mt-1 text-sm">{t('galleryEmptyDescription')}</p>
                        </div>
                    )}
                </div>
            </main>
            <Modal 
                isOpen={!!selectedImageForModal} 
                onClose={() => {
                    setSelectedImageForModal(null)
                    if(generatedVideoUrl) {
                        URL.revokeObjectURL(generatedVideoUrl);
                    }
                    setGeneratedVideoUrl(null)
                }} 
                image={selectedImageForModal}
                onCreateMore={handleCreateMore}
                isGeneratingMore={isGeneratingMore}
                onCreateVideo={handleCreateVideo}
                isGeneratingVideo={isGeneratingVideo}
                generatedVideoUrl={generatedVideoUrl}
                t={t}
             />
        </div>
    );
};

export default App;