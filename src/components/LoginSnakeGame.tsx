"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cellsMatch,
  changeDirection,
  createInitialSnakeGame,
  type Direction,
  moveSnake,
} from "@/lib/snake-game";

const COLUMNS = 12;
const ROWS = 8;
const TICK_INTERVAL = 180;
const MAX_QUEUED_DIRECTIONS = 2;

// Sunucu ve istemci aynı ilk yemi üretsin diye sabit değer; gerçek rastgelelik mount sonrası devreye girer.
const SSR_FOOD_SEED = 0.5;

const keyboardDirections: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${
      isOpen ? "rotate-180" : ""
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function LoginSnakeGame() {
  const boardRef = useRef<HTMLDivElement>(null);
  const directionQueueRef = useRef<Direction[]>([]);
  const [game, setGame] = useState(() =>
    createInitialSnakeGame(COLUMNS, ROWS, () => SSR_FOOD_SEED),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    setGame(createInitialSnakeGame(COLUMNS, ROWS));
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      const requested = directionQueueRef.current.shift();

      setGame((currentGame) => {
        const aimedGame = requested
          ? { ...currentGame, direction: changeDirection(currentGame.direction, requested) }
          : currentGame;

        return moveSnake(aimedGame, COLUMNS, ROWS);
      });
    }, TICK_INTERVAL);

    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (game.isGameOver || game.hasWon) {
      setIsPlaying(false);
      directionQueueRef.current = [];
    }
  }, [game.hasWon, game.isGameOver]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setIsPlaying(false);
    };

    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  useEffect(() => {
    if (isOpen) {
      boardRef.current?.focus();
      return;
    }

    setIsPlaying(false);
    directionQueueRef.current = [];
  }, [isOpen]);

  const restartGame = useCallback(() => {
    directionQueueRef.current = [];
    setGame(createInitialSnakeGame(COLUMNS, ROWS));
    setIsPlaying(true);
    boardRef.current?.focus();
  }, []);

  const toggleGame = useCallback(() => {
    const currentGame = gameRef.current;

    if (currentGame.isGameOver || currentGame.hasWon) {
      restartGame();
      return;
    }

    setIsPlaying((playing) => !playing);
    boardRef.current?.focus();
  }, [restartGame]);

  const steer = useCallback(
    (direction: Direction) => {
      const currentGame = gameRef.current;

      if (currentGame.isGameOver || currentGame.hasWon) {
        restartGame();
        return;
      }

      // Aynı tur içinde birden çok tuşa basıldığında yılanın kendi üstüne dönmemesi için sıraya alınır.
      if (directionQueueRef.current.length < MAX_QUEUED_DIRECTIONS) {
        directionQueueRef.current.push(direction);
      }

      setIsPlaying(true);
    },
    [restartGame],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const direction = keyboardDirections[event.key];
      if (direction) {
        event.preventDefault();
        steer(direction);
        return;
      }

      const isToggleKey = event.key === " " || event.key === "Enter";
      if (isToggleKey && document.activeElement === boardRef.current) {
        event.preventDefault();
        toggleGame();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, steer, toggleGame]);

  const status = game.hasWon
    ? "Kazandınız! Tahtadaki tüm hücreleri doldurdunuz."
    : game.isGameOver
      ? `Oyun bitti. Skorunuz ${game.score}.`
      : isPlaying
        ? `Oyun sürüyor. Skor ${game.score}.`
        : `Oyun duraklatıldı. Skor ${game.score}.`;

  return (
    <section className="mb-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="snake-game-panel"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition hover:text-[#4682B4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4682B4]/40"
        >
          Günün Oyunu
          <ChevronIcon isOpen={isOpen} />
        </button>
      </div>

      <div
        id="snake-game-panel"
        className={`overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "visible mt-2 max-h-[28rem] opacity-100" : "invisible max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-gray-200/70 bg-white/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">Ok tuşlarına basınca oyun başlar.</p>
            <span className="text-xs font-medium text-gray-400">Skor {game.score}</span>
          </div>

          <div
            ref={boardRef}
            role="application"
            tabIndex={0}
            aria-label="Mini Snake oyun alanı. Hareket için ok tuşlarını, duraklatmak için Boşluk tuşunu kullanın."
            aria-describedby="snake-game-status"
            className="grid w-full rounded-lg border border-gray-200 bg-white p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[#4682B4]/40"
            style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: COLUMNS * ROWS }, (_, index) => {
              const cell = { x: index % COLUMNS, y: Math.floor(index / COLUMNS) };
              const isSnake = game.snake.some((segment) => cellsMatch(segment, cell));
              const isHead = cellsMatch(game.snake[0], cell);
              const isFood = game.food !== null && cellsMatch(game.food, cell);

              return (
                <span
                  key={`${cell.x}-${cell.y}`}
                  aria-hidden="true"
                  className={`aspect-square rounded-[2px] border border-gray-100 ${
                    isHead
                      ? "bg-[#6f9ec4]"
                      : isSnake
                        ? "bg-[#9dbfd9]"
                        : isFood
                          ? "bg-[#e8a9a9]"
                          : "bg-gray-50"
                  }`}
                />
              );
            })}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={toggleGame}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-[#4682B4]/30 hover:text-[#4682B4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4682B4]/40"
            >
              {game.isGameOver || game.hasWon ? "Yeniden Başlat" : isPlaying ? "Duraklat" : "Başlat"}
            </button>
          </div>

          <p id="snake-game-status" className="sr-only" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
