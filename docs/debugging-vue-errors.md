# Debugging Vue.js Runtime Errors

## Common Error: "Cannot read properties of undefined (reading '_s')"

This error typically occurs when Vue's template compiler encounters undefined values in template expressions.

### What `_s` means
- `_s` is Vue's internal string interpolation function
- The error means Vue is trying to convert an undefined value to a string for display

### How to Debug

#### 1. Enable Source Maps
In `vite.config.ts`, ensure source maps are always enabled:
```typescript
build: {
  sourcemap: true, // Always enable for debugging
  // ... other config
}
```

#### 2. Common Causes & Solutions

**Accessing properties on null/undefined objects:**
```vue
<!-- ❌ Bad: Can cause _s error -->
<div>{{ user.name }}</div>

<!-- ✅ Good: Safe access -->
<div>{{ user?.name || 'Unknown' }}</div>
```

**Computed properties returning undefined:**
```vue
<!-- ❌ Bad: computed might return undefined -->
<div>{{ computedValue }}</div>

<!-- ✅ Good: Provide fallback -->
<div>{{ computedValue || 'Loading...' }}</div>
```

**Ref objects not initialized:**
```vue
<template>
  <!-- ❌ Bad: ref might be null -->
  <div>{{ myRef.someProperty }}</div>
  
  <!-- ✅ Good: Check ref exists -->
  <div>{{ myRef?.someProperty || 'Not available' }}</div>
</template>

<script setup>
const myRef = ref(null) // Initially null
</script>
```

#### 3. Debugging Steps

1. **Check Browser Console**: Look for the exact line in source maps
2. **Identify Template Expression**: Find which `{{ }}` or `:attribute` is failing
3. **Add Null Checks**: Use optional chaining (`?.`) and nullish coalescing (`??`)
4. **Use Computed Properties**: Create safe computed properties with fallbacks

#### 4. Safe Template Patterns

```vue
<template>
  <!-- Safe object access -->
  <div>{{ data?.user?.name ?? 'Guest' }}</div>
  
  <!-- Safe array access -->
  <div v-if="items?.length">{{ items[0]?.title }}</div>
  
  <!-- Safe method calls -->
  <button @click="handler?.()">Click</button>
  
  <!-- Safe computed properties -->
  <div>{{ safeComputedValue }}</div>
</template>

<script setup>
const data = ref(null)
const items = ref([])
const handler = ref(null)

// Safe computed with fallback
const safeComputedValue = computed(() => {
  return data.value?.someProperty || 'Default value'
})
</script>
```

#### 5. Lifecycle Considerations

```vue
<script setup>
const element = ref(null)
const composable = ref(null)

// ❌ Bad: Initialize immediately
// composable.value = useComposable(element.value) // element.value is null

// ✅ Good: Initialize in onMounted
onMounted(() => {
  composable.value = useComposable(element.value)
})
</script>
```

### Prevention Checklist

- [ ] Always use optional chaining (`?.`) for object property access
- [ ] Provide fallback values with nullish coalescing (`??`)
- [ ] Initialize composables in `onMounted` when they depend on DOM elements
- [ ] Use computed properties with safe fallbacks
- [ ] Enable source maps for easier debugging
- [ ] Test with empty/null data states

### Example Fix

**Before (causes error):**
```vue
<template>
  <div>{{ user.profile.name }}</div>
  <div>{{ settings.theme }}</div>
</template>
```

**After (safe):**
```vue
<template>
  <div>{{ user?.profile?.name ?? 'Unknown User' }}</div>
  <div>{{ settings?.theme ?? 'default' }}</div>
</template>
```