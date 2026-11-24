import { DevFrameworkInfo } from './types';

interface FrameworkRule {
  id: string;
  name: string;
  icon: string;
  badgeColor: string;
  category: 'dev-server' | 'database' | 'docker' | 'api-runtime' | 'system' | 'other';
  description: string;
  defaultPortHint?: number;
  match: (params: { port: number; processName: string; commandLine: string; executablePath?: string; exePath?: string }) => boolean;
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  // Vite
  {
    id: 'vite',
    name: 'Vite Dev Server',
    icon: '⚡',
    badgeColor: '#646CFF',
    category: 'dev-server',
    description: 'Vite Next Generation Frontend Tooling',
    defaultPortHint: 5173,
    match: ({ commandLine, port }) =>
      /vite(\.js|\.mjs|\s|\/|\\|$)/i.test(commandLine) ||
      (port === 5173 || port === 5174 || port === 5175)
  },
  // Next.js
  {
    id: 'nextjs',
    name: 'Next.js Dev Server',
    icon: '▲',
    badgeColor: '#000000',
    category: 'dev-server',
    description: 'Next.js React Framework for the Web',
    defaultPortHint: 3000,
    match: ({ commandLine, port }) =>
      /next(\s+dev|\s+start|\-server|\/dist\/server)/i.test(commandLine) ||
      (/node/i.test(commandLine) && /next/i.test(commandLine)) ||
      (port === 3000 && /node/i.test(commandLine))
  },
  // Angular CLI
  {
    id: 'angular',
    name: 'Angular CLI',
    icon: '🅰️',
    badgeColor: '#DD0031',
    category: 'dev-server',
    description: 'Angular Development Server (ng serve)',
    defaultPortHint: 4200,
    match: ({ commandLine, port }) =>
      /@angular\/cli|ng\s+serve/i.test(commandLine) ||
      port === 4200
  },
  // React / Create React App / Webpack Dev Server
  {
    id: 'react',
    name: 'React / Webpack',
    icon: '⚛️',
    badgeColor: '#61DAFB',
    category: 'dev-server',
    description: 'React / Webpack Dev Server',
    defaultPortHint: 3000,
    match: ({ commandLine }) =>
      /react-scripts|webpack-dev-server/i.test(commandLine)
  },
  // Vue CLI / Nuxt
  {
    id: 'nuxt',
    name: 'Nuxt.js',
    icon: '💚',
    badgeColor: '#00DC82',
    category: 'dev-server',
    description: 'The Intuitive Vue Framework',
    defaultPortHint: 3000,
    match: ({ commandLine }) =>
      /nuxt(\s|\.js|\/)/i.test(commandLine)
  },
  {
    id: 'vue',
    name: 'Vue CLI',
    icon: '🟢',
    badgeColor: '#42B883',
    category: 'dev-server',
    description: 'Vue CLI Service',
    defaultPortHint: 8080,
    match: ({ commandLine, port }) =>
      /vue-cli-service/i.test(commandLine) ||
      (port === 8080 && /vue/i.test(commandLine))
  },
  // SvelteKit / Svelte
  {
    id: 'svelte',
    name: 'SvelteKit',
    icon: '🧡',
    badgeColor: '#FF3E00',
    category: 'dev-server',
    description: 'SvelteKit Web Development',
    defaultPortHint: 5173,
    match: ({ commandLine }) =>
      /@sveltejs\/kit|svelte-kit/i.test(commandLine)
  },
  // Astro
  {
    id: 'astro',
    name: 'Astro',
    icon: '🚀',
    badgeColor: '#BC52EE',
    category: 'dev-server',
    description: 'Astro Web Framework',
    defaultPortHint: 4321,
    match: ({ commandLine, port }) =>
      /astro\s+(dev|preview)/i.test(commandLine) ||
      port === 4321
  },
  // Remix
  {
    id: 'remix',
    name: 'Remix',
    icon: '💿',
    badgeColor: '#3992FF',
    category: 'dev-server',
    description: 'Remix Fullstack Framework',
    defaultPortHint: 3000,
    match: ({ commandLine }) =>
      /remix\s+dev/i.test(commandLine)
  },
  // Express / Fastify / NestJS Node API
  {
    id: 'nestjs',
    name: 'NestJS',
    icon: '🦁',
    badgeColor: '#E0234E',
    category: 'api-runtime',
    description: 'NestJS Enterprise Node.js Framework',
    defaultPortHint: 3000,
    match: ({ commandLine }) =>
      /nest\s+start|@nestjs/i.test(commandLine)
  },
  {
    id: 'express',
    name: 'Express / Node API',
    icon: '🌐',
    badgeColor: '#68A063',
    category: 'api-runtime',
    description: 'Express / Node HTTP Server',
    defaultPortHint: 5000,
    match: ({ commandLine, processName, port }) =>
      /node|nodemon|ts-node|tsx/i.test(processName) &&
      (port === 3000 || port === 3001 || port === 4000 || port === 5000 || port === 8000 || port === 8080)
  },
  // Bun
  {
    id: 'bun',
    name: 'Bun Runtime',
    icon: '🥟',
    badgeColor: '#FBF0DF',
    category: 'dev-server',
    description: 'Bun Fast JavaScript Runtime',
    match: ({ processName, commandLine }) =>
      /bun(\.exe)?$/i.test(processName) || /bun\s+run|bun\s+dev/i.test(commandLine)
  },
  // Deno
  {
    id: 'deno',
    name: 'Deno Runtime',
    icon: '🦕',
    badgeColor: '#70FFC2',
    category: 'dev-server',
    description: 'Deno Modern Runtime for JavaScript & TypeScript',
    match: ({ processName }) =>
      /deno(\.exe)?$/i.test(processName)
  },
  // Python: FastAPI, Flask, Django
  {
    id: 'fastapi',
    name: 'FastAPI / Uvicorn',
    icon: '⚡',
    badgeColor: '#05998B',
    category: 'api-runtime',
    description: 'FastAPI with Uvicorn ASGI Server',
    defaultPortHint: 8000,
    match: ({ commandLine, port }) =>
      /uvicorn|fastapi/i.test(commandLine) ||
      (port === 8000 && /python/i.test(commandLine))
  },
  {
    id: 'django',
    name: 'Django Dev Server',
    icon: '🎸',
    badgeColor: '#0C4B33',
    category: 'api-runtime',
    description: 'Django runserver',
    defaultPortHint: 8000,
    match: ({ commandLine }) =>
      /manage\.py\s+runserver/i.test(commandLine)
  },
  {
    id: 'flask',
    name: 'Flask',
    icon: '🌶️',
    badgeColor: '#000000',
    category: 'api-runtime',
    description: 'Flask Microframework',
    defaultPortHint: 5000,
    match: ({ commandLine }) =>
      /flask\s+run/i.test(commandLine)
  },
  {
    id: 'python-server',
    name: 'Python HTTP Server',
    icon: '🐍',
    badgeColor: '#3776AB',
    category: 'api-runtime',
    description: 'Python HTTP / Web Server',
    match: ({ processName, commandLine }) =>
      /python/i.test(processName) || /http\.server/i.test(commandLine)
  },
  // Docker / Containers
  {
    id: 'docker',
    name: 'Docker Container',
    icon: '🐳',
    badgeColor: '#2496ED',
    category: 'docker',
    description: 'Docker Desktop / Container Forwarded Port',
    match: ({ processName, commandLine }) =>
      /docker|com\.docker\.backend|vpnkit/i.test(processName) ||
      /docker/i.test(commandLine)
  },
  // Databases
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: '🐘',
    badgeColor: '#336791',
    category: 'database',
    description: 'PostgreSQL Relational Database',
    defaultPortHint: 5432,
    match: ({ port, processName }) =>
      port === 5432 || /postgres/i.test(processName)
  },
  {
    id: 'mysql',
    name: 'MySQL / MariaDB',
    icon: '🐬',
    badgeColor: '#00758F',
    category: 'database',
    description: 'MySQL / MariaDB Database Server',
    defaultPortHint: 3306,
    match: ({ port, processName }) =>
      port === 3306 || /mysqld|mariadbd/i.test(processName)
  },
  {
    id: 'redis',
    name: 'Redis',
    icon: '🟥',
    badgeColor: '#DC382D',
    category: 'database',
    description: 'Redis In-Memory Key-Value Store',
    defaultPortHint: 6379,
    match: ({ port, processName }) =>
      port === 6379 || /redis-server/i.test(processName)
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    icon: '🍃',
    badgeColor: '#47A248',
    category: 'database',
    description: 'MongoDB NoSQL Database',
    defaultPortHint: 27017,
    match: ({ port, processName }) =>
      port === 27017 || /mongod/i.test(processName)
  },
  // Spring Boot / Java
  {
    id: 'springboot',
    name: 'Spring Boot / Java',
    icon: '☕',
    badgeColor: '#6DB33F',
    category: 'api-runtime',
    description: 'Java Spring Boot Application Server',
    match: ({ processName, commandLine }) =>
      /java(\.exe)?$/i.test(processName) || /spring-boot|gradlew|mvnw/i.test(commandLine)
  },
  // Go
  {
    id: 'golang',
    name: 'Go Web Server',
    icon: '🐹',
    badgeColor: '#00ADD8',
    category: 'api-runtime',
    description: 'Go HTTP / Web Service',
    match: ({ processName, commandLine }) =>
      /go(\.exe)?$/i.test(processName) || /go\s+run/i.test(commandLine)
  },
  // Rust
  {
    id: 'rust',
    name: 'Rust Web Server',
    icon: '🦀',
    badgeColor: '#DEA584',
    category: 'api-runtime',
    description: 'Rust Cargo / Actix / Axum Service',
    match: ({ commandLine }) =>
      /cargo\s+run/i.test(commandLine)
  },
  // Windows System Services
  {
    id: 'windows-system',
    name: 'Windows System Service',
    icon: '🪟',
    badgeColor: '#0078D4',
    category: 'system',
    description: 'Windows Core System Service',
    match: ({ processName, port }) =>
      /svchost|services|system|lsass|wininit/i.test(processName) ||
      port === 135 || port === 445
  }
];

