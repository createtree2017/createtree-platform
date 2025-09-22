/**
 * TopMediai API Performance Monitoring Middleware
 * Implements alerting for 5xx errors and 8+ minute timeouts
 */

interface MonitoringEvent {
  type: 'timeout' | '5xx_error' | 'success';
  duration: number;
  songId?: string;
  errorCode?: number;
  timestamp: string;
  userId?: string;
}

class TopMediaiMonitor {
  private events: MonitoringEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  logEvent(event: MonitoringEvent) {
    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Alert on critical events
    if (event.type === 'timeout' || event.type === '5xx_error') {
      this.sendAlert(event);
    }
  }

  private sendAlert(event: MonitoringEvent) {
    console.error(`🚨 TopMediai Alert: ${event.type}`, {
      duration: event.duration,
      errorCode: event.errorCode,
      songId: event.songId,
      timestamp: event.timestamp
    });

    // TODO: Integrate with Slack webhook or monitoring service
    // fetch(process.env.SLACK_WEBHOOK_URL, {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     text: `TopMediai Alert: ${event.type} - Duration: ${event.duration}ms`
    //   })
    // });
  }

  getStats() {
    const recent = this.events.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    return {
      totalEvents: recent.length,
      timeouts: recent.filter(e => e.type === 'timeout').length,
      errors: recent.filter(e => e.type === '5xx_error').length,
      successes: recent.filter(e => e.type === 'success').length,
      avgDuration: recent.reduce((sum, e) => sum + e.duration, 0) / recent.length || 0
    };
  }
}

export const topMediaiMonitor = new TopMediaiMonitor();