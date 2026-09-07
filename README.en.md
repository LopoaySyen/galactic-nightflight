# Galactic Nightflight · 银河夜航

[中文说明](README.md) · [Source repository](https://github.com/LopoaySyen/galactic-nightflight)

A three-dimensional Milky Way observatory with a quiet, photographic introduction. Change your observing position, advance time, search the loaded catalogues and inspect stars and deep-sky objects.

## Pages and controls

- `/en`: English introduction, content navigation and feature descriptions.
- `/`: Chinese introduction, with the same sections and feature controls.
- `/observe`: the full-screen observatory. Its controls and tutorial currently use Chinese.
- `/logos`: the selected Starboat logo and the original alternatives.

The homepage has four sections: About, Features, Getting started and Source. Natural scrolling and navigation links drive one continuous photographic and star-flight scene. It has no automatic slideshow or photographic style selector. Feature controls are named Explore space, Move through time, Light & atmosphere and Find objects, with mouse and keyboard support.

Motion can be paused and respects reduced-motion preferences. Drawing stops when the document is hidden or the homepage unmounts. Homepage effects are artistic and do not alter observatory calculations. The 6000-pixel Milky Way and 4000-pixel Orion and Andromeda photographs retain their credits.

The observatory includes position presets, separate direction controls, a galactic-centre tracking switch, forward/reverse time, atmosphere and visual-response settings, object selection and catalogue search. First-time visitors receive a seven-step tutorial, which can be reopened from the bottom toolbar.

## Scientific scope

The project combines a measured bright-star catalogue and a Gaia DR3 bright-star subset with a statistical stellar population, a three-dimensional dust model and integrated galactic light. Observer position affects stellar directions, distances and brightness. Model estimates and photographic overlays are distinguished from observations.

This is an interactive approximation, not a fully calibrated astronomical prediction tool. Stellar motion uses linear extrapolation; observer orbits, atmospheric appearance and sensory response remain approximate. Catalogue completeness, uniform passbands and a consistent absolute light budget have not been fully calibrated. Deep-sky photographs do not contain complete three-dimensional internal structure. Artistic terrain is a hypothetical environment.

See [scientific and display notes](public/data/SCIENCE_DISPLAY_UPDATE.md) and the source records in `public/data` for details and limitations.

## Run locally

Requires Node.js 22.13 or later and a Bash-capable environment, such as Linux or Windows Subsystem for Linux.

```bash
npm ci
npm run dev
```

The development server prints its local address. The snapshot includes the catalogue subsets and images needed to run; no astronomy-service API key or database is required.

```bash
npm run typecheck
npm run build
node --test tests/*.test.mjs
```

Build output is placed in `dist` and targets Cloudflare Workers. The public hosting configuration contains generic bindings only, without the original live site's identity. The export script can create a fresh snapshot outside the checkout:

```bash
node scripts/export-public-source.mjs /absolute/path/to/new-directory
```

## License and attribution

Original project code uses the [MIT License](LICENSE). Commercial use requires no separate author approval. Include the copyright and permission notices in all copies or substantial portions of the Software. Third-party data and imagery retain their own terms.

Author: [LopoaySyen](https://github.com/LopoaySyen). Source: [Galactic Nightflight](https://github.com/LopoaySyen/galactic-nightflight).

See [NOTICE](NOTICE), [usage and citation guidance](COMMERCIAL-LICENSING.md) and [third-party notices](THIRD_PARTY_NOTICES.md). Third-party data, photographs and dependencies retain their own terms. The full LICENSE controls the grant and its conditions.