export function detectFramework(params: {
  port: number;
  processName: string;
  commandLine: string;
  executablePath: string;
}): DevFrameworkInfo {
  for (const rule of FRAMEWORK_RULES) {
    if (rule.match(params)) {
      return {
        id: rule.id,
        name: rule.name,
        icon: rule.icon,
        badgeColor: rule.badgeColor,
        category: rule.category,
        description: rule.description,
        defaultPortHint: rule.defaultPortHint
      };
    }
  }

  // Fallback heuristic based on port and process
  const isDevPort = [3000, 3001, 3002, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8888, 9000, 9001].includes(params.port);
  const isSystem = params.port < 1024 || /svchost|system/i.test(params.processName);

  if (isSystem) {
    return {
      id: 'system',
      name: 'System Service',
      icon: '⚙️',
      badgeColor: '#6c757d',
      category: 'system',
      description: 'Operating System Background Service'
    };
  }

  if (isDevPort || /node|python|bun|deno/i.test(params.processName)) {
    return {
      id: 'generic-dev',
      name: 'Dev Server',
      icon: '⚡',
      badgeColor: '#3b82f6',
      category: 'dev-server',
      description: `Development Server on :${params.port}`
    };
  }

  return {
    id: 'unknown',
    name: params.processName || `Port ${params.port}`,
    icon: '🔌',
    badgeColor: '#94a3b8',
    category: 'other',
    description: `Process ${params.processName} on port ${params.port}`
  };
}
