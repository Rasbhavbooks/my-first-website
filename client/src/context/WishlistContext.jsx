import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import {
  getReaderWishlist,
  removeReaderWishlistBook,
  saveReaderWishlistBook,
} from "../services/wishlistService.js";

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
  const { user, loading: authLoading } = useAuth();
  const [savedBookIds, setSavedBookIds] = useState(readSavedIds);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    setReady(false);
    setSyncError(false);

    if (!user) {
      setSavedBookIds(readSavedIds());
      setReady(true);
      return () => { cancelled = true; };
    }

    async function syncAccountWishlist() {
      const localIds = readSavedIds();
      try {
        const remoteIds = await getReaderWishlist();
        const merged = [...new Set([...remoteIds, ...localIds])];
        const guestIds = localIds.filter((id) => !remoteIds.includes(id));
        const savedResults = await Promise.all(guestIds.map(async (bookId) => {
          try {
            await saveReaderWishlistBook(bookId);
            return bookId;
          } catch {
            return null;
          }
        }));
        const synced = [...new Set([...remoteIds, ...savedResults.filter(Boolean)])];
        if (!cancelled) {
          setSavedBookIds(synced);
          window.localStorage.removeItem(STORAGE_KEY);
          setReady(true);
          if (synced.length < merged.length) setSyncError(true);
        }
      } catch {
        if (!cancelled) {
          setSavedBookIds(localIds);
          setSyncError(true);
          setReady(true);
        }
      }
    }

    syncAccountWishlist();
    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!ready || user) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBookIds));
  }, [savedBookIds, ready, user]);

  function toggleWishlist(bookId) {
    const isSaved = savedBookIds.includes(bookId);
    const nextIds = isSaved
      ? savedBookIds.filter((id) => id !== bookId)
      : [...savedBookIds, bookId];
    setSavedBookIds(nextIds);
    setSyncError(false);
    if (!user) return;

    const request = isSaved
      ? removeReaderWishlistBook(bookId)
      : saveReaderWishlistBook(bookId);
    request.catch(async () => {
      setSyncError(true);
      try {
        setSavedBookIds(await getReaderWishlist());
      } catch {
        // Keep the optimistic display and allow another attempt.
      }
    });
  }

  async function removeFromWishlist(bookId) {
    if (!savedBookIds.includes(bookId)) return;
    setSavedBookIds(savedBookIds.filter((id) => id !== bookId));
    setSyncError(false);
    if (!user) return;
    try {
      await removeReaderWishlistBook(bookId);
    } catch {
      setSyncError(true);
      try {
        setSavedBookIds(await getReaderWishlist());
      } catch {
        // Keep the current display and allow another attempt.
      }
    }
  }

  return (
    <WishlistContext.Provider value={{ savedBookIds, toggleWishlist, removeFromWishlist, syncError }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider");
  return value;
}
