export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type DayMode = 'home' | 'gousto' | 'off';
export type KidsMode = 'kids' | 'adults' | 'either';
export type DietaryMode = 'none' | 'noFish' | 'noPork' | 'noRed' | 'veggie';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Protein = 'chicken' | 'beef' | 'fish' | 'pork' | 'lamb' | 'seafood' | 'eggs' | 'veggie';
export type Cuisine = 'british' | 'italian' | 'asian' | 'mexican' | 'indian' | 'american' | 'middleeastern' | 'other';
export type Carb = 'none' | 'pasta' | 'rice' | 'potato' | 'bread' | 'noodles';

export interface Meal {
  id?: string;                  // uuid for custom/imported meals
  name: string;
  time: string;                 // display string e.g. "20 min"
  minutes: number;
  protein: Protein;
  cuisine: Cuisine;
  carb: Carb;
  serves: number;
  adult?: boolean;
  seasons?: Season[];
  description: string;
  ingredients: string[];
  steps: string[];
  kidNote?: string;
  tip?: string;
  nutrition?: { calories: number; protein: number; carbs: number; fat: number };
  sourceUrl?: string;           // set when imported from a URL
  custom?: boolean;
}

export interface PlanMeal extends Meal {
  day: DayName;
}

export interface Plan {
  meals: PlanMeal[];
  generatedAt: number;
}

export interface DayConfig {
  [day: string]: DayMode;
}

export interface KidsConfig {
  [day: string]: KidsMode;
}

export interface DayOverrides {
  [day: string]: {
    size?: number;
    time?: string;
  };
}

export interface Preferences {
  favourites: string[];
  dislikes: string[];
  pantry: string;
  dietaryMode: DietaryMode;
  timeFilter: string;
}

export interface CookHistoryEntry {
  name: string;
  date: number;
}

export interface HouseholdState {
  plan: Plan | null;
  dayConfig: DayConfig;
  kidsConfig: KidsConfig;
  dayOverrides: DayOverrides;
  familySize: number;
  preferences: Preferences;
  cookHistory: CookHistoryEntry[];
  customMeals: Meal[];
  updatedAt?: number;
}

export interface ScaledIngredient {
  qty: string;
  label: string;
  display: string;
}

export type ShopList = Record<string, ScaledIngredient[]>;

export interface SmartPickOpts {
  history?: CookHistoryEntry[];
  favourites?: string[];
  dislikes?: string[];
  preferAdult?: boolean;
}
