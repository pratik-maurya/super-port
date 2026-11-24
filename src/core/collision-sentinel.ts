import { PortCollisionMatch } from './types';

export class CollisionSentinel {
  private static readonly PATTERNS: { regex: RegExp; name: string }[] = [
    {
      regex: /listen\s+EADDRINUSE:\s+address\s+already\s+in\s+use\s+(?:::|0\.0\.0\.0|127\.0\.0\.1|localhost)?[:\s]+(\d+)/i,
      name: 'EADDRINUSE Node / Vite / Next.js'
    },
    {
      regex: /Error:\s+listen\s+EADDRINUSE[^\d]*:(\d+)/i,
      name: 'Generic EADDRINUSE'
    },
    {
      regex: /Port\s+(\d+)\s+is\s+already\s+in\s+use/i,
      name: 'Create React App / Webpack Port in use'
    },
    {
      regex: /Something\s+is\s+already\s+running\s+on\s+port\s+(\d+)/i,
      name: 'React / Next.js Collision'
    },
    {
      regex: /address\s+already\s+in\s+use\s*\(?[^)]*\)?[:\s]+(?:\[?::\]?|0\.0\.0\.0|127\.0\.0\.1|localhost)?[:\s]+(\d+)/i,
      name: 'Python / Flask / FastAPI Address in Use'
    },
    {
      regex: /bind:\s+address\s+already\s+in\s+use[^\d]*(\d+)/i,
      name: 'Go / Unix Bind Error'
    },
    {
      regex: /Port\s+(\d+)\s+was\s+already\s+in\s+use/i,
      name: 'Spring Boot Port in use'
    }
  ];

  /**
   * Inspects a string chunk (e.g. from terminal output or build log)
   * to detect port collision errors.
   */
  public static detectCollision(text: string): PortCollisionMatch | null {
    if (!text) return null;

    for (const pattern of this.PATTERNS) {
      const match = text.match(pattern.regex);
      if (match && match[1]) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && port > 0 && port <= 65535) {
          return {
            port,
            rawError: match[0],
            matchedPattern: pattern.name,
            timestamp: Date.now()
          };
        }
      }
    }

    return null;
  }
}
