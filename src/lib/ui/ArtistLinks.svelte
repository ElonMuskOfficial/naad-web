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
     not just plain rows — without it, clicking an artist would also fire the parent's own navigation.
     Keyed by index, not artist.id: the same artist can legitimately appear twice in one track's artist
     list (e.g. credited in two different roles) — a keyed each block needs a unique key regardless, and
     naad doesn't dedupe this array, so keying by id alone crashed the whole page (each_key_duplicate) the
     one time a search result actually had a repeated artist. -->
{#each artists as artist, i (i)}{#if i > 0}{i === artists.length - 1 ? ' & ' : ', '}{/if}<a
    href="/artist/{artist.id}"
    class="hover:text-ink hover:underline"
    onclick={(e) => e.stopPropagation()}>{artist.name}</a
  >{/each}
