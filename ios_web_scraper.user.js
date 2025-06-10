// ==UserScript==
// @name         iOS Web Scraper with Overlay Menu, Progress Bar, Custom File Name & Multi-Format Export
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Scrape specific content with an overlay menu, dynamic progress bar, custom file name, and multiple export formats
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let maxDepth = 3;
    let allContent = '';
    let pagesScraped = 0;
    let totalPages = 0;
    const scrapedUrls = new Set();
    const contentTypes = { text: true, images: true, links: true, videos: true };
    let cancelScrape = false;

    function createOverlayMenu() {
        const overlay = document.createElement('div');
        overlay.id = 'scraperOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '50px';
        overlay.style.right = '10px';
        overlay.style.backgroundColor = '#fff';
        overlay.style.border = '1px solid #000';
        overlay.style.padding = '10px';
        overlay.style.zIndex = 1001;
        overlay.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

        overlay.innerHTML = `
            <strong>Select Content Types:</strong><br>
            <label><input type='checkbox' name='contentType' value='text' checked> Text</label><br>
            <label><input type='checkbox' name='contentType' value='images' checked> Images</label><br>
            <label><input type='checkbox' name='contentType' value='links' checked> Links</label><br>
            <label><input type='checkbox' name='contentType' value='videos' checked> Videos</label><br>
            <label>Max Depth: <input type='number' id='depthInput' value='3' min='1' max='10' style='width:40px'></label><br>
            <button id='selectAllBtn'>Select All</button>
            <button id='startScrapingBtn'>Start Scraping</button>
        `;

        document.body.appendChild(overlay);

        document.getElementById('selectAllBtn').onclick = () => {
            document.querySelectorAll("input[name='contentType']").forEach(el => el.checked = true);
        };

        document.getElementById('startScrapingBtn').onclick = () => {
            document.querySelectorAll("input[name='contentType']").forEach(el => contentTypes[el.value] = el.checked);
            const depthValue = parseInt(document.getElementById('depthInput').value, 10);
            if (!isNaN(depthValue) && depthValue > 0) maxDepth = depthValue;
            document.getElementById('scraperOverlay').remove();
            startScraping();
        };
    }

    function createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.id = 'scrapeProgressBar';
        progressBar.style.position = 'fixed';
        progressBar.style.bottom = '10px';
        progressBar.style.left = '10px';
        progressBar.style.width = '250px';
        progressBar.style.backgroundColor = '#ddd';
        progressBar.style.border = '1px solid #000';
        progressBar.style.borderRadius = '5px';
        progressBar.style.overflow = 'hidden';
        progressBar.style.fontFamily = 'Arial, sans-serif';
        progressBar.style.fontSize = '12px';

        const progressFill = document.createElement('div');
        progressFill.style.width = '0%';
        progressFill.style.height = '20px';
        progressFill.style.textAlign = 'center';
        progressFill.style.lineHeight = '20px';
        progressFill.style.color = '#fff';
        progressFill.style.transition = 'width 0.5s, background-color 0.5s';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.position = 'absolute';
        cancelBtn.style.right = '5px';
        cancelBtn.style.top = '2px';
        cancelBtn.onclick = () => { cancelScrape = true; };

        progressBar.appendChild(progressFill);
        progressBar.appendChild(cancelBtn);
        document.body.appendChild(progressBar);
    }

    function updateProgressBar() {
        const percentage = (pagesScraped / totalPages) * 100;
        const progressFill = document.querySelector('#scrapeProgressBar div');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
            progressFill.textContent = `${Math.round(percentage)}%`;

            const red = Math.round(255 - (percentage * 2.55));
            const green = Math.round(percentage * 2.55);
            progressFill.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
        }
    }

    function scrapeContent(url, depth) {
        if (cancelScrape || depth > maxDepth || scrapedUrls.has(url)) return;
        scrapedUrls.add(url);
        totalPages++;

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');

                let content = `\nTitle: ${doc.title}\nURL: ${url}\n`;
                if (contentTypes.text) content += `\nText:\n${doc.body.innerText}\n`;
                if (contentTypes.images) content += `\nImages:\n${Array.from(doc.images).map(img => img.src).join('\n')}\n`;
                if (contentTypes.links) content += `\nLinks:\n${Array.from(doc.links).map(link => link.href).join('\n')}\n`;
                if (contentTypes.videos) content += `\nVideos:\n${Array.from(doc.querySelectorAll('video, iframe')).map(v => v.src || v.getAttribute('src')).join('\n')}\n`;

                allContent += content;
                pagesScraped++;
                updateProgressBar();

                Array.from(doc.links).forEach(link => scrapeContent(link.href, depth + 1));
                Array.from(doc.querySelectorAll('iframe')).forEach(frame => {
                    const src = frame.src || frame.getAttribute('src');
                    if (src) scrapeContent(src, depth + 1);
                });
            }
        });
    }

    function downloadFile(content, format, fileName) {
        if (format === 'pdf') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const lines = content.split('\n');
                let y = 10;
                lines.forEach(line => {
                    doc.text(line, 10, y);
                    y += 10;
                    if (y > 280) {
                        doc.addPage();
                        y = 10;
                    }
                });
                doc.save(`${fileName}.pdf`);
            };
            document.body.appendChild(script);
            return;
        }

        if (format === 'json') {
            content = JSON.stringify({ data: content }, null, 2);
        }

        let mime = 'text/plain';
        if (format === 'csv') mime = 'text/csv';
        if (format === 'json') mime = 'application/json';
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function showExportOptions() {
        if (cancelScrape) return;
        const format = prompt('Choose file format to export:\n1 - TXT\n2 - CSV\n3 - PDF\n4 - JSON', '1');
        const formatMap = { '1': 'txt', '2': 'csv', '3': 'pdf', '4': 'json' };
        const selectedFormat = formatMap[format] || 'txt';

        const fileName = prompt('Enter custom file name:', 'scraped_content') || 'scraped_content';
        downloadFile(allContent, selectedFormat, fileName);
    }

    function startScraping() {
        allContent = '';
        pagesScraped = 0;
        totalPages = 0;
        cancelScrape = false;
        scrapedUrls.clear();

        createProgressBar();
        scrapeContent(window.location.href, 1);

        const checkCompletion = setInterval(() => {
            if (cancelScrape) {
                clearInterval(checkCompletion);
                document.getElementById('scrapeProgressBar').remove();
            } else if (pagesScraped === totalPages) {
                clearInterval(checkCompletion);
                showExportOptions();
                document.getElementById('scrapeProgressBar').remove();
            }
        }, 1000);
    }

    const button = document.createElement('button');
    button.textContent = 'Scrape & Export';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = 1000;
    button.onclick = createOverlayMenu;
    document.body.appendChild(button);
})();

