export interface DrawingPrompt {
  id: string;
  idea: string;
}

export const DAILY_DRAWING_PROMPTS = [
  { id: "moon-shop", idea: "Draw a moon running a tiny corner shop." },
  { id: "ocean-plant", idea: "Draw a houseplant dreaming of the ocean." },
  { id: "monster-bus", idea: "Draw a friendly monster waiting for the bus." },
  { id: "turtle-city", idea: "Draw a tiny city balanced on a turtle." },
  { id: "cloud-backpack", idea: "Draw a cloud carrying a backpack." },
  { id: "robot-garden", idea: "Draw a robot learning to garden." },
  { id: "fish-library", idea: "Draw a fish exploring a library." },
  { id: "teacup-lighthouse", idea: "Draw a lighthouse inside a teacup." },
  { id: "sneaker-weather", idea: "Draw a sneaker with its own weather." },
  {
    id: "breakfast-dragon",
    idea: "Draw a sleepy dragon guarding breakfast.",
  },
  { id: "impossible-room", idea: "Draw a doorway to an impossible room." },
  { id: "moon-bicycle", idea: "Draw a bicycle built for the moon." },
  { id: "cat-mayor", idea: "Draw a cat as the mayor of a tiny town." },
  { id: "mountain-hat", idea: "Draw a mountain wearing a winter hat." },
  {
    id: "flower-station",
    idea: "Draw a space station shaped like a flower.",
  },
  { id: "sound-creature", idea: "Draw your favorite sound as a creature." },
  {
    id: "rainy-invention",
    idea: "Draw a small invention for a rainy day.",
  },
  { id: "imaginary-map", idea: "Draw a map to a place that does not exist." },
  {
    id: "shape-animal",
    idea: "Draw an animal made from three simple shapes.",
  },
  {
    id: "planet-market",
    idea: "Draw a night market on another planet.",
  },
  { id: "sky-boat", idea: "Draw a boat sailing through the sky." },
] as const satisfies readonly DrawingPrompt[];

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

function dayNumberFromDateKey(dateKey: string): number {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) {
    throw new TypeError("dateKey must use the YYYY-MM-DD format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcTimestamp = Date.UTC(year, month - 1, day);
  const parsedDate = new Date(utcTimestamp);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new RangeError("dateKey must represent a real calendar date");
  }

  return Math.floor(utcTimestamp / MILLISECONDS_PER_DAY);
}

/** Returns a local calendar date without locale-dependent formatting. */
export function getLocalDateKey(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("date must be valid");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Selects one stable idea for a calendar day and advances on the next day. */
export function getDailyDrawingPrompt(dateKey: string): DrawingPrompt {
  const dayNumber = dayNumberFromDateKey(dateKey);
  return DAILY_DRAWING_PROMPTS[dayNumber % DAILY_DRAWING_PROMPTS.length];
}
