<script lang="ts">
import type { ArtistRef } from '$lib/types';

interface Props {
  artists: ArtistRef[];
}

let { artists }: Props = $props();
</script>

<!-- Same "A, B & C" convention as joinArtists() (see $lib/format), just as individual links instead of
     one plain string — one <a> per artist so each credit on a track/album goes to that artist's own page,
     the same pattern already used on the album page's own hero byline. stopPropagation makes this safe to
     drop into a row/card that has its own click-to-navigate handler (e.g. the search page's Top Result),
     not just plain rows — without it, clicking an artist would also fire the parent's own navigation. -->
{#each artists as artist, i (artist.id)}{#if i > 0}{i === artists.length - 1 ? ' & ' : ', '}{/if}<a
    href="/artist/{artist.id}"
    class="hover:text-ink hover:underline"
    onclick={(e) => e.stopPropagation()}>{artist.name}</a
  >{/each}
