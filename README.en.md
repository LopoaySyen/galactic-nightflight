<div align="center">

<a href="https://nightflight.xelope.fun/en">
  <img src="public/brand/logo-starboat.webp" width="112" alt="Galactic Nightflight — Starboat logo" />
</a>

# Galactic Nightflight

**银河夜航**

### One galaxy. Countless skies.

What would the stars look like from a planet elsewhere in the Milky Way?

**[Visit the website](https://nightflight.xelope.fun/en) · [Open the observatory](https://nightflight.xelope.fun/observe) · [中文](README.md)**

In your browser · Three-dimensional travel · Observed catalogues and models · MIT licensed

</div>

[![Milky Way panorama by ESO/S. Brunier](public/brand/milky-way-1920.webp)](https://nightflight.xelope.fun/en)

<sub>Milky Way photograph used on the project homepage · © ESO/S. Brunier · <a href="https://www.eso.org/public/images/eso0932a/">Original image</a> · Creative Commons Attribution 4.0 (CC BY 4.0)</sub>

---

**[About](#about) · [Interface in action](#interface-in-action) · [Features](#features) · [Start observing](#start-observing) · [Data and models](#data-and-models) · [Run locally](#run-locally) · [Contribute](#contribute) · [License](#license)**

## About

Galactic Nightflight is a three-dimensional sky simulator built around the observer's position. Stay near the Sun to find familiar stars, travel into the inner disc, move to the outskirts, or rise above the galactic plane and look back.

As you move, the application recalculates each object's direction, distance and brightness from its position relative to you. Integrated galactic light and dust extinction are also recomputed for the observing location. Twilight, atmosphere and visual-response settings determine how that sky appears.

Observed data, statistical models and artistic assets are identified separately. The project is intended for exploration and visual understanding; it remains an interactive approximation. See [scientific scope](#scientific-scope-and-limitations) for the practical limits.

| Online entry | What you will find |
| --- | --- |
| **[nightflight.xelope.fun](https://nightflight.xelope.fun/)** | Chinese homepage, the project's default language |
| [English homepage](https://nightflight.xelope.fun/en) | Introduction and star-flight navigation in English |
| [Open the observatory](https://nightflight.xelope.fun/observe) | Full-screen sky and observing tools; controls currently use Chinese |
| [Alternative address](https://galactic-sky-physics.blush-eel-3740.chatgpt.site/) | The same website at its original hosting address |

The website is publicly accessible. No installation is required.

## Interface in action

These screenshots show the current application in use. Observatory controls are in Chinese; the instructions below identify the corresponding controls.

The website’s Getting started section includes recorded demonstrations. Only the visible, selected demo plays, with a still-image option: [Look around](public/guide/look.gif) · [Change position](public/guide/move.gif) · [Find an object](public/guide/inspect.gif).

### Move to another part of the galaxy

Open “位置跳转” at the bottom and choose “内银河” (Inner galaxy). The screenshot shows the completed jump: six presets appear on the right, and the observer coordinates have changed at the lower left. Position controls determine where you are; the left-hand direction buttons determine where you look.

[![Position jump: Inner galaxy selected, with updated observer coordinates and sky](public/guide/position-jump.jpg)](public/guide/position-jump.jpg)

### Adjust atmosphere and display brightness

Open “观察” and scroll to “显示曝光” (Display exposure) and “行星大气” (Planetary atmosphere). Adjust display brightness, choose space, clear sky or haze, and set the horizon tilt. Twilight controls are further down the panel.

[![Observation settings: display-exposure slider, three atmosphere options and horizon tilt](docs/images/atmosphere.jpg)](docs/images/atmosphere.jpg)

### Search for a star and inspect its data

Select “搜索天体” on the left and enter “天狼” to find Sirius. Choosing the result centres the star and opens its measured catalogue information: identifiers, distance, magnitude, estimated temperature and distance from the current observer.

<table>
  <tr>
    <td width="50%"><strong>Enter a name and find the object</strong></td>
    <td width="50%"><strong>Locate it and inspect its data</strong></td>
  </tr>
  <tr>
    <td><a href="docs/images/object-search.jpg"><img src="docs/images/object-search.jpg" width="480" alt="Searching for Sirius by its Chinese name returns its catalogue identity" /></a></td>
    <td><a href="public/guide/star-details.jpg"><img src="public/guide/star-details.jpg" width="480" alt="Sirius selected with observed catalogue data and current distance in the side panel" /></a></td>
  </tr>
</table>

Click either image to read it at full size. Search also accepts English names and identifiers from loaded catalogues.

### Explore a nebula and its image source

In “观察”, choose “猎户座大星云 · 特写” (Orion Nebula close-up). The camera view opens with the object's distance, alternative names and a link to the original image. Catalogue targets also include star clusters and galaxies.

[![Orion Nebula camera close-up with object distances and photographic source information](docs/images/nebula-details.jpg)](docs/images/nebula-details.jpg)

<sub>Nebula imagery in the screenshot: © ESO/G. Beccari · <a href="https://www.eso.org/public/images/eso1723a/">Original photograph</a> · Creative Commons Attribution 4.0 (CC BY 4.0). Photographic colours in the camera close-up do not represent naked-eye vision.</sub>

## Features

| Feature | What it does |
| --- | --- |
| **Travel through space** | Jump between six presets or adjust your position with the galactic map and distance controls. Stars are reprojected individually. |
| **Look and track** | Drag the sky, change the field of view and look toward the galactic centre, outskirts or poles. Centre lock keeps your view directed at the centre as you move. |
| **Advance time** | Play, pause or reverse motion at 1–100,000 simulated years per real second. Optionally let the observer follow an approximate orbit. |
| **Set the atmosphere** | Choose space, a clear Earth-like atmosphere or light haze. Adjust the local illuminating star's altitude and azimuth to compare night, twilight and day. |
| **Change visual response** | Compare naked-eye, dark-adapted, visible-camera and near-infrared displays. Photographic overlays and immersive enhancement have separate controls. |
| **Find objects** | Search loaded objects by name or catalogue identifier. Select observed stars, nebulae, clusters and galaxies to inspect available data and sources. |
| **Observe without clutter** | Collapse panels, explore a full-screen sky and see terrain projected with the camera. A repeatable tutorial introduces the controls. |

Scrolling and navigation on the homepage drive a continuous star-flight scene. Motion can be paused and respects the system's reduced-motion preference. Homepage photography and effects serve the project introduction.

## Start observing

1. **Open the observatory and follow the guide.** The [observatory](https://nightflight.xelope.fun/observe) offers a seven-step tutorial on first visit. Reopen it with “新手教程” in the bottom toolbar.
2. **Change position and compare the sky.** Open “位置跳转” and move from the solar neighbourhood to the inner disc or above the plane. Buttons on the left change where you look; the position panel changes where you are.
3. **Choose your observing conditions.** Open “观察” to adjust visual response, twilight and atmosphere. Start with time paused to compare parallax, then play to explore motion.

### Six starting points

| Preset / interface label | What to explore |
| --- | --- |
| **Solar neighbourhood / 太阳邻域** | Begin with a familiar sky; search and inspect observed stars. |
| **Inner galaxy / 内银河** | Move inward and compare the directions and brightness of nearby stars. |
| **Near the bulge / 核球附近** | Look into the central region from slightly above the plane. |
| **Outer disc / 外盘深处** | Look back from the outskirts and compare foreground stars with integrated light. |
| **Above the plane / 盘面上方** | Leave the disc and examine the galactic band's shape and dust obscuration. |
| **Far side / 银河对侧** | Observe from the opposite side of the Sun's galactic position. |

These presets define galactic coordinates. The planetary terrain is a hypothetical observing environment.

### Common controls

| Input | Action |
| --- | --- |
| Hold and drag the sky / touch and drag | Turn the view |
| Mouse wheel | Change the field of view |
| Click a queryable object | Open stellar or deep-sky information |
| `/` | Open object search |
| `Esc` | Close search or object selection |
| Arrow keys, `+` / `-` | Turn or zoom while the sky canvas has focus |
| “锁定中心” | Track the galactic centre during travel or time playback |
| “新手教程” | Reopen the tutorial; completion is saved in the current browser |

Turn off centre lock to look freely. If you cannot find an object, check whether it is in the loaded catalogue and above the current horizon.

## Observational imagery

Credited astronomical photographs appear on the homepage and as optional overlays for selected deep-sky objects. The observatory projects these images at each object's direction and angular scale. The gallery below shows observational assets used by the project.

<table>
  <tr>
    <td width="50%"><a href="https://www.eso.org/public/images/eso1723a/"><img src="public/deep-sky/orion-nebula-wide.jpg" width="480" alt="Observational photograph of the Orion Nebula" /></a></td>
    <td width="50%"><a href="https://esahubble.org/images/heic1502b/"><img src="public/deep-sky/andromeda-wide.jpg" width="480" alt="Observational photograph of the Andromeda Galaxy" /></a></td>
  </tr>
  <tr>
    <td><strong>Orion Nebula</strong><br />© ESO/G. Beccari · CC BY 4.0</td>
    <td><strong>Andromeda Galaxy</strong><br />NASA, ESA, Digitized Sky Survey 2<br />Acknowledgement: Davide De Martin · CC BY 4.0</td>
  </tr>
</table>

Exposure, observing bands and display processing affect photographic colours. These colours do not directly represent naked-eye vision. See [third-party notices](THIRD_PARTY_NOTICES.md) for the full credits and terms.

## Data and models

The program first subtracts the observer's position from each object's position to obtain a relative direction and distance. Stellar luminosity, intervening dust, observing conditions and camera orientation then determine the rendered sky.

| Component | Current content | Basis and role |
| --- | --- | --- |
| **Observed bright stars** | 7,369 stars with usable distances | A processed Yale Bright Star Catalogue subset with Hipparcos distances fills the bright end. [Provenance](public/data/bright-star-catalog-source.json). |
| **Gaia observations** | 69,421 stars | A bright subset of Gaia Data Release 3 (DR3), with three position and three velocity components. [Selection and provenance](public/data/gaia-dr3-bright-6d-source.json). |
| **Statistical model stars** | 73,728 fixed sources | Parameterized thin disc, thick disc, bar and bulge, nuclear region and stellar halo populations retain positions and velocities. [Implementation](lib/rendering/model-star-catalog.ts). |
| **Integrated light and dust** | Three-dimensional emission and absorption integration | Accumulates unresolved starlight along each viewing ray, including dust absorption and reddening. [Implementation](lib/rendering/galaxy-radiance.ts). |
| **Extragalactic objects** | Nearby-galaxy catalogue and 2,048 statistical background galaxies | Catalogue targets have observational sources; statistical background objects are not individually identified real galaxies. [Catalogue](lib/rendering/extragalactic-catalog.ts). |
| **Imagery and terrain** | Astronomical photographs, generated logos and rocky landscapes | Photographs supply image layers; terrain represents a hypothetical planetary environment. [Asset notices](THIRD_PARTY_NOTICES.md). |

These figures describe the current catalogues or models, not the number visible in a particular view or a complete inventory of the Milky Way. Model stars are statistical samples and do not establish real stellar identities.

### Scientific scope and limitations

- **Coverage is limited.** Observational subsets and parameterized models are used. Galaxy-wide source counts, consistent observing bands and an absolute light budget have not been fully calibrated.
- **Motion is a preview.** Stars are extrapolated from fixed initial velocities; observer orbits use an approximate gravitational potential. Long runs are not precise individual stellar-orbit predictions.
- **Atmosphere and response are approximate.** Earth-like atmosphere, dark adaptation and camera response support comparisons. They do not reproduce a specific site's weather or a calibrated camera. The near-infrared display is not human colour vision.
- **Deep-sky photographs remain two-dimensional.** Object centres are reprojected as the observer moves, but the photographs cannot reconstruct full internal structure from arbitrary viewpoints.
- **Strict scientific checks are separate from the preview.** The repository retains stronger scientific-data requirements. A working interactive scene does not mean all high-precision requirements have been met.

Read more: [science and display notes](public/data/SCIENCE_DISPLAY_UPDATE.md) · [data directory](public/data) · [third-party sources](THIRD_PARTY_NOTICES.md).

## Run locally

Install **Node.js 22.13 or later** and npm. Build scripts require Bash and GNU `timeout`; Linux or Windows Subsystem for Linux (WSL) is recommended. Other systems need equivalent commands available first.

~~~bash
git clone https://github.com/LopoaySyen/galactic-nightflight.git
cd galactic-nightflight
npm ci
npm run dev
~~~

The development server prints its local address. Required catalogue subsets and images are included; no astronomy-service key or database is needed.

### Check and build

~~~bash
npm run typecheck
npm run test:core
npm run build
node --test tests/*.test.mjs
~~~

The final command includes checks of built output, so run it after the build. Alternatively, `npm test` builds the project and runs all tests.

### Project structure

| Location | Contents |
| --- | --- |
| [`app/`](app) | Chinese and English homepages, full-screen observatory and interface |
| [`lib/physics/`](lib/physics) | Coordinates, distance, photometry, dust and dynamics |
| [`lib/observation/`](lib/observation) | Human vision, camera response and light-travel calculations |
| [`lib/rendering/`](lib/rendering) | Projection, catalogues, image compositing, background computation and GPU drawing |
| [`lib/landing/`](lib/landing) | Homepage copy, navigation and star-flight effects |
| [`public/`](public) | Catalogues, provenance, logos, photographs and terrain |
| [`tests/`](tests) | Physics, interaction logic, architecture and built-output checks |
| [`scripts/`](scripts) | Data generation, builds and public-source export tools |

The interface uses React and TypeScript. Vite / vinext handle development and builds, with production output targeting Cloudflare Workers. Build output is written to `dist`. The public hosting configuration contains generic settings; configure your own hosting project and domain when deploying independently.

<details>
<summary>Maintainers: export a public source snapshot</summary>

~~~bash
node scripts/export-public-source.mjs /absolute/path/to/new-directory
~~~

The exporter excludes dependency caches, build output, private history and the original site's identity, and checks for common credential formats. Use a new directory outside the checkout.

</details>

## Contribute

Report problems through [Issues](https://github.com/LopoaySyen/galactic-nightflight/issues) or submit improvements. For rendering or performance reports, include your browser and device, observer position, visual-response and atmosphere settings, and steps to reproduce. For time-playback issues, include the rate and simulated time too.

When contributing astronomical data or imagery, include its source, license, units, coordinate system and coverage. Changes to physics or projection should include numerical evidence or a test that verifies the result.

Author: [LopoaySyen](https://github.com/LopoaySyen) · Project citation: [CITATION.cff](CITATION.cff)

## License

Original code is released under the **[MIT License](LICENSE)**. Use, modification, distribution and commercial use require no separate author permission. Keep the copyright and permission notices in all copies or substantial portions of the software.

Third-party catalogues, photographs and dependencies retain their own licenses. Check their source terms before reuse or redistribution.

[Copyright and attribution](NOTICE) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Usage and citation guidance](COMMERCIAL-LICENSING.md)

---

<div align="center">

**[Start observing ↗](https://nightflight.xelope.fun/observe)**

[中文](README.md) · [English](README.en.md)

</div>
