export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
export const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T00:00:00`);
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString("en-CA");
};
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
export const MISTAKES = [
  { id: "conceptual", label: "Conceptual gap", hint: "Didn't know the formula or method" },
  { id: "careless", label: "Careless calculation", hint: "Method right, arithmetic wrong" },
  { id: "misread", label: "Misread question", hint: "Missed a constraint or a word like “except”" },
  { id: "time_pressure", label: "Time pressure", hint: "Rushed" },
] as const;
export const CATEGORIES = [
  ["business", "Business & Economy"],
  ["editorial", "Editorials & Critical Arguments"],
  ["world", "World Affairs & Geopolitics"],
  ["science", "Science, Technology & Environment"],
  ["society", "Society, Culture & Ideas"],
] as const;
