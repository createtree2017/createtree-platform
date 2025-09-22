import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  Music2,
  Heart,
  Share2,
  Repeat,
  Shuffle,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime } from "@/lib/utils";

interface ModernMusicPlayerProps {
  music: {
    id: number;
    title: string | null;
    url: string;
    prompt?: string | null;
    lyrics?: string | null;
    tags?: string[];
    duration?: number;
  };
  onAddToFavorites?: (id: number) => void;
  onShare?: (id: number) => void;
  autoPlay?: boolean;
  className?: string;
}

export default function ModernMusicPlayer({
  music,
  onAddToFavorites,
  onShare,
  autoPlay = false,
  className = "",
}: ModernMusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset when music changes
  useEffect(() => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentTime(0);
    setIsPlaying(false);
    setIsLoading(true);
    setAudioSrc(`/api/music/stream/${music.id}`);
    
    // Create new abort controller for this music
    abortControllerRef.current = new AbortController();
    
    if (audioRef.current && autoPlay) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(err => {
            if (err.name !== 'AbortError') {
              console.error("자동 재생 실패:", err);
            }
            setIsPlaying(false);
            setIsLoading(false);
          });
      }
    } else {
      setIsLoading(false);
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [music.id, autoPlay]);

  // Register audio event handlers with error handling
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      try {
        if (audio && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setDuration(audio.duration);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn("메타데이터 로드 중 오류:", error);
        setIsLoading(false);
      }
    };
    
    const handleCanPlay = () => {
      setIsLoading(false);
      console.log("오디오 재생 준비 완료");
    };
    
    const handleLoadStart = () => {
      setIsLoading(true);
      console.log("오디오 로딩 시작");
    };
    
    const handleTimeUpdate = () => {
      try {
        if (audio && !isNaN(audio.currentTime) && isFinite(audio.currentTime)) {
          setCurrentTime(audio.currentTime);
        }
      } catch (error) {
        console.warn("시간 업데이트 중 오류:", error);
      }
    };
    
    const handleEnded = () => {
      try {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audio) {
          audio.currentTime = 0;
        }
      } catch (error) {
        console.warn("재생 종료 처리 중 오류:", error);
      }
    };
    
    const handleError = (event: Event) => {
      const target = event.target as HTMLAudioElement;
      const error = target?.error;
      
      // Skip AbortError and other expected errors
      if (error && error.code === MediaError.MEDIA_ERR_ABORTED) {
        console.log("음악 로딩이 중단됨 (정상)");
        return;
      }
      
      console.error("오디오 재생 오류:", {
        error: error,
        code: error?.code,
        message: error?.message,
        musicId: music.id,
        audioSrc: audioSrc
      });
      setIsPlaying(false);
      setIsLoading(false);
    };
    
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadstart", handleLoadStart);
    
    return () => {
      if (audio) {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("error", handleError);
        audio.removeEventListener("canplay", handleCanPlay);
        audio.removeEventListener("loadstart", handleLoadStart);
      }
    };
  }, []);

  // Apply volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Toggle play/pause with improved error handling
  const togglePlay = async () => {
    if (!audioRef.current) {
      console.error("오디오 엘리먼트가 없습니다");
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (isLoading) {
      console.log("이미 로딩 중입니다");
      return;
    }
    
    console.log(`재생 시도: 음악 ID ${music.id}, URL: ${audioSrc}`);
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        console.log("재생 일시정지");
      } else {
        setIsLoading(true);
        console.log("재생 시작 시도...");
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsLoading(false);
          console.log("재생 성공");
        }
      }
    } catch (error: any) {
      setIsLoading(false);
      
      // Ignore AbortError as it's expected when switching tracks
      if (error.name === 'AbortError') {
        console.log("재생 요청이 중단됨 (정상)");
        return;
      }
      
      console.error("재생 오류:", error);
      console.error("오류 세부사항:", {
        musicId: music.id,
        audioSrc: audioSrc,
        readyState: audioRef.current?.readyState,
        networkState: audioRef.current?.networkState,
        error: audioRef.current?.error
      });
      setIsPlaying(false);
    }
  };

  // Restart track
  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Handle seek
  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;
    
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Handle download
  const handleDownload = async () => {
    try {
      // 음악 다운로드 API 사용
      const downloadUrl = `/api/music/${music.id}/download`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${music.title || '음악'}.mp3`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('음악 다운로드 오류:', error);
    }
  };
  
  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate album artwork based on music style or title
  const getAlbumArtwork = () => {
    const colors = [
      'from-purple-400 to-pink-400',
      'from-blue-400 to-indigo-400', 
      'from-green-400 to-teal-400',
      'from-orange-400 to-red-400',
      'from-yellow-400 to-orange-400',
      'from-indigo-400 to-purple-400'
    ];
    const colorIndex = Math.abs(music.title?.charCodeAt(0) || 0) % colors.length;
    return colors[colorIndex];
  };

  return (
    <Card className={`w-full overflow-hidden ${className} ${isExpanded ? 'max-w-2xl mx-auto' : ''}`}>
      {/* Modern Header with Album Art */}
      <div className="relative">
        <div className={`bg-gradient-to-br ${getAlbumArtwork()} ${isExpanded ? 'h-64' : 'h-32'} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-4 right-4 flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isExpanded ? '축소하기' : '확대하기'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Album Art Circle */}
          <div className={`absolute ${isExpanded ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'bottom-4 left-4'}`}>
            <div className={`${isExpanded ? 'w-32 h-32' : 'w-16 h-16'} rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
              <Music2 className={`${isExpanded ? 'h-12 w-12' : 'h-6 w-6'} text-white`} />
            </div>
          </div>
          
          {/* Title Overlay */}
          {isExpanded && (
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h2 className="text-2xl font-bold mb-1">{music.title || "음악 제목 없음"}</h2>
              {music.prompt && (
                <p className="text-sm opacity-90 line-clamp-2">{music.prompt}</p>
              )}
            </div>
          )}
        </div>
        
        {/* Compact Title */}
        {!isExpanded && (
          <div className="absolute bottom-4 left-24 right-4 text-white">
            <h3 className="font-semibold">{music.title || "음악 제목 없음"}</h3>
            {music.prompt && (
              <p className="text-xs opacity-90 line-clamp-1">{music.prompt}</p>
            )}
          </div>
        )}
      </div>

      <CardContent className="p-6">
        <audio 
          ref={audioRef} 
          src={audioSrc} 
          preload="metadata"
          crossOrigin="anonymous"
          onError={(e) => {
            const target = e.target as HTMLAudioElement;
            const error = target?.error;
            console.error('🎵 오디오 재생 오류:', {
              musicId: music.id,
              audioSrc: audioSrc,
              errorCode: error?.code,
              errorMessage: error?.message,
              readyState: target?.readyState,
              networkState: target?.networkState
            });
            
            // 자동 복구 시도
            if (error?.code === MediaError.MEDIA_ERR_NETWORK) {
              console.log('🔄 네트워크 오류 감지, 재시도...');
              setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.load();
                }
              }, 1000);
            }
          }}
          onLoadStart={() => console.log('🎵 오디오 로딩 시작:', audioSrc)}
          onCanPlay={() => console.log('🎵 오디오 재생 준비 완료')}
          onLoadedData={() => console.log('🎵 오디오 데이터 로드 완료')}
          onProgress={() => console.log('🎵 오디오 버퍼링 진행 중')}
        />
        
        {/* Progress Bar */}
        <div className="mb-6">
          <div 
            ref={progressRef}
            className="h-2 bg-secondary rounded-full overflow-hidden cursor-pointer mb-2" 
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration || (music.duration || 0))}</span>
          </div>
        </div>
        
        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={isShuffled ? 'text-primary' : ''}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>셔플 {isShuffled ? '끄기' : '켜기'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button variant="ghost" size="icon" onClick={restart}>
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-full"
            onClick={togglePlay}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button variant="ghost" size="icon">
            <SkipForward className="h-5 w-5" />
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setRepeatMode(repeatMode === 'none' ? 'one' : repeatMode === 'one' ? 'all' : 'none')}
                  className={repeatMode !== 'none' ? 'text-primary' : ''}
                >
                  <Repeat className="h-4 w-4" />
                  {repeatMode === 'one' && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full text-[8px] flex items-center justify-center text-white">1</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>반복: {repeatMode === 'none' ? '없음' : repeatMode === 'one' ? '한 곡' : '전체'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Volume Control */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={toggleMute}>
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={([value]) => setVolume(value / 100)}
            max={100}
            step={1}
            className="flex-1"
          />
          
          <span className="text-xs text-muted-foreground w-8 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}
          </span>
        </div>

        {/* Tags */}
        {music.tags && music.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {music.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Lyrics Toggle */}
        {music.lyrics && (
          <Collapsible open={isLyricsVisible} onOpenChange={setIsLyricsVisible}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full mb-4">
                <FileText className="h-4 w-4 mr-2" />
                가사 {isLyricsVisible ? '숨기기' : '보기'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-48 w-full rounded-md border p-4">
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {music.lyrics}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
      
      {/* Action Footer */}
      <CardFooter className="pt-4 border-t flex justify-between">
        <div className="flex items-center gap-2">
          {onAddToFavorites && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onAddToFavorites(music.id)}
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>즐겨찾기 추가</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {onShare && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onShare(music.id)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>공유하기</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <Button 
          variant="outline"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          다운로드
        </Button>
      </CardFooter>
    </Card>
  );
}