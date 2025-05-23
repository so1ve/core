import { writeFile, cp } from 'node:fs/promises'
import { logger } from '@nuxt/kit'
import { join, resolve } from 'pathe'
import { $fetch } from 'ofetch'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'
import type { HubConfig } from '../features'
import { applyRemoteDatabaseMigrations, applyRemoteDatabaseQueries } from '../runtime/database/server/utils/migrations/remote'
import type { ModuleOptions } from '../types'

const log = logger.withTag('nuxt:hub')

export function addBuildHooks(nuxt: Nuxt, hub: HubConfig) {
  // Within CF Pages CI/CD to notice NuxtHub about the build and hub config
  if (!nuxt.options.dev && process.env.CF_PAGES && process.env.NUXT_HUB_PROJECT_DEPLOY_TOKEN && process.env.NUXT_HUB_PROJECT_KEY && process.env.NUXT_HUB_ENV) {
    // Disable remote option (if set also for prod)
    hub.remote = false
    // Wait for modules to be done to send config to NuxtHub
    nuxt.hook('modules:done', async () => {
      const { bindingsChanged } = await $fetch(`/api/projects/${process.env.NUXT_HUB_PROJECT_KEY}/build/${process.env.NUXT_HUB_ENV}/before`, {
        baseURL: hub.url,
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.NUXT_HUB_PROJECT_DEPLOY_TOKEN}`
        },
        body: {
          pagesUrl: process.env.CF_PAGES_URL,
          ai: hub.ai,
          analytics: hub.analytics,
          blob: hub.blob,
          browser: hub.browser,
          cache: hub.cache,
          database: hub.database,
          kv: hub.kv,
          vectorize: hub.vectorize,
          bindings: hub.bindings
        }
      }).catch((e) => {
        if (e.response?._data?.message) {
          log.error(e.response._data.message)
        } else {
          log.error('Failed run build:before hook on NuxtHub.', e)
        }

        process.exit(1)
      })

      if (bindingsChanged) {
        log.box([
          'NuxtHub detected some changes in this project bindings and updated your Pages project on your Cloudflare account.',
          'In order to enable this changes, this deployment will be cancelled and a new one has been created.'
        ].join('\n'))

        // Wait 2 seconds to make sure NuxtHub cancel the deployment before exiting
        await new Promise(resolve => setTimeout(resolve, 2000))

        process.exit(1)
      }
    })

    nuxt.hook('build:error', async (error) => {
      await $fetch(`/api/projects/${process.env.NUXT_HUB_PROJECT_KEY}/build/${process.env.NUXT_HUB_ENV}/error`, {
        baseURL: hub.url,
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.NUXT_HUB_PROJECT_DEPLOY_TOKEN}`
        },
        body: {
          pagesUrl: process.env.CF_PAGES_URL,
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack
          }
        }
      }).catch(() => {
        // ignore api call error
      })
    })

    nuxt.hook('nitro:init', async (nitro) => {
      nitro.hooks.hook('compiled', async () => {
        await $fetch(`/api/projects/${process.env.NUXT_HUB_PROJECT_KEY}/build/${process.env.NUXT_HUB_ENV}/done`, {
          baseURL: hub.url,
          method: 'POST',
          headers: {
            authorization: `Bearer ${process.env.NUXT_HUB_PROJECT_DEPLOY_TOKEN}`
          },
          body: {
            pagesUrl: process.env.CF_PAGES_URL
          }
        }).catch((e) => {
          if (e.response?._data?.message) {
            log.error(e.response._data.message)
          } else {
            log.error('Failed run compiled:done hook on NuxtHub.', e)
          }

          process.exit(1)
        })
        // Apply migrations if database is enabled
        if (hub.database) {
          const migrationsApplied = await applyRemoteDatabaseMigrations(hub)
          if (!migrationsApplied) {
            process.exit(1)
          }

          const queriesApplied = await applyRemoteDatabaseQueries(hub)
          if (!queriesApplied) {
            process.exit(1)
          }
        }
      })
    })
  } else {
    // Write `dist/hub.config.json` after public assets are built
    nuxt.hook('nitro:build:public-assets', async (nitro) => {
      const hubConfig = {
        ai: hub.ai,
        analytics: hub.analytics,
        blob: hub.blob,
        browser: hub.browser,
        cache: hub.cache,
        database: hub.database,
        kv: hub.kv,
        vectorize: hub.vectorize,
        bindings: hub.bindings,
        nitroPreset: nuxt.options.nitro.preset
      }
      const distDir = nitro.options.output.dir || nitro.options.output.publicDir
      await writeFile(join(distDir, 'hub.config.json'), JSON.stringify(hubConfig, null, 2), 'utf-8')

      if (hub.database) {
        try {
          await cp(resolve(nitro.options.rootDir, hub.dir!, 'database'), resolve(nitro.options.output.dir, 'database'), { recursive: true })
          log.info('Database migrations and queries included in build')
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            log.info('Skipping bundling database migrations - no migrations found')
          }
        }
      }
    })
  }
}

export function getNitroPreset(hub: ModuleOptions, nitroOption: NitroConfig) {
  if (nitroOption.preset) return nitroOption.preset.replace('-', '_')
  if (hub.workers) {
    if (nitroOption?.experimental?.websocket) {
      return 'cloudflare_durable'
    }
    return 'cloudflare_module'
  }

  return 'cloudflare_pages'
}
