<template>
  <div class="utility-demo p-6 space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">Utility Components Demo</h1>
    
    <!-- Loading Spinner Demo -->
    <section class="demo-section">
      <h2 class="section-title">Loading Spinner</h2>
      <div class="demo-grid">
        <div class="demo-item">
          <h3>Sizes</h3>
          <div class="flex items-center gap-4">
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" />
            <LoadingSpinner size="xl" />
          </div>
        </div>
        
        <div class="demo-item">
          <h3>Colors</h3>
          <div class="flex items-center gap-4">
            <LoadingSpinner color="primary" />
            <LoadingSpinner color="success" />
            <LoadingSpinner color="warning" />
            <LoadingSpinner color="error" />
          </div>
        </div>
        
        <div class="demo-item">
          <h3>With Message</h3>
          <LoadingSpinner message="Loading data..." center />
        </div>
      </div>
    </section>

    <!-- Dialog Demo -->
    <section class="demo-section">
      <h2 class="section-title">Dialogs</h2>
      <div class="demo-grid">
        <button @click="showInfoDialog" class="demo-button">Show Info Dialog</button>
        <button @click="showSuccessDialog" class="demo-button">Show Success Dialog</button>
        <button @click="showWarningDialog" class="demo-button">Show Warning Dialog</button>
        <button @click="showErrorDialog" class="demo-button">Show Error Dialog</button>
        <button @click="showConfirmDialog" class="demo-button">Show Confirmation</button>
        <button @click="showDestructiveDialog" class="demo-button destructive">Show Destructive Action</button>
      </div>
    </section>

    <!-- Modal Demo -->
    <section class="demo-section">
      <h2 class="section-title">Modals</h2>
      <div class="demo-grid">
        <button @click="showSmallModal" class="demo-button">Small Modal</button>
        <button @click="showMediumModal" class="demo-button">Medium Modal</button>
        <button @click="showLargeModal" class="demo-button">Large Modal</button>
      </div>
    </section>

    <!-- Error Boundary Demo -->
    <section class="demo-section">
      <h2 class="section-title">Error Boundary</h2>
      <ErrorBoundary>
        <div class="p-4 border border-gray-200 rounded">
          <p>This content is wrapped in an ErrorBoundary.</p>
          <button @click="triggerError" class="demo-button destructive mt-2">
            Trigger Error
          </button>
        </div>
      </ErrorBoundary>
    </section>

    <!-- Dialogs -->
    <Dialog
      v-model="dialogState.isOpen"
      :title="dialogState.title"
      :message="dialogState.message"
      :type="dialogState.type"
      :show-cancel="dialogState.showCancel"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText"
      @confirm="handleDialogConfirm"
      @cancel="handleDialogCancel"
    />

    <ConfirmationDialog
      v-model="confirmationState.isOpen"
      :title="confirmationState.title"
      :message="confirmationState.message"
      :type="confirmationState.type"
      :destructive="confirmationState.destructive"
      :destructive-warning="confirmationState.destructiveWarning"
      :require-confirmation="confirmationState.requireConfirmation"
      :confirmation-text="confirmationState.confirmationText"
      :confirm-text="confirmationState.confirmText"
      :cancel-text="confirmationState.cancelText"
      @confirm="handleConfirmationConfirm"
      @cancel="handleConfirmationCancel"
    />

    <!-- Modals -->
    <Modal
      v-model="modalState.isOpen"
      :title="modalState.title"
      :size="modalState.size"
    >
      <p>{{ modalState.content }}</p>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import {
  LoadingSpinner,
  ErrorBoundary,
  Dialog,
  ConfirmationDialog,
  Modal
} from './index'
import { useDialog } from '../../composables/useDialog'

const {
  dialogState,
  confirmationState,
  handleDialogConfirm,
  handleDialogCancel,
  handleConfirmationConfirm,
  handleConfirmationCancel,
  showInfo,
  showSuccess,
  showWarning,
  showError,
  confirm,
  confirmDestructive
} = useDialog()

const modalState = reactive({
  isOpen: false,
  title: '',
  size: 'md' as 'sm' | 'md' | 'lg',
  content: ''
})

const showInfoDialog = async () => {
  const result = await showInfo('This is an informational message.')
  console.log('Info dialog result:', result)
}

const showSuccessDialog = async () => {
  const result = await showSuccess('Operation completed successfully!')
  console.log('Success dialog result:', result)
}

const showWarningDialog = async () => {
  const result = await showWarning('This action may have consequences.')
  console.log('Warning dialog result:', result)
}

const showErrorDialog = async () => {
  const result = await showError('An error occurred while processing your request.')
  console.log('Error dialog result:', result)
}

const showConfirmDialog = async () => {
  const result = await confirm('Are you sure you want to continue?')
  console.log('Confirmation result:', result)
}

const showDestructiveDialog = async () => {
  const result = await confirmDestructive(
    'This will permanently delete all selected items.',
    'Delete Items',
    {
      requireConfirmation: true,
      confirmationText: 'DELETE',
      destructiveWarning: 'All data will be lost and cannot be recovered.'
    }
  )
  console.log('Destructive confirmation result:', result)
}

const showSmallModal = () => {
  modalState.isOpen = true
  modalState.title = 'Small Modal'
  modalState.size = 'sm'
  modalState.content = 'This is a small modal dialog.'
}

const showMediumModal = () => {
  modalState.isOpen = true
  modalState.title = 'Medium Modal'
  modalState.size = 'md'
  modalState.content = 'This is a medium-sized modal dialog with more content space.'
}

const showLargeModal = () => {
  modalState.isOpen = true
  modalState.title = 'Large Modal'
  modalState.size = 'lg'
  modalState.content = 'This is a large modal dialog that can accommodate extensive content and complex layouts.'
}

const triggerError = () => {
  throw new Error('This is a test error to demonstrate the ErrorBoundary component.')
}
</script>

<style scoped>
.utility-demo {
  @apply max-w-4xl mx-auto;
}

.demo-section {
  @apply border border-gray-200 rounded-lg p-6;
}

.section-title {
  @apply text-lg font-semibold text-gray-800 mb-4;
}

.demo-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.demo-item {
  @apply space-y-2;
}

.demo-item h3 {
  @apply text-sm font-medium text-gray-700;
}

.demo-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors;
}

.demo-button.destructive {
  @apply bg-red-600 hover:bg-red-700 focus:ring-red-500;
}
</style>