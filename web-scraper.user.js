// ==UserScript==
// @name         iOS Web Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrape content up to 3 levels deep with concurrency control and export options
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let concurrencyLimit = 5;
    const MAX_DEPTH = 3;
    const visited = new Set();
    let activeRequests = 0;
    const queue = [];
    let results = [];
    let stopRequested = false;
    let lastProgressUpdate = 0;
    const PROGRESS_INTERVAL = 100; // ms

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'scraper-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.zIndex = '9999';
        overlay.style.background = '#fff';
        overlay.style.border = '1px solid #ccc';
        overlay.style.padding = '10px';
        overlay.style.fontSize = '14px';
        overlay.style.fontFamily = 'sans-serif';
        overlay.innerHTML = `
            <label><input type="checkbox" id="scrape-text"> Text</label><br>
            <label><input type="checkbox" id="scrape-images"> Images</label><br>
            <label><input type="checkbox" id="scrape-links"> Links</label><br>
            <label><input type="checkbox" id="scrape-videos"> Videos</label><br>
            Concurrency: <input id="concurrency-limit" type="number" min="1" max="10" value="5" style="width:50px"><br>
            <button id="select-all">Select All</button>
            <button id="start-scrape">Start Scraping</button>
            <button id="stop-scrape">Stop</button>
            <div id="progress-container" style="margin-top:10px;width:200px;height:20px;background:#eee;">
                <div id="progress-bar" style="height:100%;width:0;background:red;color:#fff;text-align:center;transition:width 0.2s ease, background-color 0.2s ease;">0%</div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('select-all').addEventListener('click', () => {
            document.getElementById('scrape-text').checked = true;
            document.getElementById('scrape-images').checked = true;
            document.getElementById('scrape-links').checked = true;
            document.getElementById('scrape-videos').checked = true;
        });

        document.getElementById('start-scrape').addEventListener('click', () => {
            results = [];
            visited.clear();
            stopRequested = false;
            concurrencyLimit = parseInt(document.getElementById('concurrency-limit').value, 10) || 1;
            console.time('scraping');
            updateProgress(0);
            enqueue(window.location.href, 0);
            processQueue();
        });

        document.getElementById('stop-scrape').addEventListener('click', () => {
            stopRequested = true;
            queue.length = 0;
            processQueue();
        });
    }

    function updateProgress(value) {
        const now = Date.now();
        if (now - lastProgressUpdate < PROGRESS_INTERVAL && value < 100) return;
        lastProgressUpdate = now;
        const bar = document.getElementById('progress-bar');
        if (bar) {
            bar.style.width = value + '%';
            const red = 255 - Math.floor(2.55 * value);
            const green = Math.floor(2.55 * value);
            bar.style.backgroundColor = `rgb(${red},${green},0)`;
            bar.textContent = Math.floor(value) + '%';
        }
    }

    function enqueue(url, depth) {
        if (depth > MAX_DEPTH || visited.has(url)) return;
        visited.add(url);
        queue.push({ url, depth });
    }

    function processQueue() {
        if (stopRequested && !activeRequests) {
            finalize();
            return;
        }
        while (!stopRequested && activeRequests < concurrencyLimit && queue.length) {
            const { url, depth } = queue.shift();
            activeRequests++;
            scrapePage(url, depth)
                .catch(err => console.error('Scrape error:', url, err))
                .finally(() => {
                    activeRequests--;
                    updateProgress((visited.size / (visited.size + queue.length)) * 100);
                    if (queue.length || activeRequests) {
                        processQueue();
                    } else {
                        finalize();
                    }
                });
        }
    }

    function scrapePage(url, depth, attempt = 1) {
        console.log('Fetching', url, 'depth', depth, 'attempt', attempt);
        return new Promise(resolve => {
            const label = `request ${url} attempt ${attempt}`;
            console.time(label);
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: response => {
                    console.timeEnd(label);
                    try {
                        const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                        extractContent(doc, url);
                        if (depth + 1 <= MAX_DEPTH) {
                            Array.from(doc.querySelectorAll('a[href]')).forEach(a => {
                                const href = new URL(a.href, url).href;
                                enqueue(href, depth + 1);
                            });
                        }
                        resolve();
                    } catch (e) {
                        console.error('Parsing error:', url, e);
                        resolve(); // continue despite parsing errors
                    }
                },
                onerror: err => {
                    console.timeEnd(label);
                    retry(err);
                },
                ontimeout: () => {
                    console.timeEnd(label);
                    retry('timeout');
                },
                timeout: 10000
            });

            function retry(err) {
                if (attempt < 3) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.warn('Retrying', url, 'in', delay, 'ms due to', err);
                    setTimeout(() => {
                        scrapePage(url, depth, attempt + 1).then(resolve);
                    }, delay);
                } else {
                    console.error('Giving up on', url);
                    resolve();
                }
            }
        });
    }

    function extractContent(doc, url) {
        const includeText = document.getElementById('scrape-text').checked;
        const includeImages = document.getElementById('scrape-images').checked;
        const includeLinks = document.getElementById('scrape-links').checked;
        const includeVideos = document.getElementById('scrape-videos').checked;
        const data = { url };
        if (includeText) {
            data.text = doc.body.innerText.trim().slice(0, 1000); // limit text size
        }
        if (includeImages) {
            data.images = Array.from(doc.images).map(img => img.src);
        }
        if (includeLinks) {
            data.links = Array.from(doc.querySelectorAll('a[href]')).map(a => a.href);
        }
        if (includeVideos) {
            data.videos = Array.from(doc.querySelectorAll('video source[src], video[src]')).map(v => v.src || v.parentElement.src);
        }
        results.push(data);
    }

    function finalize() {
        console.log('Scraping complete');
        console.timeEnd('scraping');
        updateProgress(100);
        stopRequested = false;
        promptExport();
    }

    function promptExport() {
        const format = prompt('Export format? (txt, csv, pdf)', 'txt');
        if (!format) return;
        const filename = prompt('File name?', 'scrape_result');
        if (!filename) return;
        const content = formatData(format.toLowerCase());
        if (!content) {
            alert('Unsupported format');
            return;
        }
        const blob = new Blob([content.data], { type: content.type });
        GM_download({
            url: URL.createObjectURL(blob),
            name: filename + '.' + format,
            onerror: err => console.error('Download error', err)
        });
    }

    function formatData(format) {
        switch (format) {
            case 'txt':
                return { data: JSON.stringify(results, null, 2), type: 'text/plain' };
            case 'csv':
                const header = Object.keys(results[0] || {}).join(',') + '\n';
                const rows = results.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                return { data: header + rows, type: 'text/csv' };
            case 'pdf':
                const text = JSON.stringify(results, null, 2);
                return { data: text, type: 'application/pdf' }; // simple fallback
            default:
                return null;
        }
    }

    createOverlay();
})();

