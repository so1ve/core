<script setup lang="ts">
definePageMeta({
  primary: 'green'
})
const { data: templates } = await useFetch('/api/templates.json')
const { data: page } = await useAsyncData('templates', () => queryContent('/templates').findOne())

useSeoMeta({
  title: page.value.title,
  ogTitle: `${page.value.title} · NuxtHub`,
  description: page.value.description,
  ogDescription: page.value.description
})

defineOgImageComponent('Docs')
</script>

<template>
  <UContainer>
    <UPageHero v-bind="page?.hero" :ui="{ base: 'z-10' }">
      <template #title>
        <span v-html="page?.hero.title" />
      </template>
    </UPageHero>
    <UPageGrid class="lg:grid-cols-3 xl:grid-cols-4 pb-10">
      <UPageCard
        v-for="(template, index) in templates"
        :key="index"
        :ui="{
          header: { base: 'aspect-w-4 aspect-h-2', padding: '' },
          body: { padding: '!p-4' },
          description: 'line-clamp-2 sm:min-h-[45px]'
        }"
        class="overflow-hidden"
        :description="template.description"
      >
        <template #title>
          <div class="flex flex-1 items-center justify-between">
            <span class="text-gray-900 dark:text-white text-base font-semibold truncate">
              {{ template.title }}
            </span>
            <UButton
              icon="i-simple-icons-github"
              :to="`https://github.com/${template.owner}/${template.repo}`"
              target="_blank"
              size="xs"
              color="gray"
              variant="ghost"
              class="opacity-75 hover:opacity-100"
            />
          </div>
        </template>
        <template #header>
          <img
            :src="template.imageUrl"
            class="object-cover object-top w-full h-full xl:hidden"
            :alt="template.title"
            width="600"
            height="300"
          >
          <img
            :src="template.imageUrl"
            :alt="template.title"
            class="object-cover object-top w-full h-full hidden xl:block"
            width="280"
            height="140"
          >
        </template>

        <div class="flex items-center flex-wrap gap-1 pt-2">
          <UBadge
            v-if="template.workersPaid"
            label="Workers Paid"
            color="amber"
            variant="subtle"
            size="sm"
            class="rounded-full"
          />
          <NuxtLink v-for="feature of template.features" :key="feature" :to="`/docs/features/${feature}`">
            <UBadge
              :label="feature"
              size="sm"
              color="gray"
              class="rounded-full hover:text-black dark:hover:text-white"
            />
          </NuxtLink>
        </div>
        <UButtonGroup class="mt-3 w-full">
          <UButton
            v-if="template.demoUrl"
            label="Demo"
            trailing-icon="i-lucide-arrow-up-right"
            :to="template.demoUrl"
            target="_blank"
            size="sm"
            color="gray"
            class="w-1/2 justify-center"
            :ui="{ icon: { size: { sm: 'w-4 h-4' } } }"
          />
          <UButton
            label="Deploy"
            icon="i-lucide-cloud-upload"
            :to="`https://hub.nuxt.com/new?template=${template.slug}`"
            size="sm"
            color="gray"
            class="justify-center"
            :class="template.demoUrl ? 'w-1/2' : 'w-full'"
            :ui="{ icon: { size: { sm: 'w-4 h-4' } } }"
          />
        </UButtonGroup>
      </UPageCard>
    </UPageGrid>
  </UContainer>
</template>
