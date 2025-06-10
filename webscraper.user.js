// ==UserScript==
// @name         iOS Web Scraper with Overlay Menu, Progress Bar, Custom File Name & Extended Export
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Scrape specific content with adjustable depth, pause option, and export as TXT, CSV, PDF or JSON
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let maxDepth = 3;
    const results = [];
    let pagesScraped = 0;
    let totalPages = 0;
    const scrapedUrls = new Set();
    const contentTypes = { text: true, images: true, links: true, videos: true };
    let cancelScrape = false;

    function createOverlayMenu() {
        const overlay = document.createElement('div');
        overlay.id = 'scraperOverlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '50px',
            right: '10px',
            backgroundColor: '#fff',
            border: '1px solid #000',
            padding: '10px',
            zIndex: 1001,
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
        });

        overlay.innerHTML = `
            <strong>Select Content Types:</strong><br>
            <label><input type='checkbox' name='contentType' value='text' checked> Text</label><br>
            <label><input type='checkbox' name='contentType' value='images' checked> Images</label><br>
            <label><input type='checkbox' name='contentType' value='links' checked> Links</label><br>
            <label><input type='checkbox' name='contentType' value='videos' checked> Videos</label><br>
            <label>Depth: <input type='number' id='depthInput' min='1' max='5' value='3' style='width:40px'></label><br>
            <button id='selectAllBtn'>Select All</button>
            <button id='startScrapingBtn'>Start Scraping</button>
        `;

        document.body.appendChild(overlay);

        document.getElementById('selectAllBtn').onclick = () => {
            document.querySelectorAll("input[name='contentType']").forEach(el => el.checked = true);
        };

        document.getElementById('startScrapingBtn').onclick = () => {
            document.querySelectorAll("input[name='contentType']").forEach(el => contentTypes[el.value] = el.checked);
            maxDepth = parseInt(document.getElementById('depthInput').value, 10) || 3;
            overlay.remove();
            startScraping();
        };
    }

    function createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.id = 'scrapeProgressBar';
        Object.assign(progressBar.style, {
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            width: '250px',
            backgroundColor: '#ddd',
            border: '1px solid #000',
            borderRadius: '5px',
            overflow: 'hidden',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px'
        });

        const progressFill = document.createElement('div');
        Object.assign(progressFill.style, {
            width: '0%',
            height: '20px',
            textAlign: 'center',
            lineHeight: '20px',
            color: '#fff',
            transition: 'width 0.5s, background-color 0.5s'
        });

        progressBar.appendChild(progressFill);
        document.body.appendChild(progressBar);

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'scrapeCancelBtn';
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            position: 'fixed',
            bottom: '35px',
            left: '10px',
            zIndex: 1001
        });
        cancelBtn.onclick = () => { cancelScrape = true; };
        document.body.appendChild(cancelBtn);
    }

    function updateProgressBar() {
        const percentage = (pagesScraped / totalPages) * 100;
        const progressFill = document.querySelector('#scrapeProgressBar div');
        progressFill.style.width = `${percentage}%`;
        progressFill.textContent = `${pagesScraped}/${totalPages} (${Math.round(percentage)}%)`;

        const red = Math.round(255 - (percentage * 2.55));
        const green = Math.round(percentage * 2.55);
        progressFill.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
    }

    function scrapeContent(url, depth) {
        if (cancelScrape || depth > maxDepth || scrapedUrls.has(url)) return;
        scrapedUrls.add(url);
        totalPages++;

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                if (cancelScrape) return;
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');

                const pageData = { title: doc.title, url };
                if (contentTypes.text) pageData.text = doc.body.innerText;
                if (contentTypes.images) pageData.images = Array.from(doc.images).map(img => img.src);
                if (contentTypes.links) pageData.links = Array.from(doc.links).map(link => link.href);
                if (contentTypes.videos) pageData.videos = Array.from(doc.querySelectorAll('video, iframe')).map(video => video.src);
                results.push(pageData);
                pagesScraped++;
                updateProgressBar();

                Array.from(doc.links).forEach(link => scrapeContent(link.href, depth + 1));
            }
        });
    }

    function formatResults() {
        let content = '';
        results.forEach(page => {
            content += `\nTitle: ${page.title}\nURL: ${page.url}\n`;
            if (contentTypes.text && page.text) content += `\nText:\n${page.text}\n`;
            if (contentTypes.images && page.images) content += `\nImages:\n${page.images.join('\n')}\n`;
            if (contentTypes.links && page.links) content += `\nLinks:\n${page.links.join('\n')}\n`;
            if (contentTypes.videos && page.videos) content += `\nVideos:\n${page.videos.join('\n')}\n`;
        });
        return content;
    }

    function downloadFile(format, fileName) {
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        const content = formatResults();
        if (format === 'pdf') {
            loadJsPdf(() => {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF();
                pdf.text(content, 10, 10);
                pdf.save(`${fileName}.pdf`);
            });
            return;
        }
        const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function loadJsPdf(callback) {
        if (window.jspdf) { callback(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = callback;
        document.head.appendChild(script);
    }

    function showExportOptions() {
        const format = prompt('Choose file format to export:\n1 - TXT\n2 - CSV\n3 - PDF\n4 - JSON', '1');
        const formatMap = { '1': 'txt', '2': 'csv', '3': 'pdf', '4': 'json' };
        const selectedFormat = formatMap[format] || 'txt';

        const fileName = prompt('Enter custom file name:', 'scraped_content') || 'scraped_content';
        downloadFile(selectedFormat, fileName);
    }

    function startScraping() {
        results.length = 0;
        pagesScraped = 0;
        totalPages = 0;
        scrapedUrls.clear();
        cancelScrape = false;

        createProgressBar();
        scrapeContent(window.location.href, 1);

        const checkCompletion = setInterval(() => {
            if (cancelScrape) {
                clearInterval(checkCompletion);
                document.getElementById('scrapeProgressBar').remove();
                document.getElementById('scrapeCancelBtn').remove();
                if (results.length) showExportOptions();
                return;
            }

            if (pagesScraped === totalPages) {
                clearInterval(checkCompletion);
                showExportOptions();
                document.getElementById('scrapeProgressBar').remove();
                document.getElementById('scrapeCancelBtn').remove();
            }
        }, 1000);
    }

    const button = document.createElement('button');
    button.textContent = 'Scrape & Export';
    Object.assign(button.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 1000
    });
    button.onclick = createOverlayMenu;
    document.body.appendChild(button);
})();

