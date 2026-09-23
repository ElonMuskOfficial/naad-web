import type { Track } from './types';

class TrackMenuStore {
  open = $state(false);
  anchor = $state<HTMLElement | null>(null);
  track = $state<Track | null>(null);

  // Playlist selection sheet/modal state
  playlistModalOpen = $state(false);
  targetTrackForPlaylist = $state<Track | null>(null);

  openFor(track: Track, anchor: HTMLElement) {
    this.track = track;
    this.anchor = anchor;
    this.open = true;
  }

  close() {
    this.open = false;
    this.anchor = null;
    this.track = null;
  }

  openAddToPlaylist(track: Track) {
    this.close();
    this.targetTrackForPlaylist = track;
    this.playlistModalOpen = true;
  }

  closePlaylistModal() {
    this.playlistModalOpen = false;
    this.targetTrackForPlaylist = null;
  }
}

export const trackMenu = new TrackMenuStore();
