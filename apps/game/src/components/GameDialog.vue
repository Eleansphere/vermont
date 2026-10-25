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
  padding: 18px 20px;
}

.dialog__box--wide {
  width: min(820px, calc(100% - 32px));
}

.dialog__title {
  font-size: 22px;
  color: var(--accent);
}
</style>
