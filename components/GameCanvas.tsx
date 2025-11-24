
import React, { useRef, useEffect, useState } from 'react';
import { GameMap, TileType, Entity, Bullet, Gem, Point, CharacterClass, GameModeType, CHARACTERS, Difficulty } from '../types';
import { Home } from 'lucide-react';

interface GameCanvasProps {
  map: GameMap;
  onGameOver: (result: 'win' | 'lose', gems: number) => void;
  onExit: () => void;
  characterClass: CharacterClass;
  gameMode: GameModeType;
  inputState: React.MutableRefObject<{
    move: { x: number; y: number };
    aim: { x: number; y: number; active: boolean };
    shootRequest: boolean;
  }>;
  difficulty: Difficulty;
}

// Constants
const TILE_SIZE = 48;
const BOT_SPEED = 2.5;
const BULLET_SPEED = 10;
const FIRE_COOLDOWN = 15; 
const GEM_SPAWN_RATE = 120; // frames (2 seconds)
const GEM_WIN_COUNT = 10;
const HEIST_SAFE_HP = 6000;
const RESPAWN_TIME = 180; // 3 seconds at 60fps

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
    map, 
    onGameOver, 
    onExit,
    characterClass, 
    gameMode,
    inputState,
    difficulty
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Mutable Game State
  const playerRef = useRef<Entity | null>(null);
  const botsRef = useRef<Entity[]>([]); // Includes teammates and enemies
  const safeboxesRef = useRef<Entity[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const gemsRef = useRef<Gem[]>([]);
  const frameCountRef = useRef<number>(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const gameStateRef = useRef<'playing' | 'ended'>('playing');
  
  // Input tracking to prevent aim snapping
  const lastInputTypeRef = useRef<'mouse' | 'joystick'>('mouse');

  // Spawn Locations (cached for respawn)
  const spawnPointsRef = useRef<{player: Point[], enemy: Point[]}>({ player: [], enemy: [] });

  // React State for HUD
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [playerDead, setPlayerDead] = useState(false);
  const [respawnTime, setRespawnTime] = useState(0);
  
  const [ammo, setAmmo] = useState(100);
  const [scoreP, setScoreP] = useState(0);
  const [scoreE, setScoreE] = useState(0);
  
  // In-Game Level State
  const [inGameLevel, setInGameLevel] = useState(1);
  const [inGameXp, setInGameXp] = useState(0);
  const [inGameMaxXp, setInGameMaxXp] = useState(100);

  // --- Initialization ---
  useEffect(() => {
    gameStateRef.current = 'playing';
    bulletsRef.current = [];
    gemsRef.current = [];
    botsRef.current = [];
    safeboxesRef.current = [];
    frameCountRef.current = 0;
    
    // Find Spawns
    const pSpawns: Point[] = [];
    const eSpawns: Point[] = [];
    const safeSpawns: {x: number, y: number, team: 'player'|'enemy'}[] = [];

    map.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === TileType.SPAWN_PLAYER) pSpawns.push({ x, y });
        if (tile === TileType.SPAWN_ENEMY) eSpawns.push({ x, y });
        if (tile === TileType.SAFE_PLAYER) safeSpawns.push({ x, y, team: 'player' });
        if (tile === TileType.SAFE_ENEMY) safeSpawns.push({ x, y, team: 'enemy' });
      });
    });

    spawnPointsRef.current = { player: pSpawns, enemy: eSpawns };

    // fallback spawns
    if (pSpawns.length === 0) pSpawns.push({x: 2, y: map.height-2});
    if (eSpawns.length === 0) eSpawns.push({x: map.width-2, y: 2});

    const pStats = CHARACTERS[characterClass];
    const mainSpawn = pSpawns[0];

    // Create Player
    playerRef.current = {
      id: 'player',
      x: mainSpawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: mainSpawn.y * TILE_SIZE + TILE_SIZE / 2,
      radius: 18,
      color: pStats.color,
      hp: pStats.hp,
      maxHp: pStats.hp,
      speed: pStats.speed,
      gems: 0,
      team: 'player',
      isDead: false,
      angle: -Math.PI/2,
      cooldown: 0,
      stats: { ...pStats }, // Clone stats
      respawnTimer: 0,
      level: 1,
      xp: 0,
      maxXp: 100
    };
    setPlayerMaxHp(pStats.hp);
    setPlayerHp(pStats.hp);

    const availableClasses: CharacterClass[] = ['speedy', 'tank', 'sniper'];
    
    const createBot = (team: 'player'|'enemy', idx: number, spawnList: Point[]) => {
       const spawn = spawnList[idx % spawnList.length];
       const type = availableClasses[Math.floor(Math.random() * availableClasses.length)];
       const baseStats = CHARACTERS[type];
       
       // Clone stats to modify
       const stats = { ...baseStats };

       if (team === 'enemy') {
           let hpMult = 0.6;
           let dmgMult = 0.5;
           let speedMult = 0.9;
           let reloadMult = 1.3; // Higher is slower

           if (difficulty === 'easy') {
               hpMult = 0.4;
               dmgMult = 0.3;
               speedMult = 0.8;
               reloadMult = 1.6;
           } else if (difficulty === 'hard') {
               hpMult = 0.9;
               dmgMult = 0.8;
               speedMult = 1.0;
               reloadMult = 1.0;
           }

           stats.hp = Math.round(stats.hp * hpMult);
           stats.damage = Math.round(stats.damage * dmgMult);
           stats.reload = Math.round(stats.reload * reloadMult);
           stats.speed = stats.speed * speedMult;
       } else {
           // Ally bots are always 'Normal' strength relative to base, maybe slightly nerfed to not carry too hard
           stats.hp = Math.round(stats.hp * 0.8);
           stats.damage = Math.round(stats.damage * 0.7);
       }

       // Offset slightly to avoid stacking
       const offsetX = (Math.random() - 0.5) * TILE_SIZE;
       const offsetY = (Math.random() - 0.5) * TILE_SIZE;
       
       return {
            id: `bot_${team}_${idx}`,
            x: spawn.x * TILE_SIZE + TILE_SIZE / 2 + offsetX,
            y: spawn.y * TILE_SIZE + TILE_SIZE / 2 + offsetY,
            radius: 18,
            color: stats.color,
            hp: stats.hp,
            maxHp: stats.hp,
            speed: stats.speed * 0.85, 
            gems: 0,
            team: team,
            isDead: false,
            angle: team === 'player' ? -Math.PI/2 : Math.PI/2,
            cooldown: 0,
            stats: stats,
            respawnTimer: 0,
            level: 1,
            xp: 0,
            maxXp: 100
       } as Entity;
    };

    // 3v3 Setup (Player + 2 Bots vs 3 Bots)
    if (gameMode !== 'duel') {
        // 2 Allies
        botsRef.current.push(createBot('player', 1, pSpawns));
        botsRef.current.push(createBot('player', 2, pSpawns));
        // 3 Enemies
        botsRef.current.push(createBot('enemy', 0, eSpawns));
        botsRef.current.push(createBot('enemy', 1, eSpawns));
        botsRef.current.push(createBot('enemy', 2, eSpawns));
    } else {
        // Duel 1v1
        botsRef.current.push(createBot('enemy', 0, eSpawns));
    }

    // Safes
    if (gameMode === 'heist') {
        safeboxesRef.current = safeSpawns.map((s, i) => ({
            id: `safe-${s.team}`,
            x: s.x * TILE_SIZE + TILE_SIZE / 2,
            y: s.y * TILE_SIZE + TILE_SIZE / 2,
            radius: 24,
            color: s.team === 'player' ? '#3b82f6' : '#ef4444',
            hp: HEIST_SAFE_HP,
            maxHp: HEIST_SAFE_HP,
            speed: 0,
            gems: 0,
            team: s.team,
            isDead: false,
            angle: 0,
            cooldown: 0,
            stats: CHARACTERS.tank,
            isSafe: true,
            respawnTimer: 0,
            level: 1,
            xp: 0,
            maxXp: 100
        }));
    }

    setScoreP(0);
    setScoreE(0);

  }, [map, characterClass, gameMode, difficulty]);

  // --- Input ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      lastInputTypeRef.current = 'mouse';
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    const handleMouseDown = (e: MouseEvent) => {
       lastInputTypeRef.current = 'mouse';
       if (gameStateRef.current === 'playing' && playerRef.current && !playerRef.current.isDead) {
           shoot(playerRef.current, mouseRef.current.x, mouseRef.current.y);
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // --- Logic ---
  const checkWallCollision = (x: number, y: number, r: number): boolean => {
    const points = [
        { x: x - r, y: y }, { x: x + r, y: y },
        { x: x, y: y - r }, { x: x, y: y + r }
    ];

    for (const p of points) {
        const tx = Math.floor(p.x / TILE_SIZE);
        const ty = Math.floor(p.y / TILE_SIZE);
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return true;
        const tile = map.tiles[ty][tx];
        if (tile === TileType.WALL || tile === TileType.WATER || tile === TileType.SAFE_PLAYER || tile === TileType.SAFE_ENEMY) return true;
    }
    return false;
  };

  const shoot = (shooter: Entity, targetX: number, targetY: number) => {
      if (shooter.cooldown > 0) return;
      
      const angle = Math.atan2(targetY - shooter.y, targetX - shooter.x);
      const count = shooter.stats.bulletCount;
      const spread = shooter.stats.bulletSpread;
      const startAngle = angle - (spread * (count - 1)) / 2;

      for(let i=0; i<count; i++) {
          const fireAngle = startAngle + i * spread;
          const vx = Math.cos(fireAngle) * BULLET_SPEED;
          const vy = Math.sin(fireAngle) * BULLET_SPEED;

          bulletsRef.current.push({
              id: `${shooter.id}_b_${Date.now()}_${i}`,
              x: shooter.x + Math.cos(fireAngle) * (shooter.radius + 10),
              y: shooter.y + Math.sin(fireAngle) * (shooter.radius + 10),
              vx,
              vy,
              ownerId: shooter.id,
              team: shooter.team,
              damage: shooter.stats.damage,
              range: 0,
              maxRange: shooter.stats.range * BULLET_SPEED
          });
      }

      shooter.cooldown = shooter.stats.reload;
  };

  const gainXp = (ent: Entity, amount: number) => {
      if (ent.isSafe) return;
      ent.xp += amount;
      // Level Up Logic
      while (ent.xp >= ent.maxXp) {
          ent.xp -= ent.maxXp;
          ent.level += 1;
          ent.maxXp = ent.level * 100; // Linear XP curve
          
          // Stats Buff
          ent.maxHp = Math.round(ent.maxHp * 1.15); // +15% Max HP
          ent.hp = ent.maxHp; // Full Heal
          ent.stats.damage = Math.round(ent.stats.damage * 1.1); // +10% Damage
      }
  };

  const respawnEntity = (ent: Entity) => {
      const spawns = ent.team === 'player' ? spawnPointsRef.current.player : spawnPointsRef.current.enemy;
      if (spawns.length === 0) return;
      
      const spawn = spawns[Math.floor(Math.random() * spawns.length)];
      ent.x = spawn.x * TILE_SIZE + TILE_SIZE/2;
      ent.y = spawn.y * TILE_SIZE + TILE_SIZE/2;
      ent.hp = ent.maxHp;
      ent.isDead = false;
      ent.respawnTimer = 0;
      ent.gems = 0; 
  };

  const update = () => {
    if (gameStateRef.current !== 'playing') return;
    frameCountRef.current++;

    const player = playerRef.current;
    if (!player) return;

    // --- Respawn Logic ---
    [player, ...botsRef.current].forEach(ent => {
        if (ent.isDead) {
            ent.respawnTimer--;
            if (ent.respawnTimer <= 0) {
                if (gameMode === 'duel' && (ent.id === 'player' || ent.team === 'enemy')) {
                    // Do nothing
                } else {
                    respawnEntity(ent);
                }
            }
        }
    });

    // --- Gem Spawner ---
    if (gameMode === 'gem_grab' && frameCountRef.current % GEM_SPAWN_RATE === 0) {
       let spawner: Point | null = null;
       map.tiles.forEach((row, y) => {
           row.forEach((t, x) => {
               if (t === TileType.GEM_SPAWNER) spawner = {x, y};
           });
       });

       if (spawner && gemsRef.current.length < 20) {
           gemsRef.current.push({
               id: `gem_${Date.now()}`,
               x: spawner.x * TILE_SIZE + TILE_SIZE/2,
               y: spawner.y * TILE_SIZE + TILE_SIZE/2,
               collected: false
           });
       }
    }

    // --- Player Control ---
    if (!player.isDead) {
        let dx = 0;
        let dy = 0;
        if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= 1;
        if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += 1;
        if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= 1;
        if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += 1;

        const jMove = inputState.current.move;
        if (jMove.x !== 0 || jMove.y !== 0) {
            dx = jMove.x;
            dy = jMove.y;
            lastInputTypeRef.current = 'joystick';
        }

        if (dx !== 0 || dy !== 0) {
            if (jMove.x === 0 && jMove.y === 0) {
                const len = Math.sqrt(dx*dx + dy*dy);
                dx /= len; dy /= len;
            }
            dx *= player.speed;
            dy *= player.speed;

            if (!checkWallCollision(player.x + dx, player.y, player.radius)) player.x += dx;
            if (!checkWallCollision(player.x, player.y + dy, player.radius)) player.y += dy;
        }

        // Aiming Logic
        const jAim = inputState.current.aim;
        
        if (jAim.active) {
            lastInputTypeRef.current = 'joystick';
            player.angle = Math.atan2(jAim.y, jAim.x);
        } else if (lastInputTypeRef.current === 'joystick') {
            if (inputState.current.shootRequest) {
            } else if (dx !== 0 || dy !== 0) {
                 player.angle = Math.atan2(dy, dx);
            }
        } else if (mouseRef.current) {
            player.angle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
        }

        if (inputState.current.shootRequest) {
            shoot(player, player.x + Math.cos(player.angle)*100, player.y + Math.sin(player.angle)*100);
            inputState.current.shootRequest = false;
        }
        if (player.cooldown > 0) player.cooldown--;
    }

    // --- Bot AI (Both Teams) ---
    botsRef.current.forEach(bot => {
        if (bot.isDead) return;

        const enemies = [player, ...botsRef.current].filter(e => e.team !== bot.team && !e.isDead);
        const safes = safeboxesRef.current.filter(s => s.team !== bot.team && !s.isDead);
        
        let target: Entity | Gem | null = null;
        let targetX = bot.x;
        let targetY = bot.y;

        if (gameMode === 'heist' && safes.length > 0) {
            target = safes[0];
            targetX = target.x;
            targetY = target.y;
        } 
        else if (gameMode === 'gem_grab') {
            if (bot.gems >= 5) {
                const spawn = bot.team === 'player' ? spawnPointsRef.current.player[0] : spawnPointsRef.current.enemy[0];
                targetX = spawn.x * TILE_SIZE;
                targetY = spawn.y * TILE_SIZE;
            } else {
                let minD = Infinity;
                let nearGem = null;
                gemsRef.current.forEach(g => {
                    if (!g.collected) {
                        const d = Math.hypot(g.x - bot.x, g.y - bot.y);
                        if (d < minD) { minD = d; nearGem = g; }
                    }
                });
                if (nearGem && minD < 400) {
                    target = nearGem;
                    targetX = nearGem.x;
                    targetY = nearGem.y;
                }
            }
        }

        if (!target) {
            let minD = Infinity;
            enemies.forEach(e => {
                const d = Math.hypot(e.x - bot.x, e.y - bot.y);
                if (d < minD) { minD = d; target = e; }
            });
            if (target) {
                targetX = target.x;
                targetY = target.y;
            }
        }

        if (target || (targetX !== bot.x)) {
            const angle = Math.atan2(targetY - bot.y, targetX - bot.x);
            const dist = Math.hypot(targetX - bot.x, targetY - bot.y);
            
            let move = true;
            if ((target as Entity)?.id && dist < 250 && bot.stats.name === 'Sniper') move = false;

            if (move && dist > 10) { 
                const mx = Math.cos(angle) * bot.speed;
                const my = Math.sin(angle) * bot.speed;
                if (!checkWallCollision(bot.x + mx, bot.y, bot.radius)) bot.x += mx;
                else if (!checkWallCollision(bot.x, bot.y + my, bot.radius)) bot.y += my;
            }

            if ((target as Entity)?.hp !== undefined) {
                 bot.angle = angle;
                 if (dist < bot.stats.range * BULLET_SPEED) {
                     if (bot.team === 'enemy') {
                         const miss = difficulty === 'hard' ? 20 : (difficulty === 'easy' ? 100 : 60);
                         shoot(bot, targetX + (Math.random()-0.5)*miss, targetY + (Math.random()-0.5)*miss);
                     } else {
                         shoot(bot, targetX, targetY);
                     }
                 }
            } else {
                bot.angle = angle; 
            }
        }

        if (bot.cooldown > 0) bot.cooldown--;
    });

    // --- Physics ---
    bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += b.vx;
        b.y += b.vy;
        b.range += BULLET_SPEED;

        if (b.range >= b.maxRange) return false;

        const tx = Math.floor(b.x / TILE_SIZE);
        const ty = Math.floor(b.y / TILE_SIZE);
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
        if (map.tiles[ty][tx] === TileType.WALL || map.tiles[ty][tx] === TileType.WATER) return false;

        const checkHit = (ent: Entity) => {
            if (ent.isDead || ent.team === b.team) return false;
            if (ent.respawnTimer > 0) return false; 
            const dist = Math.hypot(b.x - ent.x, b.y - ent.y);
            if (dist < ent.radius + 5) {
                ent.hp -= b.damage;
                if (ent.hp <= 0) {
                    ent.hp = 0;
                    ent.isDead = true;
                    ent.respawnTimer = RESPAWN_TIME;
                    
                    // Give XP to Killer
                    const allEnts = [player, ...botsRef.current];
                    const killer = allEnts.find(e => e.id === b.ownerId);
                    if (killer) {
                        gainXp(killer, 80); // Big XP for kill
                    }

                    if (!ent.isSafe) {
                        const gemsToDrop = Math.floor(ent.gems / 2) + 2; 
                        for(let i=0; i<gemsToDrop; i++) {
                            gemsRef.current.push({
                                id: `drop_${Date.now()}_${i}`,
                                x: ent.x + (Math.random()*40 - 20),
                                y: ent.y + (Math.random()*40 - 20),
                                collected: false
                            });
                        }
                        ent.gems = 0;
                    }
                }
                return true;
            }
            return false;
        };

        if (checkHit(player)) return false; 
        for (const bot of botsRef.current) {
            if (checkHit(bot)) return false; 
        }
        for (const safe of safeboxesRef.current) {
            if (checkHit(safe)) return false;
        }

        return true; 
    });

    // --- Gem Collection ---
    if (gameMode === 'gem_grab') {
        const collectGem = (ent: Entity) => {
            if (ent.isDead) return;
            gemsRef.current = gemsRef.current.filter(g => {
                const dist = Math.hypot(g.x - ent.x, g.y - ent.y);
                if (dist < ent.radius + 15) {
                    ent.gems++;
                    gainXp(ent, 15); // Small XP for gem
                    return false; 
                }
                return true;
            });
        };
        collectGem(player);
        botsRef.current.forEach(e => collectGem(e));
    }

    // --- State Sync ---
    setPlayerHp(player.hp);
    setPlayerMaxHp(player.maxHp);
    setPlayerDead(player.isDead);
    setRespawnTime(Math.ceil(player.respawnTimer / 60));
    setAmmo(Math.max(0, 100 - (player.cooldown / player.stats.reload) * 100));
    setInGameLevel(player.level);
    setInGameXp(player.xp);
    setInGameMaxXp(player.maxXp);

    // Scores
    if (gameMode === 'gem_grab') {
        const pGems = player.gems + botsRef.current.filter(b => b.team === 'player').reduce((a,b)=>a+b.gems, 0);
        const eGems = botsRef.current.filter(b => b.team === 'enemy').reduce((a,b)=>a+b.gems, 0);
        setScoreP(pGems);
        setScoreE(eGems);

        if (pGems >= GEM_WIN_COUNT) {
             gameStateRef.current = 'ended';
             onGameOver('win', player.gems);
        } else if (eGems >= GEM_WIN_COUNT) {
             gameStateRef.current = 'ended';
             onGameOver('lose', player.gems);
        }
    } else if (gameMode === 'heist') {
        const pSafe = safeboxesRef.current.find(s => s.team === 'player');
        const eSafe = safeboxesRef.current.find(s => s.team === 'enemy');
        setScoreP(pSafe ? Math.ceil((pSafe.hp / HEIST_SAFE_HP)*100) : 0);
        setScoreE(eSafe ? Math.ceil((eSafe.hp / HEIST_SAFE_HP)*100) : 0);

        if (eSafe?.isDead) {
            gameStateRef.current = 'ended';
            onGameOver('win', 0);
        } else if (pSafe?.isDead) {
            gameStateRef.current = 'ended';
            onGameOver('lose', 0);
        }
    } else if (gameMode === 'duel') {
        const enemy = botsRef.current.find(b => b.team === 'enemy');
        setScoreP(player.isDead ? 0 : 1);
        setScoreE(enemy && !enemy.isDead ? 1 : 0);

        if (enemy?.isDead) {
            gameStateRef.current = 'ended';
            onGameOver('win', 0);
        } else if (player.isDead) {
            gameStateRef.current = 'ended';
            onGameOver('lose', 0);
        }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    if (!player) return;
    
    // Clear
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const camX = canvas.width / 2 - player.x;
    const camY = canvas.height / 2 - player.y;

    ctx.save();
    ctx.translate(camX, camY);

    // Draw Tiles
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = map.tiles[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            if (px + camX < -TILE_SIZE || px + camX > canvas.width || py + camY < -TILE_SIZE || py + camY > canvas.height) continue;

            if (tile === TileType.WALL) {
                ctx.fillStyle = '#334155';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(px, py + TILE_SIZE - 6, TILE_SIZE, 6);
            } else if (tile === TileType.BUSH) {
                ctx.fillStyle = '#22c55e';
                ctx.globalAlpha = 0.6;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.globalAlpha = 1.0;
            } else if (tile === TileType.WATER) {
                ctx.fillStyle = '#0ea5e9';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            } else if (tile === TileType.GEM_SPAWNER) {
                ctx.fillStyle = '#1e1b4b';
                ctx.beginPath();
                ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 12, 0, Math.PI*2);
                ctx.fill();
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = '#475569';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Entities
    const entities = [player, ...botsRef.current, ...safeboxesRef.current];
    entities.sort((a, b) => a.y - b.y);

    entities.forEach(ent => {
        if (ent.isDead) return;

        if (ent.isSafe) {
            ctx.fillStyle = ent.color;
            ctx.fillRect(ent.x - 20, ent.y - 20, 40, 40);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(ent.x - 20, ent.y - 20, 40, 40);
            const hpPct = ent.hp / ent.maxHp;
            ctx.fillStyle = '#000';
            ctx.fillRect(ent.x - 24, ent.y - 35, 48, 8);
            ctx.fillStyle = ent.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillRect(ent.x - 24 + 1, ent.y - 35 + 1, 46 * hpPct, 6);
            return;
        }

        ctx.beginPath();
        ctx.ellipse(ent.x, ent.y + 12, 16, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
        ctx.fillStyle = ent.color;
        ctx.fill();
        // Highlight player
        if (ent.id === 'player') {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
        }
        ctx.stroke();

        ctx.save();
        ctx.translate(ent.x, ent.y);
        ctx.rotate(ent.angle);
        ctx.fillStyle = '#333';
        if (ent.stats.name === 'Tank') ctx.fillRect(10, -8, 24, 16); 
        else if (ent.stats.name === 'Sniper') ctx.fillRect(10, -3, 35, 6);
        else ctx.fillRect(10, -4, 20, 8);
        ctx.restore();

        const hpPct = ent.hp / ent.maxHp;
        const barW = 36;
        ctx.fillStyle = '#000';
        ctx.fillRect(ent.x - barW/2, ent.y - 30, barW, 6);
        // Teammates green, enemies red
        ctx.fillStyle = ent.team === 'player' ? '#3b82f6' : '#ef4444';
        ctx.fillRect(ent.x - barW/2 + 1, ent.y - 30 + 1, (barW-2) * hpPct, 4);

        // Draw Level Badge
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ent.x - barW/2 - 8, ent.y - 27, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(ent.level.toString(), ent.x - barW/2 - 8, ent.y - 24);

        if (ent.gems > 0) {
            ctx.save();
            ctx.translate(ent.x, ent.y - 45);
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(6, 0);
            ctx.lineTo(0, 6);
            ctx.lineTo(-6, 0);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(ent.gems.toString(), 0, -8);
            ctx.restore();
        }
    });

    gemsRef.current.forEach(g => {
        if (g.collected) return;
        const bounce = Math.sin(Date.now() / 200) * 3;
        ctx.save();
        ctx.translate(g.x, g.y + bounce);
        ctx.fillStyle = '#d8b4fe';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-8, 0);
        ctx.fill();
        ctx.strokeStyle = '#a855f7';
        ctx.stroke();
        ctx.restore();
    });

    bulletsRef.current.forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.fillStyle = b.team === 'player' ? '#93c5fd' : '#fca5a5';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });

    ctx.restore();

    // --- Overlays ---
    if (gameMode === 'heist') {
        const eSafe = safeboxesRef.current.find(s => s.team === 'enemy');
        if (eSafe && !eSafe.isDead) {
            const sx = eSafe.x + camX;
            const sy = eSafe.y + camY;
            const isOnScreen = sx > 0 && sx < canvas.width && sy > 0 && sy < canvas.height;

            if (!isOnScreen) {
                const angle = Math.atan2(eSafe.y - player.y, eSafe.x - player.x);
                const padding = 50;
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const r = Math.min(canvas.width, canvas.height)/2 - padding;
                const ix = cx + Math.cos(angle) * r;
                const iy = cy + Math.sin(angle) * r;

                ctx.save();
                ctx.translate(ix, iy);
                ctx.rotate(angle);
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-10, 10);
                ctx.lineTo(-10, -10);
                ctx.fill();
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.rotate(-angle); 
                ctx.fillText("ATTACK", 0, 20);
                ctx.restore();
            }
        }
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [map]); 

  const getScoreLabel = () => {
      if (gameMode === 'gem_grab') return 'Total Gems';
      if (gameMode === 'heist') return 'Safe HP';
      return 'Enemies';
  };

  return (
    <div className="relative w-full h-full flex justify-center items-center bg-slate-900 overflow-hidden">
        {/* HUD Top Left */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-slate-800/80 p-3 rounded-lg border-l-4 border-blue-500 min-w-[160px] shadow-lg">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">ALLY TEAM</span>
                    <span className="text-xs font-bold text-white">{characterClass.toUpperCase()}</span>
                </div>
                <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-200" style={{width: `${Math.max(0, (playerHp/playerMaxHp)*100)}%`}} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                     <span className="text-xl font-black text-purple-400">{scoreP}</span>
                     <span className="text-xs text-slate-300 uppercase">{getScoreLabel()}</span>
                </div>
            </div>
            <div className="mt-2 w-full h-1 bg-slate-700 rounded overflow-hidden">
                 <div className="h-full bg-yellow-500 transition-all duration-75" style={{width: `${ammo}%`}} />
            </div>
        </div>

        {/* HUD Top Center - Menu Button */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
            <button 
                onClick={onExit}
                className="bg-slate-800/80 hover:bg-slate-700 text-white px-4 py-2 rounded-full font-bold shadow-lg border border-slate-600 backdrop-blur pointer-events-auto flex items-center gap-2 transition-transform active:scale-95"
            >
                <Home size={16} />
                <span className="text-sm">EXIT</span>
            </button>
        </div>

        {/* HUD Top Right */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none text-right">
             <div className="bg-slate-800/80 p-3 rounded-lg border-r-4 border-red-500 min-w-[160px] shadow-lg">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-white uppercase">{gameMode.replace('_', ' ')}</span>
                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">ENEMY</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                     <span className="text-xs text-slate-300 uppercase">{getScoreLabel()}</span>
                     <span className="text-xl font-black text-red-400">{scoreE}</span>
                </div>
            </div>
        </div>

        {/* XP Bar (Bottom Center) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-1/3 min-w-[200px]">
            <div className="flex justify-between text-xs font-bold text-white drop-shadow-md mb-1 px-1">
                 <span>LVL {inGameLevel}</span>
                 <span>{(inGameXp / inGameMaxXp * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-4 bg-black/50 rounded-full border border-slate-500/50 backdrop-blur-sm overflow-hidden p-[2px]">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{width: `${Math.min(100, (inGameXp / inGameMaxXp)*100)}%`}}
                />
            </div>
        </div>

        {/* Death Overlay */}
        {playerDead && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
                <h2 className="text-4xl font-black text-red-500 uppercase tracking-widest drop-shadow-lg mb-2">You Died</h2>
                <div className="text-2xl font-bold text-white">Respawning in {respawnTime}...</div>
            </div>
        )}

        <canvas 
            ref={canvasRef}
            width={window.innerWidth} 
            height={window.innerHeight}
        />
    </div>
  );
};
