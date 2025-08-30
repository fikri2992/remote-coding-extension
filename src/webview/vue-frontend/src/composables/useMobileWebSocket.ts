import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useWebSocket } from './useWebSocket'
import type {
    WebSocketMessage,
    MobileGestureMessage,
    MobileLayoutMessage,
    MobilePreviewMessage,
    MobileHapticMessage,
    MobileSyncMessage,
    MobileConnectionState,
    WebSocketConfig
} from '../types/websocket'
import type { GestureEvent, GestureType } from '../types/gestures'
import {
    MOBILE_WS_RETRY_BASE_DELAY,
    MOBILE_WS_MAX_RETRY_DELAY,
    MOBILE_WS_CONNECTION_QUALITY_CHECK_INTERVAL,
    MOBILE_WS_BANDWIDTH_THRESHOLD,
    MOBILE_WS_RTT_THRESHOLD,
    MOBILE_WS_GESTURE_DEBOUNCE,
    MOBILE_WS_LAYOUT_SYNC_DEBOUNCE,
    MOBILE_WS_PRIORITY_QUEUE_SIZE,
    MOBILE_WS_LOW_BANDWIDTH_QUEUE_SIZE,
    MOBILE_WS_HAPTIC_COOLDOWN
} from '../utils/constants'

export interface MobileWebSocketComposable {
    // Base WebSocket functionality
    webSocket: ReturnType<typeof useWebSocket>

    // Mobile state
    mobileState: MobileConnectionState
    isLowBandwidth: boolean
    adaptiveRetryDelay: number

    // Mobile methods
    sendGestureEvent: (gestureEvent: GestureEvent, target: string, metadata?: Record<string, any>) => Promise<void>
    sendLayoutUpdate: (layoutData: any) => Promise<void>
    sendPreviewAction: (path: string, action: string, metadata?: any) => Promise<void>
    sendHapticFeedback: (type: string, trigger: string, pattern?: number[]) => Promise<void>
    syncMobileState: (syncType: string, payload: any) => Promise<void>

    // Connection quality management
    updateConnectionQuality: () => void
    enableBandwidthAwareMode: () => void
    disableBandwidthAwareMode: () => void

    // Mobile-specific configuration
    updateMobileConfig: (config: Partial<WebSocketConfig['mobile']>) => void
}

