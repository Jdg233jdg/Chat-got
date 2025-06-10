# Chat-got

This repository contains a sample user script for iOS browsers that allows scraping
content from webpages. The script works with user-script managers such as
Tampermonkey or Userscripts on mobile Safari.

## iOS Web Scraper

The `ios_web_scraper.user.js` script provides:

- An overlay menu to select which content types (text, images, links, videos) to scrape and a field to set the crawl depth.
- A dynamic progress bar with a **Cancel** button showing scraping progress with color transitions.
- Depth-limited crawling of links (up to the depth you specify).
- Export of the scraped data to **TXT**, **CSV**, **PDF** or **JSON** with a custom file name.

### Usage
1. Install a user-script manager (e.g., Tampermonkey) on your iOS device.
2. Add `ios_web_scraper.user.js` to the manager.
3. Browse to any webpage and tap the **Scrape & Export** button that appears in the top-right corner.
4. Choose which content types to include, set the maximum depth and start scraping.
5. Watch the progress bar or hit **Cancel** to stop early.
6. Once finished, select the export format and file name.

