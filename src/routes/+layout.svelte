<script lang="ts">
import '../app.css';
import favicon from '$lib/assets/favicon.svg';
import ToastViewport from '$lib/ui/ToastViewport.svelte';

let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
<ToastViewport />
