import type { components } from './api/schema';

export type Track = components['schemas']['Track'];
export type TrackQuality = components['schemas']['TrackQuality'];
export type Source = components['schemas']['Source'];
export type Album = components['schemas']['Album'];
export type Artist = components['schemas']['Artist'];
export type ArtistRef = Track['artists'][number];
export type Image = Track['images'][number];
export type Playlist = components['schemas']['Playlist'];
export type Problem = components['schemas']['Problem'];
