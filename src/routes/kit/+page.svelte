<script lang="ts">
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
import BookmarkSimple from 'phosphor-svelte/lib/BookmarkSimple';
import MusicNotesSimple from 'phosphor-svelte/lib/MusicNotesSimple';
import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
import PlusCircle from 'phosphor-svelte/lib/PlusCircle';
import QueueIcon from 'phosphor-svelte/lib/Queue';
import TrashIcon from 'phosphor-svelte/lib/Trash';
import { albums, artists, playlists, tracks } from '$lib/fixtures';
import { Pause, Play, Repeat, Shuffle, SkipNext, SkipPrevious } from '$lib/icons';
import { theme } from '$lib/theme.svelte';
import { toast } from '$lib/toast.svelte';
import {
  Artwork,
  Button,
  EmptyState,
  IconButton,
  MediaCard,
  Menu,
  MenuItem,
  QualityBadge,
  Scrubber,
  Sheet,
  Shelf,
  Skeleton,
  TrackTable,
} from '$lib/ui';

let scrubValue = $state(83);
let menuOpen = $state(false);
let menuAnchor = $state<HTMLElement | null>(null);
let sheetOpen = $state(false);
let liked = $state(new Set<string>([tracks[1]!.id]));
let currentId = $state(tracks[0]!.id);
let playing = $state(true);

function toggleLike(id: string) {
  const next = new Set(liked);
  next.has(id) ? next.delete(id) : next.add(id);
  liked = next;
}
</script>

<svelte:head><title>Design kit — NAAD</title></svelte:head>

