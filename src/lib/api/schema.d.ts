/**
 * Hand-written to match `naad`'s real JSON responses exactly. `naad` has no OpenAPI document to
 * generate this from (see naad-web/HANDOFF.md and naad/README.md) — every shape below was verified
 * directly against naad's source, not assumed or carried over from the old naad-v3-era file this
 * replaces. Routes naad does not have (imports, resolve, stream, mixes, charts, new-releases, queue,
 * /tracks/{id}/play) are intentionally absent, as is every multi-provider field naad never sends
 * (Source/tier/delivery/normalization/alternatives, Track.quality/isrc/versionTags/discNumber/liked/
 * links, Album.upc).
 * `/v1/art` is a real route too, but is deliberately absent: it's only ever used to build a raw `<img src>` URL string (see `src/lib/art.ts`), never called through this typed client.
 */

export interface paths {
  "/v1/home": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": { sections: components["schemas"]["Section"][] } };
        };
      };
    };
  };
  "/v1/search": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query: { q: string; types?: string; limit?: number; offset?: number };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              topResult:
                | { type: "track"; item: components["schemas"]["Track"] }
                | { type: "album"; item: components["schemas"]["Album"] }
                | { type: "artist"; item: components["schemas"]["Artist"] }
                | null;
              tracks: components["schemas"]["Track"][];
              albums: components["schemas"]["Album"][];
              artists: components["schemas"]["Artist"][];
              playlists: components["schemas"]["Playlist"][];
              nextOffset: number | null;
            };
          };
        };
      };
    };
  };
  "/v1/tracks/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": components["schemas"]["Track"] };
        };
      };
    };
  };
  "/v1/tracks/{id}/audio": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: {
        query?: { quality?: "max" | "320" | "160" | "96"; refresh?: boolean };
        header?: never;
        path: { id: string };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": components["schemas"]["Audio"] };
        };
      };
    };
  };
  "/v1/tracks/{id}/lyrics": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              trackId: string;
              synced: { timeMs: number; text: string }[] | null;
              plain: string | null;
              source: string;
            };
          };
        };
      };
    };
  };
  "/v1/albums/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": components["schemas"]["Album"] & {
              tracks: components["schemas"]["Track"][];
            };
          };
        };
      };
    };
  };
  "/v1/artists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": components["schemas"]["Artist"] & {
              topTracks: components["schemas"]["Track"][];
              albums: components["schemas"]["Album"][];
              singles: components["schemas"]["Album"][];
              related: components["schemas"]["Artist"][];
            };
          };
        };
      };
    };
  };
  "/v1/playlists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number };
        header?: never;
        path: { id: string };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": components["schemas"]["Playlist"] };
        };
      };
    };
    patch: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: {
        content: { "application/json": { title?: string; description?: string | null } };
      };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/playlists": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: {
        content: {
          "application/json": { title: string; description?: string | null; trackIds?: string[] };
        };
      };
      responses: {
        201: { headers: { [name: string]: unknown }; content: { "application/json": { id: string } } };
      };
    };
  };
  "/v1/playlists/{id}/items": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: {
        content: { "application/json": { trackIds: string[]; position?: "start" | "end" } };
      };
      responses: {
        201: {
          headers: { [name: string]: unknown };
          content: { "application/json": { itemIds: string[] } };
        };
      };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: { content: { "application/json": { itemIds: string[] } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/playlists/{id}/items/{itemId}/move": {
    parameters: { query?: never; header?: never; path: { id: string; itemId: string }; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path: { id: string; itemId: string }; cookie?: never };
      requestBody: { content: { "application/json": { afterItemId: string | null } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/tracks": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { likedAt: string; track: components["schemas"]["Track"] }[];
              next: string | null;
            };
          };
        };
      };
    };
    put: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { trackIds: string[] } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { trackIds: string[] } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/tracks/contains": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query: { ids: string }; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: { headers: { [name: string]: unknown }; content: { "application/json": boolean[] } };
      };
    };
  };
  "/v1/library/albums": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { savedAt: string; album: components["schemas"]["Album"] }[];
              next: string | null;
            };
          };
        };
      };
    };
  };
  "/v1/library/albums/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    put: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/artists": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { followedAt: string; artist: components["schemas"]["Artist"] }[];
              next: string | null;
            };
          };
        };
      };
    };
  };
  "/v1/library/artists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    put: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/playlists": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": { items: components["schemas"]["Playlist"][] } };
        };
      };
    };
  };
  "/v1/library/playlists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    put: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/export": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              exportedAt: string;
              likedTracks: { likedAt: string; track: components["schemas"]["Track"] }[];
              savedAlbums: { savedAt: string; album: components["schemas"]["Album"] }[];
              followedArtists: { followedAt: string; artist: components["schemas"]["Artist"] }[];
              savedPlaylists: { savedAt: string; playlist: components["schemas"]["Playlist"] }[];
              playlists: (components["schemas"]["Playlist"] & {
                items: { itemId: string; addedAt: string; track: components["schemas"]["Track"] }[];
              })[];
              history: { playedAt: string; msPlayed: number; track: components["schemas"]["Track"] }[];
            };
          };
        };
      };
    };
  };
  "/v1/history": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { playedAt: string; msPlayed: number; track: components["schemas"]["Track"] }[];
              next: string | null;
            };
          };
        };
      };
    };
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: {
        content: {
          "application/json": {
            listens: {
              trackId: string;
              startedAt: string;
              msPlayed: number;
              completed?: boolean;
              context?: { type: string; id: string } | null;
              sourceProvider?: string;
            }[];
          };
        };
      };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/player/prefetch": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { trackIds: string[] } } };
      responses: {
        202: {
          headers: { [name: string]: unknown };
          content: { "application/json": { accepted: number } };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    Image: { url: string; width?: number; height?: number };
    ArtistRef: { id: string; name: string };
    /** The real, flat shape of `GET /v1/tracks/{id}/audio` — naad's only playback endpoint. */
    Audio: {
      trackId: string;
      url: string;
      bitrateKbps: number;
      codec: string;
      mimeType: string;
      durationMs: number | null;
    };
    Track: {
      id: string;
      title: string;
      artists: components["schemas"]["ArtistRef"][];
      album: { id: string; title: string; images: components["schemas"]["Image"][] } | null;
      durationMs: number | null;
      explicit: boolean;
      /** Null for most tracks; set to a real 1-based position for album tracks (naad/lib/jiosaavn/client.js's `getAlbum`, via `trackView`'s `over` parameter). */
      trackNumber: number | null;
      images: components["schemas"]["Image"][];
      /** JioSaavn's own `perma_url`. */
      url: string | null;
    };
    /** No `tracks` field here — only `GET /v1/albums/{id}` adds it (see the `paths` entry above). */
    Album: {
      id: string;
      title: string;
      albumType: "single" | "album";
      releaseDate: string | null;
      label: string | null;
      trackCount: number;
      explicit: boolean;
      artists: components["schemas"]["ArtistRef"][];
      images: components["schemas"]["Image"][];
    };
    Artist: {
      id: string;
      name: string;
      images: components["schemas"]["Image"][];
    };
    /**
     * `entries` is only present on the direct `GET /v1/playlists/{id}` response for the user's own
     * (`usr_…`) playlists. `tracks` is present there too, but ALSO for an external (JioSaavn) playlist
     * fetched by id — only `entries` distinguishes "this is the user's own." `origin`/`inLibrary` are
     * present on `GET /v1/library/playlists`, and on a `usr_…` or external playlist fetched directly by
     * id — i.e. everywhere except a playlist embedded in a search result or a home-feed section.
     */
    Playlist: {
      id: string;
      title: string;
      description: string | null;
      trackCount: number;
      images: components["schemas"]["Image"][];
      tracks?: components["schemas"]["Track"][];
      entries?: { itemId: string; addedAt: string }[];
      origin?: "user" | "external";
      inLibrary?: boolean;
    };
    /** A home shelf item, tagged with its own kind — a section mixes kinds in JioSaavn's own order,
     *  just like JioSaavn's homepage itself does (never split into one shelf per kind). */
    SectionItem:
      | { kind: "track"; item: components["schemas"]["Track"] }
      | { kind: "album"; item: components["schemas"]["Album"] }
      | { kind: "artist"; item: components["schemas"]["Artist"] }
      | { kind: "playlist"; item: components["schemas"]["Playlist"] };
    Section: {
      id: string;
      title: string;
      subtitle?: string;
      items: components["schemas"]["SectionItem"][];
    };
    /** naad's plain Fastify error body: `{ statusCode, error, message }`. See `client.ts`'s `ApiError`. */
    Problem: {
      statusCode: number;
      error: string;
      message: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
