import { TileType, GameMap, GameModeType } from '../types';

const MAP_SIZE = 24; 

// Procedurally generate a symmetric map
export const generateGameMap = async (mode: GameModeType): Promise<GameMap> => {
  // Simulate async delay slightly
  await new Promise(resolve => setTimeout(resolve, 400));

  const tiles: TileType[][] = Array(MAP_SIZE).fill(null).map(() => Array(MAP_SIZE).fill(TileType.EMPTY));

  // 1. Generate Top-Left Quadrant
  const halfSize = MAP_SIZE / 2;
  const quadrant: TileType[][] = [];

  for (let y = 0; y < halfSize; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < halfSize; x++) {
        let type = TileType.EMPTY;
        const rand = Math.random();
        
        // Structure logic
        if (rand < 0.12) type = TileType.WALL;
        else if (rand < 0.20) type = TileType.WATER;
        else if (rand < 0.40) type = TileType.BUSH;
        
        // Clear start area
        if (x < 3 && y < 3) type = TileType.EMPTY;

        // Clear center diagonals for lanes
        if (Math.abs(x - y) < 2) type = TileType.EMPTY;

        row.push(type);
    }
    quadrant.push(row);
  }

  // 2. Cellular Automata clean up (remove single walls)
  for (let y = 1; y < halfSize - 1; y++) {
    for (let x = 1; x < halfSize - 1; x++) {
        if (quadrant[y][x] === TileType.WALL) {
            if (quadrant[y-1][x] === TileType.EMPTY && quadrant[y+1][x] === TileType.EMPTY &&
                quadrant[y][x-1] === TileType.EMPTY && quadrant[y][x+1] === TileType.EMPTY) {
                quadrant[y][x] = TileType.EMPTY;
            }
        }
    }
  }

  // 3. Mirror Quadrant (Full Symmetry)
  // Mirror horizontally then vertically to create 4-way symmetry or 2-way rotational
  // For Brawl stars, usually rotational or mirror x/y
  for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
          // Map to quadrant coordinates
          let qx = x < halfSize ? x : MAP_SIZE - 1 - x;
          let qy = y < halfSize ? y : MAP_SIZE - 1 - y;
          
          tiles[y][x] = quadrant[qy][qx];
      }
  }

  // 4. Borders
  for(let i=0; i<MAP_SIZE; i++) {
      tiles[0][i] = TileType.WALL;
      tiles[MAP_SIZE-1][i] = TileType.WALL;
      tiles[i][0] = TileType.WALL;
      tiles[i][MAP_SIZE-1] = TileType.WALL;
  }

  // 5. Place Objectives based on Mode
  const clearArea = (cx: number, cy: number, r: number = 1) => {
      for(let y=cy-r; y<=cy+r; y++) {
          for(let x=cx-r; x<=cx+r; x++) {
             if (tiles[y] && tiles[y][x] !== undefined) {
                 tiles[y][x] = TileType.EMPTY;
             }
          }
      }
  };

  // Center Point
  const cx = halfSize; // actual center index logic depends on even/odd, roughly 12
  const cy = halfSize;
  const centerIdx = MAP_SIZE / 2;

  // Clear center
  clearArea(centerIdx-1, centerIdx-1, 2);

  if (mode === 'gem_grab') {
      tiles[centerIdx-1][centerIdx-1] = TileType.GEM_SPAWNER;
      // Also clear 3x3 around it
      clearArea(centerIdx-1, centerIdx-1, 2);
  } else if (mode === 'heist') {
      // Safes need to be accessible but defended
      // Player Safe (Top Left area)
      tiles[2][MAP_SIZE/2 - 1] = TileType.SAFE_PLAYER;
      clearArea(MAP_SIZE/2 - 1, 2, 1);
      
      // Enemy Safe (Bottom Right area)
      tiles[MAP_SIZE-3][MAP_SIZE/2 - 1] = TileType.SAFE_ENEMY;
      clearArea(MAP_SIZE/2 - 1, MAP_SIZE-3, 1);
  } else if (mode === 'duel') {
      // More open space in middle
      clearArea(centerIdx-1, centerIdx-1, 3);
      // Add a center obstacle
      tiles[centerIdx-1][centerIdx-1] = TileType.WATER;
  }

  // 6. Set Spawns
  // Player Team (Bottom)
  tiles[MAP_SIZE-2][2] = TileType.SPAWN_PLAYER;
  tiles[MAP_SIZE-2][MAP_SIZE-3] = TileType.SPAWN_PLAYER;
  
  // Enemy Team (Top)
  tiles[1][2] = TileType.SPAWN_ENEMY;
  tiles[1][MAP_SIZE-3] = TileType.SPAWN_ENEMY;

  // If Duel, move spawns closer? 
  if (mode === 'duel') {
      // Just one spawn needed effectively, but game loop handles arrays
  }

  return {
    width: MAP_SIZE,
    height: MAP_SIZE,
    tiles,
    themeName: 'Cyber Arena',
    description: mode.replace('_', ' ').toUpperCase()
  };
};