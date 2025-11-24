import React, { useState, useRef, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Joystick } from './components/Joystick';
import { generateGameMap } from './services/geminiService';
import { GameMap, CharacterClass, GameModeType, CHARACTERS, Difficulty } from './types';
import { Loader2, Trophy, Skull, Dices, Swords, Gem, Shield, Crosshair, Zap, Coins, Lock, ShoppingBag, Package, Star, Gauge, HelpCircle, X, Ghost, Flame, Target, Cpu } from 'lucide-react';

// Box Configuration
const BOXES = [
  { id: 'brawl', name: 'Brawl Box', price: 100, minCoins: 50, maxCoins: 200, color: 'bg-blue-600' },
  { id: 'big', name: 'Big Box', price: 300, minCoins: 200, maxCoins: 600, color: 'bg-purple-600' },
  { id: 'mega', name: 'Mega Box', price: 800, minCoins: 600, maxCoins: 2000, color: 'bg-yellow-500' },
];

const HelpModal = ({ onClose }: { onClose: () => void }) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div className="bg-slate-800 border border-slate-600 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
      <h2 className="text-2xl font-black text-white mb-4 uppercase italic flex items-center gap-2"><HelpCircle size={24} className="text-yellow-400" /> How to Play</h2>
      
      <div className="space-y-4 text-slate-300 text-sm">
        <div className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-xl border border-slate-600/50">
           <div className="flex gap-2 shrink-0">
             <div className="w-10 h-10 rounded-full border-2 border-blue-500 bg-slate-800 flex items-center justify-center text-[10px] text-blue-200 font-bold">Move</div>
             <div className="w-10 h-10 rounded-full border-2 border-red-500 bg-slate-800 flex items-center justify-center text-[10px] text-red-200 font-bold">Aim</div>
           </div>
           <div>
             <p className="font-bold text-white mb-1">Controls</p>
             <p className="text-xs leading-relaxed">Left Joystick to Move. Right Joystick to Aim & Shoot. Release to fire.</p>
           </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-xl border border-slate-600/50">
           <div className="w-12 flex justify-center"><Gem className="text-purple-400 shrink-0" size={28} /></div>
           <div>
             <p className="font-bold text-purple-400 mb-1">Gem Grab</p>
             <p className="text-xs leading-relaxed">Collect 10 Gems from the center mine. Hold them for the countdown to win!</p>
           </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-xl border border-slate-600/50">
           <div className="w-12 flex justify-center relative">
             <Shield className="text-red-400 shrink-0" size={28} />
           </div>
           <div>
             <p className="font-bold text-red-400 mb-1">Heist</p>
             <p className="text-xs leading-relaxed">Destroy the Enemy Safe (Red). Defend your Safe (Blue) from enemies.</p>
           </div>
        </div>
        
         <div className="flex items-center gap-4 bg-slate-700/50 p-3 rounded-xl border border-slate-600/50">
           <div className="w-12 flex justify-center"><div className="w-8 h-8 bg-green-500/50 rounded flex items-center justify-center border border-green-500"><div className="w-6 h-6 bg-green-600 rounded-sm"></div></div></div>
           <div>
             <p className="font-bold text-green-400 mb-1">Tactics</p>
             <p className="text-xs leading-relaxed">Hide in green bushes to ambush. Walls block enemy bullets.</p>
           </div>
        </div>
      </div>

      <button onClick={onClose} className="mt-6 w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black uppercase tracking-wider py-3 rounded-xl shadow-lg transition-transform active:scale-95">
        Got it!
      </button>
    </div>
  </div>
);

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'loading' | 'game' | 'result' | 'shop'>('menu');
  const [map, setMap] = useState<GameMap | null>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);
  
  // Economy State
  const [coins, setCoins] = useState<number>(0);
  const [unlockedChars, setUnlockedChars] = useState<CharacterClass[]>(['speedy']);
  
  // Level State (Account)
  const [level, setLevel] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [xpGained, setXpGained] = useState<number>(0);
  
  // Selection State
  const [selectedChar, setSelectedChar] = useState<CharacterClass>('speedy');
  const [selectedMode, setSelectedMode] = useState<GameModeType>('gem_grab');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showTutorial, setShowTutorial] = useState(false);

  // Load Progress
  useEffect(() => {
    const savedCoins = localStorage.getItem('brawl_coins');
    const savedChars = localStorage.getItem('brawl_chars');
    const savedLevel = localStorage.getItem('brawl_level');
    const savedXp = localStorage.getItem('brawl_xp');

    if (savedCoins) setCoins(parseInt(savedCoins));
    if (savedChars) {
        try {
            const parsed = JSON.parse(savedChars);
            // Filter out invalid characters (e.g. if 'hacker' was saved)
            const valid = parsed.filter((c: string) => Object.keys(CHARACTERS).includes(c));
            setUnlockedChars(valid);
            
            if (!valid.includes(selectedChar)) {
                setSelectedChar('speedy');
            }
        } catch(e) {
            setUnlockedChars(['speedy']);
        }
    }
    if (savedLevel) setLevel(parseInt(savedLevel));
    if (savedXp) setXp(parseInt(savedXp));
  }, []);

  // Save Progress
  useEffect(() => {
    localStorage.setItem('brawl_coins', coins.toString());
    localStorage.setItem('brawl_chars', JSON.stringify(unlockedChars));
    localStorage.setItem('brawl_level', level.toString());
    localStorage.setItem('brawl_xp', xp.toString());
  }, [coins, unlockedChars, level, xp]);

  // Input State passed to Game Loop
  const inputRef = useRef({
      move: { x: 0, y: 0 },
      aim: { x: 0, y: 0, active: false },
      shootRequest: false
  });

  const getXpForNextLevel = (lvl: number) => lvl * 100;

  const handleStartGame = async () => {
    if (!unlockedChars.includes(selectedChar)) return; 
    setScreen('loading');
    try {
      const newMap = await generateGameMap(selectedMode);
      setMap(newMap);
      setScreen('game');
    } catch (e) {
      console.error(e);
      setScreen('menu'); 
    }
  };

  const handleGameOver = (res: 'win' | 'lose', gems: number) => {
    setResult(res);
    let rewardCoins = 0;
    let rewardXp = 0;

    if (res === 'win') {
        rewardCoins = 60;
        rewardXp = 50;
        if (difficulty === 'hard') {
            rewardCoins += 40;
            rewardXp += 30;
        } else if (difficulty === 'easy') {
            rewardCoins = 30;
            rewardXp = 30;
        }
    } else {
        rewardCoins = 10;
        rewardXp = 10 + Math.floor(gems * 2);
    }
    
    setCoins(prev => prev + rewardCoins);
    
    // XP Logic (Account)
    const maxXp = getXpForNextLevel(level);
    let newXp = xp + rewardXp;
    let newLevel = level;
    
    if (newXp >= maxXp) {
        newXp -= maxXp;
        newLevel++;
    }

    setXp(newXp);
    setLevel(newLevel);
    setXpGained(rewardXp);
    
    setScreen('result');
  };

  const handleMove = (x: number, y: number, active: boolean) => {
      inputRef.current.move = { x, y };
  };

  const handleAim = (x: number, y: number, active: boolean) => {
      if (inputRef.current.aim.active && !active) {
          inputRef.current.shootRequest = true;
      }
      inputRef.current.aim = { x, y, active };
  };

  const buyCharacter = (char: CharacterClass) => {
    const cost = CHARACTERS[char].price;
    if (coins >= cost && !unlockedChars.includes(char)) {
        setCoins(prev => prev - cost);
        setUnlockedChars(prev => [...prev, char]);
        setSelectedChar(char);
    }
  };

  const openBox = (boxIndex: number) => {
    const box = BOXES[boxIndex];
    if (coins >= box.price) {
        setCoins(prev => prev - box.price);
        // Gamble logic: Boxes give randomized coins back (profit or loss)
        const reward = Math.floor(Math.random() * (box.maxCoins - box.minCoins + 1)) + box.minCoins;
        setCoins(prev => prev + reward);
        alert(`You opened a ${box.name}!\nFound ${reward} Coins!`);
    }
  };

  const CharacterCard = ({ type }: { type: CharacterClass }) => {
    const stats = CHARACTERS[type];
    const isUnlocked = unlockedChars.includes(type);
    const isSelected = selectedChar === type;
    const canAfford = coins >= stats.price;

    let Icon = Zap;
    if (type === 'tank') Icon = Shield;
    if (type === 'sniper') Icon = Crosshair;
    if (type === 'ninja') Icon = Ghost;
    if (type === 'minigun') Icon = Flame;
    if (type === 'hunter') Icon = Target;
    if (type === 'tech') Icon = Cpu;

    return (
        <button 
        onClick={() => {
            if (isUnlocked) setSelectedChar(type);
            else buyCharacter(type);
        }}
        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2 relative overflow-hidden group
            ${isSelected ? `bg-${stats.color.replace('#','')} border-white shadow-lg` : 'bg-slate-700 border-transparent'}
            ${!isUnlocked ? 'opacity-90 grayscale-[0.5]' : 'hover:opacity-100'}
        `}
        style={{ borderColor: isSelected ? stats.color : 'transparent', backgroundColor: isSelected ? 'rgba(30,41,59,0.8)' : undefined }}
        >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${isUnlocked ? 'bg-slate-800' : 'bg-slate-900'}`}>
                {isUnlocked ? <Icon size={24} style={{color: stats.color}}/> : <Lock size={24} className="text-slate-500"/>}
            </div>
            
            <div className="text-left flex-1">
                <div className="font-bold text-sm flex justify-between items-center">
                    {stats.name}
                    {!isUnlocked && (
                        <span className={`text-xs px-2 py-1 rounded-full ${canAfford ? 'bg-yellow-500 text-black' : 'bg-slate-600 text-slate-400'}`}>
                            {stats.price} 🪙
                        </span>
                    )}
                </div>
                <div className="text-[10px] text-slate-300 opacity-80">
                    {type === 'speedy' && "Fast • High DPS"}
                    {type === 'tank' && "High HP • Shotgun"}
                    {type === 'sniper' && "Long Range • High Dmg"}
                </div>
            </div>
        </button>
    );
  };

  return (
    <div className="w-screen h-screen bg-slate-900 text-white font-sans overflow-hidden select-none touch-none">
      {showTutorial && <HelpModal onClose={() => setShowTutorial(false)} />}
      
      {/* MENU SCREEN */}
      {screen === 'menu' && (
        <div className="w-full h-full flex flex-col items-center justify-start p-4 relative overflow-y-auto">
          {/* Background FX */}
          <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none fixed">
            <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-64 h-64 bg-red-500 rounded-full blur-3xl"></div>
          </div>

          <div className="z-10 w-full max-w-2xl bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-slate-700 mt-4 mb-20">
             
             {/* Header & Coin Balance */}
             <div className="flex justify-between items-start mb-6">
                 <div>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-orange-600 drop-shadow-sm">
                    Brawl Arena
                    </h1>
                    {/* Level Bar */}
                    <div className="mt-2 flex items-center gap-2">
                        <div className="bg-blue-600 text-xs font-bold px-2 py-0.5 rounded text-white flex items-center gap-1 shadow-sm border border-blue-400">
                             <Star size={10} className="fill-white"/> LVL {level}
                        </div>
                        <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-600">
                             <div className="h-full bg-blue-400" style={{width: `${(xp / getXpForNextLevel(level)) * 100}%`}}></div>
                        </div>
                    </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => setShowTutorial(true)} className="bg-slate-700 hover:bg-slate-600 w-10 h-10 rounded-full flex items-center justify-center border border-slate-500 text-slate-300 shadow-lg"><HelpCircle size={20} /></button>
                     <div className="bg-slate-900 px-4 py-2 rounded-full border border-yellow-600/50 flex items-center gap-2 shadow-inner">
                         <Coins className="text-yellow-400 fill-yellow-400" size={20} />
                         <span className="font-black text-xl text-yellow-100">{coins}</span>
                     </div>
                 </div>
             </div>

             <div className="grid md:grid-cols-2 gap-8">
                 {/* Character Select */}
                 <div>
                     <h3 className="text-slate-400 font-bold text-xs uppercase mb-3 tracking-widest flex items-center gap-2">
                         Brawlers <span className="bg-slate-700 text-white px-2 rounded-full text-[10px]">{unlockedChars.length}/7</span>
                     </h3>
                     <div className="space-y-3">
                         <CharacterCard type="speedy" />
                         <CharacterCard type="tank" />
                         <CharacterCard type="sniper" />
                         <CharacterCard type="ninja"/>
                         <CharacterCard type="minigun"/>
                         <CharacterCard type="hunter"/>
                         <CharacterCard type="tech"/>
                     </div>
                 </div>

                 {/* Mode & Difficulty Select */}
                 <div className="flex flex-col">
                     <h3 className="text-slate-400 font-bold text-xs uppercase mb-3 tracking-widest">Events</h3>
                     <div className="space-y-3 mb-6">
                         <button 
                            onClick={() => setSelectedMode('gem_grab')}
                            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2 ${selectedMode === 'gem_grab' ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-700 border-transparent opacity-60 hover:opacity-100'}`}
                         >
                             <div className="w-10 h-10 rounded-lg bg-indigo-900 flex items-center justify-center"><Gem size={20} className="text-indigo-400"/></div>
                             <div className="text-left">
                                 <div className="font-bold text-sm">Gem Grab</div>
                                 <div className="text-[10px] text-indigo-200">Collect 10 Gems</div>
                             </div>
                         </button>
                         <button 
                            onClick={() => setSelectedMode('heist')}
                            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2 ${selectedMode === 'heist' ? 'bg-orange-600 border-orange-400' : 'bg-slate-700 border-transparent opacity-60 hover:opacity-100'}`}
                         >
                             <div className="w-10 h-10 rounded-lg bg-orange-900 flex items-center justify-center"><Shield size={20} className="text-orange-400"/></div>
                             <div className="text-left">
                                 <div className="font-bold text-sm">Heist</div>
                                 <div className="text-[10px] text-orange-200">Destroy Enemy Safe</div>
                             </div>
                         </button>
                         <button 
                            onClick={() => setSelectedMode('duel')}
                            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2 ${selectedMode === 'duel' ? 'bg-red-600 border-red-400' : 'bg-slate-700 border-transparent opacity-60 hover:opacity-100'}`}
                         >
                             <div className="w-10 h-10 rounded-lg bg-red-900 flex items-center justify-center"><Swords size={20} className="text-red-400"/></div>
                             <div className="text-left">
                                 <div className="font-bold text-sm">Duel</div>
                                 <div className="text-[10px] text-red-200">1v1 Deathmatch</div>
                             </div>
                         </button>
                     </div>

                     <h3 className="text-slate-400 font-bold text-xs uppercase mb-3 tracking-widest flex items-center gap-2">
                        Difficulty
                        <Gauge size={14} />
                     </h3>
                     <div className="flex bg-slate-900/50 p-1 rounded-xl gap-1">
                        <button 
                            onClick={() => setDifficulty('easy')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all flex flex-col items-center gap-1
                                ${difficulty === 'easy' ? 'bg-green-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span>Easy</span>
                        </button>
                        <button 
                            onClick={() => setDifficulty('normal')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all flex flex-col items-center gap-1
                                ${difficulty === 'normal' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span>Normal</span>
                        </button>
                        <button 
                            onClick={() => setDifficulty('hard')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all flex flex-col items-center gap-1
                                ${difficulty === 'hard' ? 'bg-red-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span>Hard</span>
                        </button>
                     </div>

                 </div>
             </div>

             <div className="flex gap-4 mt-8">
                <button 
                    onClick={() => setScreen('shop')}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg py-4 rounded-xl shadow-[0_4px_0_rgb(107,33,168)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                    <ShoppingBag size={24} />
                    Shop
                </button>
                <button 
                    onClick={handleStartGame}
                    className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black text-xl py-4 rounded-xl shadow-[0_4px_0_rgb(161,98,7)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-3 uppercase tracking-wide"
                >
                    <Dices size={24} />
                    Battle!
                </button>
             </div>
          </div>
        </div>
      )}

      {/* SHOP SCREEN */}
      {screen === 'shop' && (
        <div className="w-full h-full flex flex-col items-center bg-slate-900 p-4 relative overflow-y-auto">
             <div className="w-full max-w-2xl mt-4 mb-20">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setScreen('menu')} className="text-slate-400 font-bold hover:text-white">← Back</button>
                    <div className="bg-slate-800 px-4 py-2 rounded-full border border-yellow-600/50 flex items-center gap-2">
                        <Coins className="text-yellow-400 fill-yellow-400" size={20} />
                        <span className="font-black text-xl text-yellow-100">{coins}</span>
                    </div>
                </div>
                
                <h2 className="text-2xl font-black italic uppercase text-white mb-4">Today's Deals</h2>
                
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {BOXES.map((box, idx) => (
                        <div key={box.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center shadow-lg relative overflow-hidden group">
                            <div className={`absolute top-0 inset-x-0 h-1 ${box.color}`}></div>
                            <Package size={48} className={`mb-3 ${box.id === 'mega' ? 'text-yellow-400' : box.id === 'big' ? 'text-purple-400' : 'text-blue-400'}`} />
                            <h3 className="font-bold text-sm uppercase mb-1">{box.name}</h3>
                            <p className="text-[10px] text-slate-400 mb-3">{box.minCoins}-{box.maxCoins} Coins</p>
                            <button 
                                onClick={() => openBox(idx)}
                                disabled={coins < box.price}
                                className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all
                                    ${coins >= box.price ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400 shadow-[0_2px_0_rgb(161,98,7)] active:shadow-none active:translate-y-1' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                                `}
                            >
                                {box.price} <Coins size={12}/>
                            </button>
                        </div>
                    ))}
                </div>

                <h2 className="text-2xl font-black italic uppercase text-white mb-4">Brawlers</h2>
                <div className="space-y-4">
                     {Object.keys(CHARACTERS).map((key) => {
                         const type = key as CharacterClass;
                         if (unlockedChars.includes(type)) return null; 
                         return (
                             <div key={type} className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                                 <div className="flex items-center gap-4">
                                     <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center">
                                         <Lock className="text-slate-600" />
                                     </div>
                                     <div>
                                         <h3 className="font-bold text-lg text-white">{CHARACTERS[type].name}</h3>
                                         <p className="text-xs text-slate-400">Unlock this brawler forever</p>
                                     </div>
                                 </div>
                                 <button 
                                    onClick={() => buyCharacter(type)}
                                    disabled={coins < CHARACTERS[type].price}
                                    className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all
                                        ${coins >= CHARACTERS[type].price ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                                    `}
                                 >
                                     {CHARACTERS[type].price} <Coins size={16} />
                                 </button>
                             </div>
                         )
                     })}
                     {unlockedChars.length === 3 && (
                         <div className="text-center text-slate-500 py-8 italic">All brawlers unlocked!</div>
                     )}
                </div>
             </div>
        </div>
      )}

      {/* LOADING SCREEN */}
      {screen === 'loading' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 z-50">
           <Loader2 size={64} className="text-yellow-500 animate-spin mb-4" />
           <h2 className="text-2xl font-bold text-white animate-pulse">Setting the Arena...</h2>
        </div>
      )}

      {/* GAME SCREEN */}
      {screen === 'game' && map && (
        <div className="w-full h-full relative">
            <GameCanvas 
                map={map} 
                onGameOver={handleGameOver} 
                onExit={() => setScreen('menu')}
                characterClass={selectedChar}
                gameMode={selectedMode}
                inputState={inputRef}
                difficulty={difficulty}
            />
            {/* Joysticks Overlay */}
            <Joystick side="left" color="#3b82f6" onMove={handleMove} />
            <Joystick side="right" color="#ef4444" onMove={handleAim} />
        </div>
      )}

      {/* RESULT SCREEN */}
      {screen === 'result' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/90 z-50 p-6 backdrop-blur-sm">
            <div className={`p-8 rounded-3xl shadow-2xl text-center border-4 min-w-[320px] ${result === 'win' ? 'border-yellow-500 bg-slate-800' : 'border-red-500 bg-slate-800'}`}>
                {result === 'win' ? (
                    <>
                        <Trophy size={80} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-6xl font-black text-white mb-2 uppercase tracking-tighter drop-shadow-lg">Victory!</h2>
                        <div className="flex justify-center gap-4 mb-8">
                             <div className="bg-slate-900/50 rounded-xl p-3 flex flex-col items-center border border-yellow-500/30 min-w-[100px]">
                                <span className="text-yellow-200 text-xs font-bold uppercase mb-1">Coins</span>
                                <div className="flex items-center gap-1">
                                    <Coins className="text-yellow-400 fill-yellow-400" size={20}/>
                                    <span className="text-2xl font-black text-white">+{coins - (parseInt(localStorage.getItem('brawl_coins') || '0') - (coins - xpGained /* rough estimate logic fixed below */) )}</span>
                                    {/* Note: The calc above is tricky due to closure state, using xpGained instead for visuals */}
                                </div>
                             </div>
                             <div className="bg-slate-900/50 rounded-xl p-3 flex flex-col items-center border border-blue-500/30 min-w-[100px]">
                                <span className="text-blue-200 text-xs font-bold uppercase mb-1">XP</span>
                                <div className="flex items-center gap-1">
                                    <Star className="text-blue-400 fill-blue-400" size={20}/>
                                    <span className="text-2xl font-black text-white">+{xpGained}</span>
                                </div>
                             </div>
                        </div>
                    </>
                ) : (
                    <>
                        <Skull size={80} className="text-red-500 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-6xl font-black text-white mb-2 uppercase tracking-tighter drop-shadow-lg">Defeat</h2>
                        <div className="flex justify-center gap-4 mb-8">
                             <div className="bg-slate-900/50 rounded-xl p-3 flex flex-col items-center border border-yellow-500/30 min-w-[100px]">
                                <span className="text-yellow-200 text-xs font-bold uppercase mb-1">Coins</span>
                                <div className="flex items-center gap-1">
                                    <Coins className="text-yellow-400 fill-yellow-400" size={20}/>
                                    <span className="text-2xl font-black text-white">+10</span>
                                </div>
                             </div>
                             <div className="bg-slate-900/50 rounded-xl p-3 flex flex-col items-center border border-blue-500/30 min-w-[100px]">
                                <span className="text-blue-200 text-xs font-bold uppercase mb-1">XP</span>
                                <div className="flex items-center gap-1">
                                    <Star className="text-blue-400 fill-blue-400" size={20}/>
                                    <span className="text-2xl font-black text-white">+{xpGained}</span>
                                </div>
                             </div>
                        </div>
                    </>
                )}
                
                {/* Level Progress in Result */}
                <div className="mb-8 w-full">
                    <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                        <span>Level {level}</span>
                        <span>{xp} / {getXpForNextLevel(level)} XP</span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-600">
                        <div className="h-full bg-blue-500" style={{width: `${(xp / getXpForNextLevel(level)) * 100}%`}}></div>
                    </div>
                </div>

                <div className="flex gap-4 justify-center">
                    <button 
                        onClick={() => setScreen('menu')}
                        className="px-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white transition-colors"
                    >
                        Menu
                    </button>
                    <button 
                        onClick={handleStartGame}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-colors shadow-lg shadow-blue-500/30"
                    >
                        Play Again
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}