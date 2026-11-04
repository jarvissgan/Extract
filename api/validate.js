import { describeError, userCategories } from "../shared/schemas.js";

// Wraps an async route so rejected promises reach the error handler (Express 4 doesn't do this).
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Parses `data` with a zod schema; sends 400 and returns null if it's invalid.
export const parseOr400 = (schema, data, res) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({ error: describeError(result.error) });
    return null;
  }
  return result.data;
};

// Checks that a category exists for this user (built-in or one of their custom ones).
export const checkCategory = (category, currentUser, res) => {
  const ok = userCategories(currentUser.preferences).some((c) => c.value === category);
  if (!ok) res.status(400).json({ error: `Unknown category "${category}".` });
  return ok;
};
