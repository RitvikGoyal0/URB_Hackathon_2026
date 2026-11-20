# Listing photos: checklist for the team

The app never scrapes or copies listing photos. Every image must be one **a team member took** or one we have **written permission** to use. Until a listing has photos, its card shows a neutral "Photo coming soon" block. That is the honest default, so leaving a listing without photos is fine.

## How to add photos for a listing

1. Make a folder `public/listings/<listing id>/` (ids are in the table below).
2. Name files in display order: `01-exterior.jpg`, `02-living.jpg`, `03-kitchen.jpg`, … JPEG or WebP, long edge 2000 px or less, ideally under 500 KB each.
3. Add `public/listings/<listing id>/credits.json` with one entry per file:

   ```json
   [
     { "file": "01-exterior.jpg", "type": "exterior", "attribution": "Photo: <team member>", "rights": "team-owned" },
     { "file": "02-living.jpg", "type": "interior", "attribution": "Photo: <property manager>, used with permission", "rights": "permission" }
   ]
   ```

   - `type`: `exterior`, `interior`, `kitchen`, `bedroom`, `bathroom` or `amenity`
   - `rights`: `team-owned` (we took it) or `permission` (keep the written OK, e.g. the email, in the team drive)
   - `attribution` is shown as a small caption under the photo.
4. Run `npm run photos`. It reads every `credits.json`, writes `src/data/listing-photos.json` (the list the app uses), and prints any entry it skipped and why (missing file, wrong rights, over 2 MB, …). `npm run check` fails if you forget this step.
5. Commit the folder and `src/data/listing-photos.json`. A file without a `credits.json` entry is not shown.

Please don’t:
- save images from offcampushousing.umich.edu, Zillow, apartments.com or a property’s website without written permission
- photograph people, or the inside of a home without the residents’ OK
- add AI-generated or "representative" photos to a real address

## Listings (22, observed 2026-11-20)

| Listing id | Name | Address | BR | Source |
|---|---|---|---|---|
| `um_packard_5br` | 1532 Packard St, 5BR House | 1532 Packard St, Ann Arbor, MI 48104 | 5 | [listing](https://offcampushousing.umich.edu/listing/1532-packard-st-108752) |
| `geddes_4br` | Haven on Geddes — 4BR Home | 1700 Geddes Avenue, Ann Arbor, MI 48104 | 4 | [listing](https://www.havenongeddes.com/ann-arbor/haven-on-geddes/student/) |
| `um_broadway_4br` | 1417 Broadway, 4BR Duplex (North Campus) | 1417 Broadway St, Ann Arbor, MI 48105 | 4 | [listing](https://offcampushousing.umich.edu/listing/1417-broadway-quiet-spacious-room-near-hospital-north-campus-230748) |
| `um_courtyards_4br` | The Courtyards — 4x4 Apartment (per-bed lease) | 1780 Broadway Street, Ann Arbor, MI 48105 | 4 | [listing](https://offcampushousing.umich.edu/listing/the-courtyards-apartments-17490) |
| `um_depot_4br` | 106 Depot St — 4BR House (Kerrytown) | 106 Depot St, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/106-depot-st-ann-arbor-mi-48104-usa-118298) |
| `um_fair_4br` | 1805 Fair St, 4BR House (Eberwhite) | 1805 Fair St, Ann Arbor, MI 48103 | 4 | [listing](https://offcampushousing.umich.edu/listing/1805-fair-street-233701) |
| `um_forest_4br` | 727 S Forest Ave — 4BR Apartment | 727 S Forest Ave, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/727-s.-forest-ave-107804) |
| `um_foundry_4br` | Foundry Lofts — 4BR/4BA (per-bed lease) | 413 E Huron St, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/foundry-lofts-6815) |
| `um_landmark_4br` | Landmark — 4BR (per-bed lease) | 1300 South University Ave, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/landmark-107340) |
| `um_lawrence_4br` | 418 Lawrence St, 4BR Apartment (Kerrytown) | 418 Lawrence St, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/418-lawrence-st-ann-arbor-mi-48104-usa-118440) |
| `um_mary_4br` | 602 Mary Ct — 4BR House | 602 Mary Ct, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/602-mary-ct-ann-arbor-mi-48104-113683) |
| `um_miller_4br` | 209 Miller Ave — 4BR House (Old West Side) | 209 Miller Ave, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/209-miller-ave-ann-arbor-mi-48104-usa-118317) |
| `um_smain_4br` | 720 S Main St — 4BR House | 720 S Main St, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/720-s-main-st-108751) |
| `um_ssv_4br` | State Street Village, 4BR Apartment | 2225 S State St, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/state-street-village-117095) |
| `um_trails_4br` | University Trails — 4BR Townhome (per-bed lease) | 2327 Erie Drive, Ann Arbor, MI 48105 | 4 | [listing](https://offcampushousing.umich.edu/listing/university-trails-107271) |
| `um_yard_4br` | The Yard — 4BR (per-bed lease) | 615 South Main Street, Ann Arbor, MI 48104 | 4 | [listing](https://offcampushousing.umich.edu/listing/the-yard-57184) |
| `geddes_3br_bilevel` | Haven on Geddes — 3BR Bi-Level w/ Flex Bedroom | 1700 Geddes Avenue, Ann Arbor, MI 48104 | 3 | [listing](https://www.havenongeddes.com/ann-arbor/haven-on-geddes/student/) |
| `geddes_3br_ranch` | Haven on Geddes — 3BR Ranch | 1700 Geddes Avenue, Ann Arbor, MI 48104 | 3 | [listing](https://www.havenongeddes.com/ann-arbor/haven-on-geddes/student/) |
| `um_ashley_3br` | 217 N Ashley St — 3BR Duplex | 215/217 N Ashley St, Ann Arbor, MI 48103 | 3 | [listing](https://offcampushousing.umich.edu/listing/217-n.-ashley-st-110704) |
| `um_sstate_2br` | 1313 S State St, 2BR Apartment | 1313 S State St, Ann Arbor, MI 48104 | 2 | [listing](https://offcampushousing.umich.edu/listing/1313-s-state-112852) |
| `um_oldwest_1br` | 443 3rd St — 1BR Duplex (Old West Side) | 443 3rd St, Ann Arbor, MI 48103 | 1 | [listing](https://offcampushousing.umich.edu/listing/old-west-side-apartment-443-3rd-st-ann-arbor-mi-48103-111932) |
| `um_hub_studio` | Hub Ann Arbor State — Studio | 723 Packard Street, Ann Arbor, MI 48104 | Studio | [listing](https://offcampushousing.umich.edu/listing/hub-ann-arbor-state-235816) |
