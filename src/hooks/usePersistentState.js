import { useEffect, useState } from "react";

export function usePersistentState(key, initialValue, normalize = (value) => value) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? normalize(JSON.parse(stored)) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local storage can be unavailable in privacy modes; the app still works for the session.
    }
  }, [key, value]);

  return [value, setValue];
}
