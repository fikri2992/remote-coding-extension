import { ref, onUnmounted } from 'vue'

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  // Additional options can be added here
}

export function useIntersectionObserver(
  callback: IntersectionObserverCallback,
  options: UseIntersectionObserverOptions = {}
) {
  const observer = ref<IntersectionObserver | null>(null)
  const isSupported = ref(typeof IntersectionObserver !== 'undefined')
  const targets = ref(new Set<Element>())

  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '0px',
    threshold: 0,
    ...options
  }

  // Create observer
  const createObserver = () => {
    if (!isSupported.value || observer.value) return

    observer.value = new IntersectionObserver(callback, defaultOptions)
  }

  // Observe an element
  const observe = (element: Element) => {
    if (!isSupported.value || !element) return

    if (!observer.value) {
      createObserver()
    }

    if (observer.value && !targets.value.has(element)) {
      observer.value.observe(element)
      targets.value.add(element)
    }
  }

  // Unobserve an element
  const unobserve = (element: Element) => {
    if (!observer.value || !element) return

    observer.value.unobserve(element)
    targets.value.delete(element)
  }

  // Unobserve all elements
  const unobserveAll = () => {
    if (!observer.value) return

    targets.value.forEach(element => {
      observer.value!.unobserve(element)
    })
    targets.value.clear()
  }

  // Disconnect observer
  const disconnect = () => {
    if (observer.value) {
      observer.value.disconnect()
      targets.value.clear()
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
    observer.value = null
  })

  return {
    observer,
    isSupported,
    targets,
    observe,
    unobserve,
    unobserveAll,
    disconnect
  }
}

// Specialized hook for progressive loading
export function useProgressiveLoading(
  onLoadMore: (direction: 'up' | 'down') => void,
  options: {
    rootMargin?: string
    threshold?: number
    debounceMs?: number
  } = {}
) {
  const {
    rootMargin = '200px',
    threshold = 0,
    debounceMs = 100
  } = options

  const isLoading = ref(false)
  const loadingTimeouts = ref(new Map<string, number>())

  const debouncedLoadMore = (direction: 'up' | 'down') => {
    const key = direction
    
    // Clear existing timeout
    if (loadingTimeouts.value.has(key)) {
      clearTimeout(loadingTimeouts.value.get(key))
    }

    // Set new timeout
    const timeoutId = window.setTimeout(() => {
      if (!isLoading.value) {
        isLoading.value = true
        onLoadMore(direction)
      }
      loadingTimeouts.value.delete(key)
    }, debounceMs)

    loadingTimeouts.value.set(key, timeoutId)
  }

  const topObserver = useIntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          debouncedLoadMore('up')
        }
      })
    },
    { rootMargin, threshold }
  )

  const bottomObserver = useIntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          debouncedLoadMore('down')
        }
      })
    },
    { rootMargin, threshold }
  )

  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const observeTop = (element: Element) => {
    topObserver.observe(element)
  }

  const observeBottom = (element: Element) => {
    bottomObserver.observe(element)
  }

  const unobserveTop = (element: Element) => {
    topObserver.unobserve(element)
  }

  const unobserveBottom = (element: Element) => {
    bottomObserver.unobserve(element)
  }

  const cleanup = () => {
    // Clear all timeouts
    loadingTimeouts.value.forEach(timeoutId => {
      clearTimeout(timeoutId)
    })
    loadingTimeouts.value.clear()

    // Disconnect observers
    topObserver.disconnect()
    bottomObserver.disconnect()
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    isLoading,
    setLoading,
    observeTop,
    observeBottom,
    unobserveTop,
    unobserveBottom,
    cleanup
  }
}