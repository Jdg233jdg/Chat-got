# Chat-got

This repository hosts a Tampermonkey user script named `web-scraper.user.js`.
The script works in iOS browsers through managers such as Tampermonkey or
Userscripts. It can crawl pages up to three levels deep with configurable
concurrency and allows you to export the collected data.

## Features
- Overlay menu to choose which content types (text, images, links, videos) to scrape
- Adjustable concurrency limit and depth control
- Dynamic progress bar with color transition and percent indicator
- Exponential backoff retry logic for network errors
- Start/Stop controls to manage scraping
- Export results as **TXT**, **CSV** or **PDF**

## Usage
1. Install a user-script manager on your iOS device (e.g. Tampermonkey).
2. Add `web-scraper.user.js` to the manager.
3. Browse to any webpage and open the overlay via the script's button.
4. Select the desired content types and start scraping.
5. Watch the progress bar or press **Stop** to cancel early.
6. Choose an export format and file name once scraping completes.
