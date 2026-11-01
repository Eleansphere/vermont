<script setup lang="ts">
defineProps<{ title: string; wide?: boolean }>();
</script>

<template>
  <div class="dialog">
    <section
      class="dialog__box panel"
      :class="{ 'dialog__box--wide': wide }"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <h2 class="dialog__title">{{ title }}</h2>
      <slot />
    </section>
  </div>
</template>

<style scoped>
.dialog {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgb(10 12 16 / 60%);
}

.dialog__box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(420px, calc(100% - 32px));
  max-height: calc(100% - 24px);
  padding: 18px 20px;
  overflow-y: auto;
}

@media (max-width: 900px), (max-height: 560px) {
  .dialog__box {
    gap: 8px;
    max-height: calc(100% - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    padding: 12px 14px;
  }

  .dialog__title {
    font-size: 18px;
  }
}

.dialog__box--wide {
  width: min(820px, calc(100% - 32px));
}

.dialog__title {
  font-size: 22px;
  color: var(--accent);
}
</style>
