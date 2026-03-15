const { JSDOM } = require('jsdom');
const { performance } = require('perf_hooks');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="forecast-grid"></div></body></html>');
const document = dom.window.document;
const forecastGrid = document.getElementById('forecast-grid');

const ITERATIONS = 1000;
const ITEMS_PER_ITERATION = 7;

function benchmarkDirectAppend() {
    let totalTime = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        forecastGrid.innerHTML = '';
        const start = performance.now();
        for (let j = 0; j < ITEMS_PER_ITERATION; j++) {
            const card = document.createElement('div');
            card.innerHTML = `<p>Day ${j}</p>`;
            forecastGrid.appendChild(card);
        }
        totalTime += (performance.now() - start);
    }
    return totalTime / ITERATIONS;
}

function benchmarkFragmentAppend() {
    let totalTime = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        forecastGrid.innerHTML = '';
        const start = performance.now();
        const fragment = document.createDocumentFragment();
        for (let j = 0; j < ITEMS_PER_ITERATION; j++) {
            const card = document.createElement('div');
            card.innerHTML = `<p>Day ${j}</p>`;
            fragment.appendChild(card);
        }
        forecastGrid.appendChild(fragment);
        totalTime += (performance.now() - start);
    }
    return totalTime / ITERATIONS;
}

// Warmup
benchmarkDirectAppend();
benchmarkFragmentAppend();

const directTime = benchmarkDirectAppend();
const fragmentTime = benchmarkFragmentAppend();

console.log(`Direct Append Average Time: ${directTime.toFixed(4)} ms`);
console.log(`DocumentFragment Average Time: ${fragmentTime.toFixed(4)} ms`);
const improvement = ((directTime - fragmentTime) / directTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
