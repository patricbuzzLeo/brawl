
export enum TileType {
  EMPTY = 0,
  WALL = 1,
  BUSH = 2,
  WATER = 3,
  SPAWN_PLAYER = 4,
  SPAWN_ENEMY = 5,
  GEM_SPAWNER = 6,
  SAFE_PLAYER = 7,
  SAFE_ENEMY = 8
}

export interface Point {
  x: number;
  y: number;
}

export type CharacterClass = 'speedy' | 'tank' | 'sniper' | 'ninja' | 'minigun' | 'hunter' | 'tech' | 'spy' | 'golem';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface CharacterStats {
  name: string;
  hp: number;
  speed: number;
  damage: number;
  range: number; // bullet lifetime/speed factor
  reload: number; // cooldown
  bulletCount: number; // 1 for linear, 3 for shotgun
  bulletSpread: number; // angle spread
  color: string;
  price: number; // Cost in coins
}

export type GameModeType = 'gem_grab' | 'heist' | 'duel';

export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  hp: number;
  maxHp: number;
  speed: number;
  gems: number;
  team: 'player' | 'enemy';
  isDead: boolean;
  angle: number; // Rotation in radians
  cooldown: number; // Frames until next shot
  stats: CharacterStats;
  isSafe?: boolean; // For Heist mode
  respawnTimer: number; // 0 if alive, >0 if dead (frames)
  
  // Leveling
  level: number;
  xp: number;
  maxXp: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  damage: number;
  team: 'player' | 'enemy';
  range: number; // distance traveled
  maxRange: number;
}

export interface Gem {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  vx?: number; // Animation floating
  vy?: number;
}

export interface GameMap {
  width: number;
  height: number;
  tiles: TileType[][];
  themeName: string;
  description: string;
}

export interface GameConfig {
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
}

export const CHARACTERS: Record<CharacterClass, CharacterStats> = {
  speedy: {
    name: 'Speedy',
    hp: 800,
    speed: 4.5,
    damage: 200,
    range: 15, // frames * speed approx
    reload: 10,
    bulletCount: 1,
    bulletSpread: 0,
    color: '#3b82f6', // Blue
    price: 0 // Free starter
  },
  tank: {
    name: 'Tank',
    hp: 1600,
    speed: 3.0,
    damage: 120, // per bullet
    range: 10,
    reload: 35,
    bulletCount: 3, // Shotgun
    bulletSpread: 0.3,
    color: '#10b981', // Green
    price: 500
  },
  sniper: {
    name: 'Sniper',
    hp: 600,
    speed: 3.5,
    damage: 600,
    range: 30,
    reload: 50,
    bulletCount: 1,
    bulletSpread: 0,
    color: '#8b5cf6', // Purple
    price: 1000
  },
  ninja: {
    name: 'Ninja',
    hp: 750,
    speed: 5.0,
    damage: 150,
    range: 12,
    reload: 12,
    bulletCount: 2,
    bulletSpread: 0.15,
    color: '#475569', // Slate 600
    price: 2000
  },
  minigun: {
    name: 'Minigun',
    hp: 1400,
    speed: 2.2,
    damage: 40,
    range: 14,
    reload: 4,
    bulletCount: 1,
    bulletSpread: 0.15,
    color: '#ea580c', // Orange 600
    price: 3000
  },
  hunter: {
    name: 'Hunter',
    hp: 950,
    speed: 3.8,
    damage: 90,
    range: 13,
    reload: 40,
    bulletCount: 6,
    bulletSpread: 0.5,
    color: '#ca8a04', // Yellow 600
    price: 2500
  },
  tech: {
    name: 'Tech',
    hp: 900,
    speed: 3.6,
    damage: 240,
    range: 22,
    reload: 18,
    bulletCount: 1,
    bulletSpread: 0,
    color: '#0891b2', // Cyan 600
    price: 3500
  },
  spy: {
    name: 'Spy',
    hp: 550,
    speed: 5.5,
    damage: 180,
    range: 12,
    reload: 15,
    bulletCount: 1,
    bulletSpread: 0,
    color: '#db2777', // Pink 600
    price: 4000
  },
  golem: {
    name: 'Golem',
    hp: 2500,
    speed: 1.8,
    damage: 350,
    range: 9,
    reload: 55,
    bulletCount: 1,
    bulletSpread: 0,
    color: '#4b5563', // Gray 600
    price: 5000
  }
};
