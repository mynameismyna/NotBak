export type Direction = "up" | "down" | "left" | "right";

export type SnakeCell = {
  x: number;
  y: number;
};

export type SnakeGameState = {
  snake: SnakeCell[];
  food: SnakeCell | null;
  direction: Direction;
  score: number;
  isGameOver: boolean;
  hasWon: boolean;
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DIRECTION_VECTORS: Record<Direction, SnakeCell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function cellsMatch(first: SnakeCell, second: SnakeCell) {
  return first.x === second.x && first.y === second.y;
}

function isCellOccupied(cell: SnakeCell, snake: SnakeCell[]) {
  return snake.some((segment) => cellsMatch(segment, cell));
}

export function createFood(
  snake: SnakeCell[],
  columns: number,
  rows: number,
  random: () => number = Math.random,
): SnakeCell | null {
  const availableCells: SnakeCell[] = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const cell = { x, y };
      if (!isCellOccupied(cell, snake)) {
        availableCells.push(cell);
      }
    }
  }

  if (availableCells.length === 0) return null;

  return availableCells[Math.floor(random() * availableCells.length)];
}

export function createInitialSnakeGame(
  columns: number,
  rows: number,
  random: () => number = Math.random,
): SnakeGameState {
  const centerX = Math.floor(columns / 2);
  const centerY = Math.floor(rows / 2);
  const snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];

  return {
    snake,
    food: createFood(snake, columns, rows, random),
    direction: "right",
    score: 0,
    isGameOver: false,
    hasWon: false,
  };
}

export function changeDirection(current: Direction, next: Direction) {
  return OPPOSITE_DIRECTIONS[current] === next ? current : next;
}

export function moveSnake(
  game: SnakeGameState,
  columns: number,
  rows: number,
  random: () => number = Math.random,
): SnakeGameState {
  if (game.isGameOver || game.hasWon || !game.food) return game;

  const movement = DIRECTION_VECTORS[game.direction];
  const head = game.snake[0];
  const nextHead = { x: head.x + movement.x, y: head.y + movement.y };
  const hitsWall =
    nextHead.x < 0 || nextHead.x >= columns || nextHead.y < 0 || nextHead.y >= rows;
  const ateFood = cellsMatch(nextHead, game.food);
  const bodyToCheck = ateFood ? game.snake : game.snake.slice(0, -1);

  if (hitsWall || isCellOccupied(nextHead, bodyToCheck)) {
    return { ...game, isGameOver: true };
  }

  const snake = ateFood
    ? [nextHead, ...game.snake]
    : [nextHead, ...game.snake.slice(0, -1)];
  const food = ateFood ? createFood(snake, columns, rows, random) : game.food;

  return {
    ...game,
    snake,
    food,
    score: ateFood ? game.score + 1 : game.score,
    hasWon: ateFood && food === null,
  };
}
