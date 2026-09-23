<script lang="ts">
import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
import Eye from 'phosphor-svelte/lib/Eye';
import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
import {
  API_KEY_STORAGE_KEY,
  ENGINE_URL_STORAGE_KEY,
  getStoredApiKey,
  getStoredEngineUrl,
  setStoredApiKey,
  setStoredEngineUrl,
} from '$lib/api/client';
import {
  CROSSFADE_STORAGE_KEY,
  NORMALIZATION_STORAGE_KEY,
  player,
  QUALITY_STORAGE_KEY,
} from '$lib/player/engine.svelte';
import type { QualityTier } from '$lib/player/scheduler';
import { theme } from '$lib/theme.svelte';
import { toast } from '$lib/toast.svelte';
import Button from '$lib/ui/Button.svelte';

export const QUALITY_WIFI_KEY = QUALITY_STORAGE_KEY;
export const QUALITY_CELLULAR_KEY = 'naad:quality:cellular';

// Stored settings
let apiKey = $state(getStoredApiKey() ?? '');
let showApiKey = $state(false);
let engineUrl = $state(getStoredEngineUrl() ?? '');

let wifiQuality = $state<QualityTier>(
  (typeof localStorage !== 'undefined' ? (localStorage.getItem(QUALITY_WIFI_KEY) as QualityTier) : null) ||
    'max',
);

let cellularQuality = $state<QualityTier>(
  (typeof localStorage !== 'undefined'
    ? (localStorage.getItem(QUALITY_CELLULAR_KEY) as QualityTier)
    : null) || 'high',
);

let normalization = $state(player.normalizationEnabled);
let crossfade = $state(player.crossfadeSeconds);

// Testing status
let testStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
let testMessage = $state<string | null>(null);

const tiers: { value: QualityTier; label: string; desc: string }[] = [
  { value: 'max', label: 'Max', desc: 'Highest available tier from any source' },
  { value: 'hires', label: 'Hi-Res', desc: 'Up to 24-bit / 192 kHz FLAC' },
  { value: 'lossless', label: 'Lossless', desc: '16-bit / 44.1 kHz CD quality' },
  { value: 'high', label: 'High', desc: 'AAC 320 kbps / MP3 320 kbps' },
  { value: 'standard', label: 'Standard', desc: 'AAC 160 kbps / MP3 160 kbps' },
];

function handleSaveCredentials(e: SubmitEvent) {
  e.preventDefault();
  setStoredApiKey(apiKey.trim() || null);
  setStoredEngineUrl(engineUrl.trim() || null);
  toast.push('Connection settings saved');
}

async function handleTestConnection() {
  testStatus = 'testing';
  testMessage = null;

  const base =
    engineUrl.trim() || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8080');
  const headers: Record<string, string> = {};
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  try {
    const res = await fetch(`${base}/v1/library/playlists`, { headers });
    if (res.ok) {
      testStatus = 'success';
      testMessage = 'Connection verified successfully (HTTP 200 OK)';
      toast.push('Engine connection verified');
    } else if (res.status === 401) {
      testStatus = 'error';
      testMessage = 'Authentication failed: Invalid API key (HTTP 401)';
      toast.push('Invalid API key', { tone: 'danger' });
    } else {
      testStatus = 'error';
      testMessage = `Engine responded with HTTP ${res.status}`;
      toast.push(`Engine returned status ${res.status}`, { tone: 'danger' });
    }
  } catch (err: unknown) {
    testStatus = 'error';
    const msg = err instanceof Error ? err.message : 'Network error';
    testMessage = `Cannot reach engine: ${msg}. Check CORS and URL.`;
    toast.push('Connection failed', { tone: 'danger' });
  }
}

function handleWifiQualityChange(tier: QualityTier) {
  wifiQuality = tier;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(QUALITY_WIFI_KEY, tier);
  }
  player.setQuality(tier);
  toast.push(`Wi-Fi playback quality set to ${tier.toUpperCase()}`);
}

function handleCellularQualityChange(tier: QualityTier) {
  cellularQuality = tier;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(QUALITY_CELLULAR_KEY, tier);
  }
  toast.push(`Cellular playback quality set to ${tier.toUpperCase()}`);
}

function handleNormalizationToggle() {
  normalization = !normalization;
  player.setNormalization(normalization);
  toast.push(`Loudness normalization ${normalization ? 'enabled' : 'disabled'}`);
}

function handleCrossfadeChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const val = Number(target.value);
  crossfade = val;
  player.setCrossfade(val);
}

