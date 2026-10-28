<script setup lang="ts">
const user = {
    age: 18,
    gender: 'female',
    name: 'Alice'
};
</script>

<template>
    <div class="message">{{ user.name }}</div>
</template>
