/**
 * 음악 생성 성능 실시간 모니터링 스크립트
 * 2025-07-04 음악 생성 과정 전체 분석
 */

interface MusicGenerationStep {
  step: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details: any;
}

interface MusicGenerationSession {
  musicId: number;
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  steps: MusicGenerationStep[];
  apiCalls: {
    endpoint: string;
    timestamp: number;
    duration: number;
    status: number;
  }[];
  bottlenecks: {
    step: string;
    duration: number;
    percentage: number;
  }[];
}

class MusicGenerationMonitor {
  private sessions: Map<number, MusicGenerationSession> = new Map();
  private currentSession: MusicGenerationSession | null = null;

  /**
   * 새로운 음악 생성 세션 시작
   */
  startSession(musicId: number): void {
    const sessionId = `session_${Date.now()}_${musicId}`;
    const session: MusicGenerationSession = {
      musicId,
      sessionId,
      startTime: Date.now(),
      steps: [],
      apiCalls: [],
      bottlenecks: []
    };

    this.sessions.set(musicId, session);
    this.currentSession = session;

    console.log(`🚀 [Monitor] 음악 생성 세션 시작: ${sessionId}`);
    this.addStep('session_start', '음악 생성 세션 초기화', { musicId });
  }

  /**
   * 단계 추가
   */
  addStep(stepKey: string, description: string, details: any = {}): void {
    if (!this.currentSession) return;

    const step: MusicGenerationStep = {
      step: `${stepKey}: ${description}`,
      startTime: Date.now(),
      status: 'running',
      details
    };

    this.currentSession.steps.push(step);
    console.log(`📊 [Monitor] 단계 시작: ${description}`);
  }

