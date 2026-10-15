"use client";

import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";
import { cartLineToTrackedItem } from "@/lib/tr/tracking/items";
import { trackEvent } from "@/lib/tr/tracking/runtime";
import { sameCartLine, type TrCartLineItem } from "@/types/tr-cart";

interface TrBoutiqueLocalCartStore {
  items: TrCartLineItem[];
  addItem: (item: TrCartLineItem) => boolean;
  removeItem: (productId: string, size?: string | null, variantId?: string | null) => void;
  clearCart: () => void;
  setItems: (items: TrCartLineItem[]) => void;
  hasItem: (productId: string, size?: string | null) => boolean;
}

type CartStore = UseBoundStore<StoreApi<TrBoutiqueLocalCartStore>> & {
  persist?: {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
  };
};

const storeCache = new Map<string, CartStore>();

function cartApi(set: (partial: { items: TrCartLineItem[] }) => void, get: () => TrBoutiqueLocalCartStore) {
  return {
    items: [] as TrCartLineItem[],
    addItem: (item: TrCartLineItem) => {
      if (get().items.some((entry) => sameCartLine(entry, item))) {
        return false;
      }
      set({ items: [...get().items, item] });
      trackEvent({ type: "add_to_cart", item: cartLineToTrackedItem(item) });
      return true;
    },
    removeItem: (productId: string, size?: string | null, variantId?: string | null) => {
      set({
        items: get().items.filter((entry) => {
          if (size === undefined && !variantId) {
            return entry.productId !== productId;
          }
          return !sameCartLine(entry, { productId, size: size ?? null, variantId });
        }),
      });
    },
    clearCart: () => set({ items: [] }),
    setItems: (items: TrCartLineItem[]) => set({ items }),
    hasItem: (productId: string, size?: string | null) =>
      get().items.some((entry) => {
        if (size === undefined) {
          return entry.productId === productId;
        }
        return sameCartLine(entry, { productId, size });
      }),
  };
}

function createBoutiqueLocalCartStore(
  boutiqueSlug: string,
  persistEnabled: boolean,
): CartStore {
  if (!persistEnabled) {
    return create<TrBoutiqueLocalCartStore>()((set, get) =>
      cartApi(set, get),
    ) as CartStore;
  }

  return create<TrBoutiqueLocalCartStore>()(
    persist(
      (set, get) => cartApi(set, get),
      {
        name: `cortis-tr-cart:boutique:${boutiqueSlug}`,
        partialize: (state) => ({ items: state.items }),
      },
    ),
  ) as CartStore;
}

/** Per-boutique cart — separate from marketplace multi-tenant cart. */
export function getTrBoutiqueLocalCartStore(boutiqueSlug: string): CartStore {
  const slug = boutiqueSlug.trim();
  const persistEnabled = !slug.startsWith("__");
  const cacheKey = `${slug}:${persistEnabled ? "p" : "m"}`;
  let store = storeCache.get(cacheKey);
  if (!store) {
    store = createBoutiqueLocalCartStore(slug, persistEnabled);
    storeCache.set(cacheKey, store);
  }
  return store;
}

export function selectBoutiqueCartItemCount(
  state: TrBoutiqueLocalCartStore,
): number {
  return state.items.length;
}
