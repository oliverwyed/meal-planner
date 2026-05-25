export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type DayMode = 'home' | 'off';
export type KidsMode = 'kids' | 'adults' | 'either';
export type DietaryMode = 'none' | 'noFish' | 'noPork' | 'noRed' | 'veggie';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Protein = 'chicken' | 'beef' | 'fish' | 'pork' | 'lamb' | 'seafood' | 'eggs' | 'veggie';
export type Cuisine = 'british' | 'italian' | 'french' | 'asian' | 'mexican' | 'indian' | 'american' | 'middleeastern' | 'other';
export type Carb = 'none' | 'pasta' | 'rice' | 'potato' | 'bread' | 'noodles';
export type Course = 'main' | 'starter' | 'side' | 'dessert';

export interface Meal {
  id?: string;                  // uuid for custom/imported meals
  name: string;
  course?: Course;              // defaults to 'main' when absent
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
  photo?: string;                // hero image (first of photos, kept for compat)
  photos?: string[];             // all uploaded photos
  sourceUrl?: string;           // set when imported from a URL
  custom?: boolean;
}

export interface PlanMeal extends Meal {
  day: DayName;
}

export interface Plan {
  meals: PlanMeal[];
  generatedAt: number;
  shopChecked?: Record<string, boolean>; // persisted alongside plan in DB
}

export interface PlanHistoryEntry {
  plan: Plan;
  dayOverrides: DayOverrides;
  savedAt: number;
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
  nextWeekPlan: Plan | null;
  planHistory: PlanHistoryEntry[];
  dayConfig: DayConfig;
  kidsConfig: KidsConfig;
  dayOverrides: DayOverrides;
  familySize: number;
  preferences: Preferences;
  cookHistory: CookHistoryEntry[];
  customMeals: Meal[];
  shopChecked: Record<string, boolean>;
  events: DinnerEvent[];
  updatedAt?: number;
}

export interface CommunityMeal extends Meal {
  communityId: string;
  sourceHouseholdId?: string;
  publishedAt: number;
}

export interface RecipeReview {
  id: string;
  recipeName: string;
  stars: number;
  comment?: string;
  createdAt: number;
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

export type EventCategory = 'starter' | 'main' | 'side' | 'dessert' | 'drinks' | 'other';

export interface EventDish {
  meal: Meal;
  servings: number;
  category: EventCategory;
}

export interface ScheduleBlock {
  startTime: string;
  endTime: string;
  mealName: string;
  action: string;
  note?: string | null;
  detail?: string;             // 1-3 sentence expansion of exactly what to do now
  blockIngredients?: string[]; // ingredient names (no quantities) needed for this block
}

export interface DinnerEvent {
  id: string;
  name: string;
  date?: string;
  serveTime: string;
  guestCount: number;
  dishes: EventDish[];
  schedule?: ScheduleBlock[];
  scheduleGeneratedAt?: number;
}