  /**
   * 단계 완료
   */
  completeStep(stepKey: string, status: 'completed' | 'failed' = 'completed', additionalDetails: any = {}): void {
    if (!this.currentSession) return;

    const step = this.currentSession.steps.find(s => s.step.startsWith(stepKey));
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = status;
      step.details = { ...step.details, ...additionalDetails };

      console.log(`✅ [Monitor] 단계 완료: ${step.step} (${step.duration}ms)`);
    }
  }

  /**
   * API 호출 기록
   */
  recordApiCall(endpoint: string, duration: number, status: number): void {
    if (!this.currentSession) return;

    this.currentSession.apiCalls.push({
      endpoint,
      timestamp: Date.now(),
      duration,
      status
    });

    console.log(`🌐 [Monitor] API 호출: ${endpoint} (${duration}ms, status: ${status})`);
  }

  /**
   * 세션 종료 및 분석
   */
  endSession(musicId: number, status: 'completed' | 'failed' = 'completed'): MusicGenerationSession | null {
    const session = this.sessions.get(musicId);
    if (!session) return null;

    session.endTime = Date.now();
    session.totalDuration = session.endTime - session.startTime;

    // 병목 구간 분석
    this.analyzeBottlenecks(session);

    console.log(`🏁 [Monitor] 세션 종료: ${session.sessionId}`);
    this.printDetailedReport(session);

    return session;
  }

  /**
   * 병목 구간 분석
   */
  private analyzeBottlenecks(session: MusicGenerationSession): void {
    const completedSteps = session.steps.filter(s => s.duration !== undefined);
    const totalDuration = session.totalDuration || 1;

    session.bottlenecks = completedSteps
      .map(step => ({
        step: step.step,
        duration: step.duration!,
        percentage: Math.round((step.duration! / totalDuration) * 100)
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5); // 상위 5개 병목
  }

  /**
   * 상세 리포트 출력
   */
  private printDetailedReport(session: MusicGenerationSession): void {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 음악 생성 성능 분석 리포트 - Music ID: ${session.musicId}`);
    console.log('='.repeat(80));
    
    console.log(`⏱️  총 소요 시간: ${session.totalDuration}ms (${Math.round(session.totalDuration! / 1000)}초)`);
    console.log(`📅 세션 ID: ${session.sessionId}`);
    console.log(`🕐 시작 시간: ${new Date(session.startTime).toLocaleTimeString()}`);
    console.log(`🕐 종료 시간: ${new Date(session.endTime!).toLocaleTimeString()}`);

    console.log('\n🔍 단계별 상세 분석:');
    session.steps.forEach((step, index) => {
      const duration = step.duration || 0;
      const percentage = session.totalDuration ? Math.round((duration / session.totalDuration) * 100) : 0;
      console.log(`  ${index + 1}. ${step.step}`);
      console.log(`     ⏱️  소요시간: ${duration}ms (${percentage}%)`);
      console.log(`     📊 상태: ${step.status}`);
      if (Object.keys(step.details).length > 0) {
        console.log(`     📝 세부사항: ${JSON.stringify(step.details, null, 6)}`);
      }
    });

    console.log('\n🚫 주요 병목 구간 (상위 5개):');
    session.bottlenecks.forEach((bottleneck, index) => {
      console.log(`  ${index + 1}. ${bottleneck.step}`);
      console.log(`     ⏱️  ${bottleneck.duration}ms (${bottleneck.percentage}%)`);
    });

    console.log('\n🌐 API 호출 통계:');
    const apiStats = this.getApiStatistics(session);
    Object.entries(apiStats).forEach(([endpoint, stats]) => {
      console.log(`  📡 ${endpoint}`);
      console.log(`     📞 호출 횟수: ${stats.count}회`);
      console.log(`     ⏱️  평균 응답시간: ${Math.round(stats.avgDuration)}ms`);
      console.log(`     ⏱️  총 시간: ${stats.totalDuration}ms`);
    });

    console.log('\n💡 성능 개선 제안:');
    this.generatePerformanceRecommendations(session);

    console.log('='.repeat(80) + '\n');
  }

  /**
   * API 통계 계산
   */
  private getApiStatistics(session: MusicGenerationSession): Record<string, {count: number; avgDuration: number; totalDuration: number}> {
    const stats: Record<string, {count: number; totalDuration: number; avgDuration: number}> = {};

    session.apiCalls.forEach(call => {
      if (!stats[call.endpoint]) {
        stats[call.endpoint] = { count: 0, totalDuration: 0, avgDuration: 0 };
      }
      stats[call.endpoint].count++;
      stats[call.endpoint].totalDuration += call.duration;
    });

    Object.keys(stats).forEach(endpoint => {
      stats[endpoint].avgDuration = stats[endpoint].totalDuration / stats[endpoint].count;
    });

    return stats;
  }

  /**
   * 성능 개선 제안 생성
   */
  private generatePerformanceRecommendations(session: MusicGenerationSession): void {
    const totalDuration = session.totalDuration!;
    
    if (totalDuration > 120000) { // 2분 이상
      console.log('  ⚠️  총 소요시간이 2분을 초과했습니다. 최적화가 필요합니다.');
    }

    // 가장 큰 병목 구간 분석
    const topBottleneck = session.bottlenecks[0];
    if (topBottleneck && topBottleneck.percentage > 40) {
      console.log(`  🎯 주요 병목: "${topBottleneck.step}" (${topBottleneck.percentage}%)`);
      
      if (topBottleneck.step.includes('polling') || topBottleneck.step.includes('폴링')) {
        console.log('  💡 폴링 간격을 조정하여 성능을 개선할 수 있습니다.');
      }
      
      if (topBottleneck.step.includes('GCS') || topBottleneck.step.includes('저장')) {
        console.log('  💡 GCS 저장을 백그라운드로 처리하여 응답 속도를 개선할 수 있습니다.');
      }
      
      if (topBottleneck.step.includes('API') || topBottleneck.step.includes('요청')) {
        console.log('  💡 API 요청 최적화나 캐싱을 통해 성능을 개선할 수 있습니다.');
      }
    }

    // API 호출 최적화 제안
    const apiCalls = session.apiCalls;
    const listApiCalls = apiCalls.filter(call => call.endpoint.includes('/api/music-engine/list'));
    if (listApiCalls.length > 10) {
      console.log(`  📡 음악 목록 API가 ${listApiCalls.length}회 호출되었습니다. 폴링 간격을 늘려보세요.`);
    }
  }

  /**
   * 현재 세션 상태 출력
   */
  printCurrentStatus(): void {
    if (!this.currentSession) {
      console.log('❌ 활성 세션이 없습니다.');
      return;
    }

    const elapsed = Date.now() - this.currentSession.startTime;
    const runningSteps = this.currentSession.steps.filter(s => s.status === 'running');
    
    console.log(`🔄 [Monitor] 현재 세션: ${this.currentSession.sessionId}`);
    console.log(`⏱️  경과 시간: ${elapsed}ms (${Math.round(elapsed / 1000)}초)`);
    console.log(`📊 진행 중인 단계: ${runningSteps.length}개`);
    
    if (runningSteps.length > 0) {
      console.log('🔄 현재 실행 중:');
      runningSteps.forEach(step => {
        const stepElapsed = Date.now() - step.startTime;
        console.log(`  - ${step.step} (${stepElapsed}ms 경과)`);
      });
    }
  }
}

// 전역 모니터 인스턴스
export const musicMonitor = new MusicGenerationMonitor();

// 사용 예시
if (require.main === module) {
  console.log('🎵 음악 생성 성능 모니터링 시스템 초기화됨');
  
  // 테스트 세션
  musicMonitor.startSession(999);
  musicMonitor.addStep('api_request', 'TopMediai API 요청', { prompt: 'test' });
  setTimeout(() => {
    musicMonitor.completeStep('api_request', 'completed', { responseTime: 1500 });
    musicMonitor.endSession(999, 'completed');
  }, 2000);
}