import type { components } from './api/schema';

export type Track = components['schemas']['Track'];
export type Album = components['schemas']['Album'];
export type Artist = components['schemas']['Artist'];
export type ArtistRef = Track['artists'][number];
export type Image = Track['images'][number];
export type Playlist = components['schemas']['Playlist'];
export type Audio = components['schemas']['Audio'];
export type Section = components['schemas']['Section'];
export type Problem = components['schemas']['Problem'];