function handleClearLocalData() {
  if (
    typeof confirm !== 'undefined' &&
    !confirm('Are you sure you want to clear all local data, cached preferences, and storage?')
  ) {
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  apiKey = '';
  engineUrl = '';
  wifiQuality = 'max';
  cellularQuality = 'high';
  normalization = true;
  crossfade = 0;
  player.setNormalization(true);
  player.setCrossfade(0);
  player.setQuality('max');
  toast.push('All local storage data has been cleared');
}
</script>

<svelte:head>
  <title>Settings · NAAD</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
  <!-- Header -->
  <header class="mb-8 border-b border-border pb-6">
    <p class="font-mono text-2xs uppercase tracking-wider text-accent mb-2">Configuration</p>
    <h1 class="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
      Settings
    </h1>
    <p class="mt-2 text-sm text-ink-muted max-w-xl">
      Manage engine connectivity, audio pipeline parameters, quality preferences, and UI appearance.
    </p>
  </header>

  <div class="space-y-8">
    <!-- SECTION 1: Engine Connection & Authentication -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-5">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Engine & Authentication</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Credentials for connecting to the NAAD v3 multi-source engine.
        </p>
      </div>

      <form onsubmit={handleSaveCredentials} class="space-y-4">
        <!-- API Key Input -->
        <div>
          <label for="api-key" class="block font-medium text-xs text-ink uppercase tracking-wide mb-1.5">
            API Key
          </label>
          <div class="relative flex items-center">
            <input
              id="api-key"
              type={showApiKey ? 'text' : 'password'}
              bind:value={apiKey}
              placeholder="Paste Bearer token (leave empty if engine has no key configured)"
              class="w-full rounded-xs border border-border-strong bg-surface-0 px-3 py-2 pr-10 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onclick={() => (showApiKey = !showApiKey)}
              class="absolute right-2.5 text-ink-muted hover:text-ink"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {#if showApiKey}
                <EyeSlash size={16} />
              {:else}
                <Eye size={16} />
              {/if}
            </button>
          </div>
          <span class="mt-1 block text-[11px] text-ink-faint">
            Stored locally in browser storage and transmitted as <code class="font-mono text-ink">Authorization: Bearer</code>.
          </span>
        </div>

        <!-- Custom Engine URL Input -->
        <div>
          <label for="engine-url" class="block font-medium text-xs text-ink uppercase tracking-wide mb-1.5">
            Engine Base URL
          </label>
          <input
            id="engine-url"
            type="url"
            bind:value={engineUrl}
            placeholder="Default: same-origin (reverse proxy)"
            class="w-full rounded-xs border border-border-strong bg-surface-0 px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <p class="mt-1 text-[11px] text-ink-faint leading-relaxed">
            Leave empty for standard deployment (served through reverse proxy with no CORS).
            If targeting a remote engine, the engine's <code class="font-mono text-ink">CORS_ORIGINS</code> must include this web origin.
          </p>
        </div>

        <!-- Test Connection Banner -->
        {#if testStatus === 'success'}
          <div class="flex items-center gap-2 rounded-xs border border-accent/40 bg-accent/10 p-3 text-xs text-accent font-mono">
            <CheckCircle size={16} weight="bold" class="shrink-0" />
            <span>{testMessage}</span>
          </div>
        {:else if testStatus === 'error'}
          <div class="flex items-center gap-2 rounded-xs border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-mono">
            <WarningCircle size={16} weight="bold" class="shrink-0" />
            <span>{testMessage}</span>
          </div>
        {/if}

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" variant="solid" size="sm">
            Save Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testStatus === 'testing'}
            onclick={handleTestConnection}
          >
            {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </form>
    </section>

    <!-- SECTION 2: Audio Quality Preferences -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-6">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Playback Quality Tiers</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Select target audio fidelity separately for Wi-Fi and mobile networks.
        </p>
      </div>

      <!-- Wi-Fi Quality -->
      <div class="space-y-3">
        <p class="font-medium text-xs text-ink uppercase tracking-wide">
          Wi-Fi & Ethernet Network
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {#each tiers as tier}
            <button
              type="button"
              onclick={() => handleWifiQualityChange(tier.value)}
              class="flex flex-col items-start p-3 rounded-xs border text-left transition-colors {wifiQuality === tier.value
                ? 'border-accent bg-accent/10 text-ink'
                : 'border-border bg-surface-0 hover:bg-surface-2 text-ink-muted'}"
            >
              <span class="font-mono text-xs font-semibold uppercase {wifiQuality === tier.value ? 'text-accent' : 'text-ink'}">
                {tier.label}
              </span>
              <span class="mt-1 text-[11px] text-ink-faint leading-tight">
                {tier.desc}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Cellular Quality -->
      <div class="space-y-3 pt-2 border-t border-border">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-medium text-xs text-ink uppercase tracking-wide">
            Cellular / Metered Network
          </p>
          <span class="text-[11px] font-mono text-ink-faint">
            Active when browser supports <code class="text-ink">navigator.connection</code>
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {#each tiers as tier}
            <button
              type="button"
              onclick={() => handleCellularQualityChange(tier.value)}
              class="flex flex-col items-start p-3 rounded-xs border text-left transition-colors {cellularQuality === tier.value
                ? 'border-accent bg-accent/10 text-ink'
                : 'border-border bg-surface-0 hover:bg-surface-2 text-ink-muted'}"
            >
              <span class="font-mono text-xs font-semibold uppercase {cellularQuality === tier.value ? 'text-accent' : 'text-ink'}">
                {tier.label}
              </span>
              <span class="mt-1 text-[11px] text-ink-faint leading-tight">
                {tier.desc}
              </span>
            </button>
          {/each}
        </div>
      </div>
    </section>

    <!-- SECTION 3: Audio Processing (Normalization & Crossfade) -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-6">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Signal Processing</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Loudness matching and track boundary transitions.
        </p>
      </div>

      <!-- Normalization Toggle -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-ink">EBU R128 Loudness Normalization</p>
          <p class="text-xs text-ink-muted max-w-lg mt-0.5">
            Applies track-level gain attenuation (-14 LUFS standard) to ensure consistent volume across diverse catalog masters.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={normalization}
          aria-label="Toggle loudness normalization"
          onclick={handleNormalizationToggle}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {normalization ? 'bg-accent' : 'bg-surface-3'}"
        >
          <span
            class="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out {normalization ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>

      <!-- Crossfade Slider -->
      <div class="space-y-2 pt-4 border-t border-border">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-ink">Crossfade Duration</span>
          <span class="font-mono text-accent" data-numeric>
            {crossfade === 0 ? '0s (Gapless handoff)' : `${crossfade} seconds`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="12"
          step="1"
          value={crossfade}
          oninput={handleCrossfadeChange}
          class="w-full accent-accent h-1.5 bg-surface-3 rounded-xs cursor-pointer"
        />
        <div class="flex justify-between text-[10px] font-mono text-ink-faint">
          <span>0s (Off)</span>
          <span>4s</span>
          <span>8s</span>
          <span>12s</span>
        </div>
        <p class="text-[11px] text-ink-faint mt-1">
          Crossfade is automatically skipped between consecutive tracks of the same album to preserve continuous playback.
        </p>
      </div>
    </section>

    <!-- SECTION 4: Appearance & Interface -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-5">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Appearance & Theme</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Select between Dark (warm near-black #141312) and Light (paper palette #F4F1EA).
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4 max-w-sm">
        <button
          type="button"
          onclick={() => theme.set('dark')}
          class="flex flex-col items-center gap-2 p-4 rounded-xs border transition-colors {theme.current === 'dark'
            ? 'border-accent bg-accent/10 text-ink'
            : 'border-border bg-surface-0 hover:bg-surface-2 text-ink-muted'}"
        >
          <div class="size-8 rounded-xs bg-[#141312] border border-[#2a2824]"></div>
          <span class="text-xs font-medium {theme.current === 'dark' ? 'text-accent' : 'text-ink'}">Dark Theme</span>
          <span class="text-[10px] font-mono text-ink-faint">Warm Near-Black</span>
        </button>

        <button
          type="button"
          onclick={() => theme.set('light')}
          class="flex flex-col items-center gap-2 p-4 rounded-xs border transition-colors {theme.current === 'light'
            ? 'border-accent bg-accent/10 text-ink'
            : 'border-border bg-surface-0 hover:bg-surface-2 text-ink-muted'}"
        >
          <div class="size-8 rounded-xs bg-[#F4F1EA] border border-[#d6d0c4]"></div>
          <span class="text-xs font-medium {theme.current === 'light' ? 'text-accent' : 'text-ink'}">Light Theme</span>
          <span class="text-[10px] font-mono text-ink-faint">Paper Palette</span>
        </button>
      </div>
    </section>

    <!-- SECTION 5: Maintenance & Local Storage -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-4">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Storage & Cache</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Reset client preferences and clear browser cache.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="text-xs text-ink-muted max-w-md">
          Clearing local data will remove your saved API key, engine URL, audio quality preferences, and queue cache.
        </p>
        <Button variant="danger" size="sm" onclick={handleClearLocalData}>
          Clear Local Data
        </Button>
      </div>
    </section>
  </div>
</div>
