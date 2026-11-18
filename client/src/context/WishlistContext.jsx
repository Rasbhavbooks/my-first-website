import { createContext, useContext, useEffect, useState } from "react";

const WishlistContext = createContext(null);
const STORAGE_KEY = "rasbhav-books-wishlist";

function readSavedIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [savedBookIds, setSavedBookIds] = useState(readSavedIds);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBookIds));
  }, [savedBookIds]);

  function toggleWishlist(bookId) {
    setSavedBookIds((current) => (
      current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId]
    ));
  }

  function removeFromWishlist(bookId) {
    setSavedBookIds((current) => current.filter((id) => id !== bookId));
  }

  return (
    <WishlistContext.Provider value={{ savedBookIds, toggleWishlist, removeFromWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider");
  return value;
}