<div class="min-h-screen bg-surface-0 pb-32">
  <header class="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface-0 px-6 py-3">
    <div>
      <p class="text-2xs uppercase tracking-wider text-ink-faint">Phase A · Review 1</p>
      <h1 class="font-display text-lg text-ink">Design kit</h1>
    </div>
    <Button variant="outline" size="sm" onclick={() => theme.toggle()}>
      Theme: {theme.current}
    </Button>
  </header>

  <main class="mx-auto max-w-4xl space-y-16 px-6 py-10">
    <!-- ============================================================ Type ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Type</h2>
      <div class="space-y-3 border-y border-border py-6">
        <p class="font-display text-3xl text-ink">Signal &amp; Sleeve</p>
        <p class="font-display text-2xl text-ink">Now Playing title 56</p>
        <p class="font-display text-xl text-ink">Album hero title 36</p>
        <p class="font-display text-lg text-ink">Page title 24</p>
        <p class="text-md font-medium text-ink">Section header 18 — Jump back in</p>
        <p class="text-sm text-ink">Base UI text 15 — केसरिया से Blinding Lights तक, हर गाने की असली क्वालिटी.</p>
        <p class="text-xs text-ink-muted">Secondary text 13 — Republic Records · 2020-03-20 · 14 tracks</p>
        <p class="font-mono text-2xs uppercase tracking-wide text-ink-muted" data-numeric>Mono signal 12 — 03:24 / 04:32 · HI-RES · FLAC 24/96</p>
      </div>
    </section>

    <!-- ============================================================ Color ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Color</h2>
      <div class="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {#each [['surface-0', 'bg-surface-0'], ['surface-1', 'bg-surface-1'], ['surface-2', 'bg-surface-2'], ['surface-3', 'bg-surface-3'], ['ink', 'bg-ink'], ['ink-muted', 'bg-ink-muted'], ['accent', 'bg-accent'], ['danger', 'bg-danger']] as [name, cls] (name)}
          <div class="space-y-1.5">
            <div class="h-14 rounded-sm border border-border {cls}"></div>
            <p class="font-mono text-2xs text-ink-muted">{name}</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- ============================================================ Buttons ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Buttons</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="solid">Play</Button>
        <Button variant="outline">Follow</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Remove</Button>
        <Button variant="outline" size="sm">Small</Button>
        <Button variant="outline" disabled>Disabled</Button>
      </div>
      <div class="flex items-center gap-3">
        <IconButton variant="transport" size="lg" label="Play"><Play size={20} /></IconButton>
        <IconButton variant="transport" size="lg" label="Pause"><Pause size={20} /></IconButton>
        <IconButton variant="transport" size="md" label="Previous"><SkipPrevious size={16} /></IconButton>
        <IconButton variant="transport" size="md" label="Next"><SkipNext size={16} /></IconButton>
        <IconButton variant="tool" label="Shuffle" active><Shuffle size={16} /></IconButton>
        <IconButton variant="tool" label="Repeat"><Repeat size={16} /></IconButton>
        <IconButton variant="tool" label="Repeat one" active><Repeat size={16} mode="one" /></IconButton>
      </div>
    </section>

    <!-- ============================================================ Quality badges ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Quality readout — the signature element</h2>
      <div class="flex flex-wrap items-center gap-6 border-y border-border py-4">
        <QualityBadge audio={{ codec: 'aac', bitrateKbps: 320 }} />
        <QualityBadge audio={{ codec: 'aac', bitrateKbps: 160 }} />
        <QualityBadge audio={{ codec: 'aac', bitrateKbps: 320 }} onclick={() => toast.push('Quality badge clicked.')} />
      </div>
    </section>

    <!-- ============================================================ Artwork ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Artwork</h2>
      <div class="flex items-end gap-4">
        <Artwork src={albums[0]!.images[0]!.url} alt={albums[0]!.title} size={120} />
        <Artwork src={null} alt="Missing artwork" size={120} />
        <Artwork src={artists[0]!.images[0]!.url} alt={artists[0]!.name} size={80} radius="full" />
        <Artwork src={null} alt="Missing artist photo" size={80} radius="full" />
        <Artwork src={tracks[0]!.images[0]?.url} alt="" size={36} />
      </div>
    </section>

    <!-- ============================================================ Track table ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Track table — hover a row, real Devanagari, long titles</h2>
      <TrackTable
        {tracks}
        likedIds={liked}
        {currentId}
        {playing}
        onplay={(t) => {
          if (t.id === currentId) playing = !playing;
          else {
            currentId = t.id;
            playing = true;
          }
        }}
        onlike={(t) => toggleLike(t.id)}
        onmenu={(t, anchor) => {
          menuAnchor = anchor;
          menuOpen = true;
        }}
      />
    </section>

    <!-- ============================================================ Shelves ============================================================ -->
    <section class="space-y-8">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Shelves</h2>
      <Shelf title="Jump back in">
        {#each albums as a (a.id)}
          <MediaCard href="/album/{a.id}" title={a.title} subtitle={a.artists.map((x) => x.name).join(', ')} image={a.images[0]?.url} onplay={() => toast.push(`Playing ${a.title}`)} />
        {/each}
        {#each playlists as p (p.id)}
          <MediaCard href="/playlist/{p.id}" title={p.title} subtitle={p.description ?? `${p.trackCount} tracks`} image={p.images[0]?.url} onplay={() => toast.push(`Playing ${p.title}`)} />
        {/each}
      </Shelf>
      <Shelf title="Charts" subtitle="India · Updated hourly" href="/charts">
        {#each tracks.slice(0, 4) as t, i (t.id)}
          <MediaCard href="/album/{t.album?.id ?? ''}" title={t.title} subtitle={t.artists.map((x) => x.name).join(', ')} image={t.images[0]?.url} rank={i + 1} onplay={() => toast.push(`Playing ${t.title}`)} />
        {/each}
      </Shelf>
      <Shelf title="Artists">
        {#each artists as a (a.id)}
          <MediaCard href="/artist/{a.id}" title={a.name} subtitle="Artist" image={a.images[0]?.url} shape="circle" />
        {/each}
      </Shelf>
    </section>

    <!-- ============================================================ Scrubber ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Scrubber</h2>
      <div class="max-w-md border-y border-border py-6">
        <Scrubber bind:value={scrubValue} duration={200} buffered={140} />
      </div>
    </section>

    <!-- ============================================================ Menu / Sheet / Toast ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Menu, sheet, toast</h2>
      <div class="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onclick={(e: MouseEvent) => {
            menuAnchor = e.currentTarget as HTMLElement;
            menuOpen = true;
          }}
        >
          Open menu
        </Button>
        <Button variant="outline" onclick={() => (sheetOpen = true)}>Open sheet</Button>
        <Button variant="outline" onclick={() => toast.push('Added to Liked Songs.')}>Toast: default</Button>
        <Button variant="outline" onclick={() => toast.push('Could not reach the engine.', { tone: 'danger' })}>Toast: error</Button>
        <Button
          variant="outline"
          onclick={() => toast.push('Removed from playlist.', { action: { label: 'Undo', onClick: () => toast.push('Restored.') } } as never)}
        >
          Toast: with action
        </Button>
      </div>
    </section>

    <!-- ============================================================ Empty / loading ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Empty &amp; loading states</h2>
      <div class="grid gap-6 sm:grid-cols-2">
        <div class="border border-border">
          <EmptyState
            title="No liked songs yet"
            description="Songs you like will show up here."
            action={{ label: 'Find something to play', onClick: () => toast.push('→ /search') }}
          >
            {#snippet icon()}<MusicNotesSimple size={28} weight="light" />{/snippet}
          </EmptyState>
        </div>
        <div class="space-y-3 border border-border p-4">
          {#each [1, 2, 3] as i (i)}
            <div class="flex items-center gap-3">
              <Skeleton width="36px" height="36px" radius="sm" />
              <div class="flex-1 space-y-1.5">
                <Skeleton width="{60 - i * 8}%" height="14px" />
                <Skeleton width="{40 - i * 5}%" height="11px" />
              </div>
              <Skeleton width="32px" height="11px" />
            </div>
          {/each}
        </div>
      </div>
    </section>
  </main>
</div>

<Menu bind:open={menuOpen} anchor={menuAnchor}>
  {#snippet children()}
    <MenuItem onSelect={() => toast.push('Added to queue.')}>
      {#snippet icon()}<QueueIcon size={16} />{/snippet}
      Add to queue
    </MenuItem>
    <MenuItem onSelect={() => toast.push('Added to playlist.')}>
      {#snippet icon()}<PlusCircle size={16} />{/snippet}
      Add to playlist
    </MenuItem>
    <MenuItem onSelect={() => toast.push('Saved.')}>
      {#snippet icon()}<BookmarkSimple size={16} />{/snippet}
      Save to library
    </MenuItem>
    <MenuItem onSelect={() => toast.push('Rename started.')}>
      {#snippet icon()}<PencilSimple size={16} />{/snippet}
      Rename playlist
    </MenuItem>
    <MenuItem danger onSelect={() => toast.push('Removed.', { tone: 'danger' })}>
      {#snippet icon()}<TrashIcon size={16} />{/snippet}
      Remove
    </MenuItem>
  {/snippet}
</Menu>

<Sheet bind:open={sheetOpen} title="Signal path" description="Kesariya — currently playing">
  <dl class="space-y-3 text-sm">
    <div class="flex items-center justify-between">
      <dt class="text-ink-muted">Source</dt>
      <dd class="font-mono text-xs" data-numeric>monochrome</dd>
    </div>
    <div class="flex items-center justify-between">
      <dt class="text-ink-muted">Format</dt>
      <dd class="font-mono text-xs" data-numeric>FLAC, 24-bit / 96.0 kHz</dd>
    </div>
    <div class="flex items-center justify-between">
      <dt class="text-ink-muted">Delivery</dt>
      <dd class="font-mono text-xs" data-numeric>redirect</dd>
    </div>
    <div class="flex items-center justify-between">
      <dt class="text-ink-muted">Normalization</dt>
      <dd class="font-mono text-xs" data-numeric>−2.1 dB (−11.4 LUFS)</dd>
    </div>
  </dl>
  <div class="mt-4 flex items-center gap-2 text-ink-faint">
    <ArrowsClockwise size={14} />
    <span class="text-xs">Re-checked 2 minutes ago</span>
  </div>
</Sheet>
