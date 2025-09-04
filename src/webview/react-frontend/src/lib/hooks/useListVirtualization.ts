// Placeholder virtualization hook to swap with a real implementation later.
// Returns the same items for now.
export function useListVirtualization<T>(items: T[]) {
  return { visible: items }
}