export function useMobileWebSocket(baseConfig?: Partial<WebSocketConfig>): MobileWebSocketComposable {
    // Initialize base WebSocket with mobile-enhanced config
    const defaultMobileConfig: WebSocketConfig['mobile'] = {
        bandwidthAware: true,
        adaptiveRetry: true,
        gestureReporting: true,
        layoutSync: true,
        hapticFeedback: true,
        connectionQualityThreshold: MOBILE_WS_BANDWIDTH_THRESHOLD,
        maxRetryBackoff: MOBILE_WS_MAX_RETRY_DELAY,
        priorityMessageTypes: ['mobile_haptic', 'mobile_gesture', 'ping', 'pong']
    }

    const mobileConfig = reactive({
        ...defaultMobileConfig,
        ...baseConfig?.mobile
    })

    const webSocket = useWebSocket({
        ...baseConfig,
        mobile: mobileConfig
    })

    // Mobile connection state
    const mobileState = reactive<MobileConnectionState>({
        isMobile: false,
        connectionQuality: 'good',
        bandwidth: {},
        networkType: 'unknown'
    })

    // Adaptive retry state
    const adaptiveRetryDelay = ref(MOBILE_WS_RETRY_BASE_DELAY)
    const lastGestureTime = ref(0)
    const lastLayoutSyncTime = ref(0)
    const lastHapticTime = ref(0)

    // Priority message queue for mobile
    const priorityQueue = ref<WebSocketMessage[]>([])
    const bandwidthAwareQueue = ref<WebSocketMessage[]>([])

    // Computed properties
    const isLowBandwidth = computed(() => {
        const { bandwidth } = mobileState
        return (
            mobileState.connectionQuality === 'poor' ||
            (bandwidth.downlink && bandwidth.downlink < mobileConfig.connectionQualityThreshold) ||
            (bandwidth.rtt && bandwidth.rtt > MOBILE_WS_RTT_THRESHOLD) ||
            bandwidth.effectiveType === '2g' ||
            bandwidth.effectiveType === 'slow-2g'
        )
    })

    // Connection quality detection
    const detectMobileDevice = (): boolean => {
        // Check for mobile device indicators
        const userAgent = navigator.userAgent.toLowerCase()
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)

        // Check for touch support
        const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0

        // Check screen size
        const isSmallScreen = window.innerWidth <= 768

        return isMobileUA || (hasTouchSupport && isSmallScreen)
    }

    const updateConnectionQuality = (): void => {
        // Use Network Information API if available
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

        if (connection) {
            mobileState.bandwidth = {
                downlink: connection.downlink,
                effectiveType: connection.effectiveType,
                rtt: connection.rtt
            }

            // Determine connection quality
            if (connection.effectiveType === '4g' && connection.downlink > 10) {
                mobileState.connectionQuality = 'excellent'
            } else if (connection.effectiveType === '4g' || (connection.effectiveType === '3g' && connection.downlink > 2)) {
                mobileState.connectionQuality = 'good'
            } else if (connection.effectiveType === '3g' || connection.downlink > 0.5) {
                mobileState.connectionQuality = 'fair'
            } else {
                mobileState.connectionQuality = 'poor'
            }

            // Update network type
            mobileState.networkType = connection.type || 'unknown'
        } else {
            // Fallback: use WebSocket health metrics
            const health = webSocket.health.value
            if (health.latency < 100) {
                mobileState.connectionQuality = 'excellent'
            } else if (health.latency < 300) {
                mobileState.connectionQuality = 'good'
            } else if (health.latency < 800) {
                mobileState.connectionQuality = 'fair'
            } else {
                mobileState.connectionQuality = 'poor'
            }
        }

        // Update adaptive retry delay based on connection quality
        updateAdaptiveRetryDelay()
    }

    const updateAdaptiveRetryDelay = (): void => {
        const baseDelay = MOBILE_WS_RETRY_BASE_DELAY
        const qualityMultiplier = {
            excellent: 1,
            good: 1.5,
            fair: 2,
            poor: 3
        }

        adaptiveRetryDelay.value = Math.min(
            baseDelay * qualityMultiplier[mobileState.connectionQuality],
            mobileConfig.maxRetryBackoff
        )
    }

    // Battery status detection
    const updateBatteryStatus = async (): Promise<void> => {
        try {
            const battery = await (navigator as any).getBattery?.()
            if (battery) {
                mobileState.batteryLevel = battery.level
                mobileState.isLowPowerMode = battery.level < 0.2 // Consider low power mode below 20%
            }
        } catch (error) {
            // Battery API not supported, ignore
        }
    }

    // Enhanced message sending with mobile optimizations
    const sendMobileMessage = async (message: WebSocketMessage, priority: boolean = false): Promise<void> => {
        // Check if message type is in priority list
        const isPriorityMessage = mobileConfig.priorityMessageTypes.includes(message.type)

        if (priority || isPriorityMessage) {
            // Send immediately, bypassing normal queue limits
            if (priorityQueue.value.length < MOBILE_WS_PRIORITY_QUEUE_SIZE) {
                priorityQueue.value.push(message)
                await processPriorityQueue()
            }
        } else if (isLowBandwidth.value && mobileConfig.bandwidthAware) {
            // Use bandwidth-aware queuing
            if (bandwidthAwareQueue.value.length < MOBILE_WS_LOW_BANDWIDTH_QUEUE_SIZE) {
                bandwidthAwareQueue.value.push(message)
                await processBandwidthAwareQueue()
            }
        } else {
            // Use normal WebSocket sending
            await webSocket.sendMessage(message)
        }
    }

    const processPriorityQueue = async (): Promise<void> => {
        while (priorityQueue.value.length > 0 && webSocket.isConnected.value) {
            const message = priorityQueue.value.shift()
            if (message) {
                try {
                    await webSocket.sendMessage(message)
                } catch (error) {
                    console.error('Failed to send priority message:', error)
                    // Re-queue if connection is still active
                    if (webSocket.isConnected.value) {
                        priorityQueue.value.unshift(message)
                    }
                    break
                }
            }
        }
    }

    const processBandwidthAwareQueue = async (): Promise<void> => {
        // Process messages with delay based on connection quality
        const delay = isLowBandwidth.value ? 100 : 50

        while (bandwidthAwareQueue.value.length > 0 && webSocket.isConnected.value) {
            const message = bandwidthAwareQueue.value.shift()
            if (message) {
                try {
                    await webSocket.sendMessage(message)
                    // Add delay between messages for low bandwidth connections
                    if (isLowBandwidth.value) {
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }
                } catch (error) {
                    console.error('Failed to send bandwidth-aware message:', error)
                    // Re-queue if connection is still active
                    if (webSocket.isConnected.value) {
                        bandwidthAwareQueue.value.unshift(message)
                    }
                    break
                }
            }
        }
    }

    // Mobile-specific message sending methods
    const sendGestureEvent = async (
        gestureEvent: GestureEvent,
        target: string,
        metadata?: Record<string, any>
    ): Promise<void> => {
        if (!mobileConfig.gestureReporting) return

        // Debounce gesture events
        const now = Date.now()
        if (now - lastGestureTime.value < MOBILE_WS_GESTURE_DEBOUNCE) {
            return
        }
        lastGestureTime.value = now

        const message: MobileGestureMessage = {
            type: 'mobile_gesture',
            timestamp: now,
            data: {
                gestureType: gestureEvent.type,
                target,
                coordinates: gestureEvent.center,
                velocity: {
                    x: gestureEvent.deltaX / gestureEvent.duration,
                    y: gestureEvent.deltaY / gestureEvent.duration
                },
                scale: gestureEvent.scale,
                direction: gestureEvent.direction,
                distance: gestureEvent.distance,
                duration: gestureEvent.duration,
                metadata
            }
        }

        await sendMobileMessage(message, true) // Gestures are priority
    }

    const sendLayoutUpdate = async (layoutData: any): Promise<void> => {
        if (!mobileConfig.layoutSync) return

        // Debounce layout updates
        const now = Date.now()
        if (now - lastLayoutSyncTime.value < MOBILE_WS_LAYOUT_SYNC_DEBOUNCE) {
            return
        }
        lastLayoutSyncTime.value = now

        const message: MobileLayoutMessage = {
            type: 'mobile_layout',
            timestamp: now,
            data: layoutData
        }

        await sendMobileMessage(message)
    }

    const sendPreviewAction = async (
        path: string,
        action: string,
        metadata?: any
    ): Promise<void> => {
        const message: MobilePreviewMessage = {
            type: 'mobile_preview',
            timestamp: Date.now(),
            data: {
                path,
                previewType: getPreviewType(path),
                action: action as any,
                metadata
            }
        }

        await sendMobileMessage(message)
    }

    const sendHapticFeedback = async (
        type: string,
        trigger: string,
        pattern?: number[]
    ): Promise<void> => {
        if (!mobileConfig.hapticFeedback) return

        // Cooldown for haptic feedback to prevent spam
        const now = Date.now()
        if (now - lastHapticTime.value < MOBILE_WS_HAPTIC_COOLDOWN) {
            return
        }
        lastHapticTime.value = now

        const message: MobileHapticMessage = {
            type: 'mobile_haptic',
            timestamp: now,
            data: {
                type: type as any,
                pattern,
                trigger
            }
        }

        await sendMobileMessage(message, true) // Haptic feedback is priority
    }

    const syncMobileState = async (syncType: string, payload: any): Promise<void> => {
        const message: MobileSyncMessage = {
            type: 'mobile_sync',
            timestamp: Date.now(),
            data: {
                syncType: syncType as any,
                payload,
                timestamp: Date.now()
            }
        }

        await sendMobileMessage(message)
    }

    // Utility functions
    const getPreviewType = (path: string): 'image' | 'code' | 'markdown' | 'text' => {
        const ext = path.split('.').pop()?.toLowerCase()

        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
            return 'image'
        }
        if (['md', 'markdown'].includes(ext || '')) {
            return 'markdown'
        }
        if (['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'json', 'xml', 'yaml'].includes(ext || '')) {
            return 'code'
        }
        return 'text'
    }

    const enableBandwidthAwareMode = (): void => {
        mobileConfig.bandwidthAware = true
    }

    const disableBandwidthAwareMode = (): void => {
        mobileConfig.bandwidthAware = false
    }

    const updateMobileConfig = (config: Partial<WebSocketConfig['mobile']>): void => {
        Object.assign(mobileConfig, config)
    }

    // Initialize mobile detection and monitoring
    onMounted(() => {
        // Detect mobile device
        mobileState.isMobile = detectMobileDevice()

        // Initial connection quality check
        updateConnectionQuality()
        updateBatteryStatus()

        // Set up periodic connection quality monitoring
        const qualityCheckInterval = setInterval(() => {
            updateConnectionQuality()
            updateBatteryStatus()
        }, MOBILE_WS_CONNECTION_QUALITY_CHECK_INTERVAL)

        // Listen for network changes
        const connection = (navigator as any).connection
        if (connection) {
            connection.addEventListener('change', updateConnectionQuality)
        }

        // Listen for battery changes
        navigator.getBattery?.().then((battery: any) => {
            battery.addEventListener('levelchange', updateBatteryStatus)
            battery.addEventListener('chargingchange', updateBatteryStatus)
        }).catch(() => {
            // Battery API not supported
        })

        // Cleanup on unmount
        onUnmounted(() => {
            clearInterval(qualityCheckInterval)
            if (connection) {
                connection.removeEventListener('change', updateConnectionQuality)
            }
        })
    })

    // Watch for connection status changes to process queues
    watch(() => webSocket.isConnected.value, (connected) => {
        if (connected) {
            processPriorityQueue()
            processBandwidthAwareQueue()
        }
    })

    // Watch for low bandwidth changes to adjust queue processing
    watch(isLowBandwidth, (lowBandwidth) => {
        if (lowBandwidth && mobileConfig.bandwidthAware) {
            console.log('Enabling bandwidth-aware mode due to poor connection')
        }
    })

    return {
        // Base WebSocket functionality
        webSocket,

        // Mobile state
        mobileState: mobileState as MobileConnectionState,
        isLowBandwidth,
        adaptiveRetryDelay,

        // Mobile methods
        sendGestureEvent,
        sendLayoutUpdate,
        sendPreviewAction,
        sendHapticFeedback,
        syncMobileState,

        // Connection quality management
        updateConnectionQuality,
        enableBandwidthAwareMode,
        disableBandwidthAwareMode,

        // Mobile-specific configuration
        updateMobileConfig
    }
}