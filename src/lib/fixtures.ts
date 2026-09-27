/**
 * Design-kit fixtures: real-shaped data (including long Devanagari titles) so the design system
 * is never reviewed against lorem ipsum. Backs `/kit` only — real screens use live engine data.
 */
import type { Album, Artist, Playlist, Track } from './types';

const img = (seed: string, size = 500): { url: string } => ({
  url: `https://picsum.photos/seed/${seed}/${size}`,
});

export const artists: Artist[] = [
  { id: 'art_weeknd', name: 'The Weeknd', images: [img('weeknd')] },
  { id: 'art_arijit', name: 'Arijit Singh', images: [img('arijit')] },
  { id: 'art_pritam', name: 'Pritam', images: [img('pritam')] },
  { id: 'art_amitabh', name: 'Amitabh Bhattacharya', images: [img('amitabh')] },
];

export const albums: Album[] = [
  {
    id: 'alb_01m34h8ahbb1vrn8v3nw2k0p2n',
    title: 'The Highlights',
    albumType: 'album',
    releaseDate: '2021-02-05',
    label: 'Republic Records',
    trackCount: 14,
    explicit: false,
    artists: [artists[0]!],
    images: [{ url: 'https://c.saavncdn.com/396/The-Highlights-English-2021-20240207045714-500x500.jpg' }],
  },
  {
    id: 'alb_01m34h87p5bh35km3rvpvt7r7y',
    title: 'Brahmastra',
    albumType: 'album',
    releaseDate: '2022-07-06',
    label: 'Sony Music Entertainment India',
    trackCount: 9,
    explicit: false,
    artists: [artists[2]!, artists[1]!],
    images: [
      {
        url: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg',
      },
    ],
  },
];

export const tracks: Track[] = [
  {
    id: '38845390',
    title: 'Blinding Lights',
    artists: [artists[0]!],
    album: { id: albums[0]!.id, title: albums[0]!.title, images: albums[0]!.images },
    durationMs: 200040,
    explicit: false,
    trackNumber: 9,
    images: [{ url: 'https://c.saavncdn.com/396/The-Highlights-English-2021-20240207045714-500x500.jpg' }],
    url: null,
  },
  {
    id: '456323',
    title: 'केसरिया',
    artists: [artists[2]!, artists[1]!, artists[3]!],
    album: { id: albums[1]!.id, title: albums[1]!.title, images: albums[1]!.images },
    durationMs: 268164,
    explicit: false,
    trackNumber: 3,
    images: [
      {
        url: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg',
      },
    ],
    url: null,
  },
  {
    id: 'trk_tumhiho',
    title: 'Tum Hi Ho',
    artists: [artists[1]!],
    album: null,
    durationMs: 262000,
    explicit: false,
    trackNumber: null,
    images: [img('tumhiho')],
    url: null,
  },
  {
    id: 'trk_longtitle',
    title:
      'A Very Long Track Title That Keeps Going And Going To See How The Layout Truncates Gracefully On Small Screens',
    artists: [artists[0]!, artists[2]!],
    album: null,
    durationMs: 312000,
    explicit: true,
    trackNumber: null,
    images: [],
    url: null,
  },
  {
    id: 'trk_noartwork',
    title: 'Not Yet Resolved',
    artists: [artists[3]!],
    album: null,
    durationMs: null,
    explicit: false,
    trackNumber: null,
    images: [],
    url: null,
  },
];

export const playlists: Playlist[] = [
  {
    id: 'pl_superhits',
    title: 'Hindi: India Superhits Top 50',
    description: 'By JioSaavn',
    origin: 'external',
    inLibrary: true,
    images: [img('superhits')],
    trackCount: 50,
  },
  {
    id: 'pl_roadtrip',
    title: 'Road Trip',
    description: null,
    origin: 'user',
    inLibrary: true,
    images: [],
    trackCount: 23,
  },
];
