(() => {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counterEl = document.getElementById('slide-counter');
  const progressBar = document.getElementById('progress-bar');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const notesBtn = document.getElementById('btn-notes');
  const overviewBtn = document.getElementById('btn-overview');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const notesPanel = document.getElementById('notes-panel');
  const notesBody = document.getElementById('notes-body');

  let currentIndex = 0;

  function getFragments(slide) {
    return Array.from(slide.querySelectorAll('.fragment'));
  }

  function syncSlideState(revealAllFragments = false) {
    slides.forEach((slide, idx) => {
      slide.classList.remove('active', 'prev');
      if (idx === currentIndex) {
        slide.classList.add('active');
        if (revealAllFragments) {
          getFragments(slide).forEach((f) => f.classList.add('visible'));
        }
      } else if (idx < currentIndex) {
        slide.classList.add('prev');
      }
    });

    const total = slides.length;
    counterEl.textContent = `${currentIndex + 1} / ${total}`;
    const progress = total > 1 ? ((currentIndex + 1) / total) * 100 : 100;
    progressBar.style.width = `${progress}%`;

    const activeNotes = slides[currentIndex].querySelector('.speaker-notes');
    notesBody.innerHTML = activeNotes
      ? activeNotes.innerHTML
      : '<em>No speaker notes for this slide.</em>';

    history.replaceState(null, '', `#slide-${currentIndex + 1}`);
  }

  function goToSlide(index, revealAllFragments = false) {
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    if (clamped !== currentIndex) {
      if (clamped > currentIndex && !revealAllFragments) {
        getFragments(slides[clamped]).forEach((f) => f.classList.remove('visible'));
      }
      currentIndex = clamped;
    }
    syncSlideState(revealAllFragments);
  }

  function stepNext() {
    if (document.body.classList.contains('overview-mode')) {
      goToSlide(currentIndex + 1, true);
      return;
    }
    const hiddenFragment = getFragments(slides[currentIndex]).find(
      (f) => !f.classList.contains('visible')
    );
    if (hiddenFragment) {
      hiddenFragment.classList.add('visible');
      return;
    }
    if (currentIndex < slides.length - 1) {
      goToSlide(currentIndex + 1, false);
    }
  }

  function stepPrev() {
    if (document.body.classList.contains('overview-mode')) {
      goToSlide(currentIndex - 1, true);
      return;
    }
    const visibleFragments = getFragments(slides[currentIndex]).filter((f) =>
      f.classList.contains('visible')
    );
    if (visibleFragments.length > 0) {
      visibleFragments[visibleFragments.length - 1].classList.remove('visible');
      return;
    }
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1, true);
    }
  }

  function toggleNotes() {
    notesPanel.classList.toggle('hidden');
  }

  function toggleOverview() {
    document.body.classList.toggle('overview-mode');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  slides.forEach((slide, idx) => {
    slide.addEventListener('click', () => {
      if (document.body.classList.contains('overview-mode')) {
        document.body.classList.remove('overview-mode');
        goToSlide(idx, true);
      } else if (idx === currentIndex && getFragments(slide).some((fragment) => !fragment.classList.contains('visible'))) {
        stepNext();
      }
    });
  });

  prevBtn.addEventListener('click', stepPrev);
  nextBtn.addEventListener('click', stepNext);
  notesBtn.addEventListener('click', toggleNotes);
  overviewBtn.addEventListener('click', toggleOverview);
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        stepNext();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        stepPrev();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0, false);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(slides.length - 1, true);
        break;
      case 'n':
      case 'N':
      case 's':
      case 'S':
        e.preventDefault();
        toggleNotes();
        break;
      case 'o':
      case 'O':
      case 'g':
      case 'G':
        e.preventDefault();
        toggleOverview();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'Escape':
        if (document.body.classList.contains('overview-mode')) {
          document.body.classList.remove('overview-mode');
        }
        if (!notesPanel.classList.contains('hidden')) {
          notesPanel.classList.add('hidden');
        }
        break;
    }
  });

  let touchStartX = null;
  window.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });
  window.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(deltaX) > 50) {
      deltaX < 0 ? stepNext() : stepPrev();
    }
    touchStartX = null;
  });

  // =========================================================================
  // Render GPX Elevation Profile & 2D Route Map
  // =========================================================================
  function initGpxVisualizations() {
    const route = window.SUFFERFEST_ROUTE;
    if (!route || !route.points || !route.points.length) return;

    const eleSvg = document.getElementById('elevation-svg');
    const mapSvg = document.getElementById('map-svg');
    if (!eleSvg || !mapSvg) return;

    const roMile = document.getElementById('ro-mile');
    const roEle = document.getElementById('ro-ele');
    const roGrade = document.getElementById('ro-grade');

    const pts = route.points; // [lat, lon, eleFt, distMi, gradePct]
    const maxDist = route.stats.totalDistanceMi; // 67.22
    const minEle = 7500;
    const maxEle = 11100;

    // SVG dimensions for Elevation Chart
    const W = 640;
    const H = 360;
    const padL = 72;
    const padR = 24;
    const padT = 36;
    const padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const xOfMile = (mi) => padL + (mi / maxDist) * plotW;
    const yOfEle = (ft) => padT + (1 - (ft - minEle) / (maxEle - minEle)) * plotH;

    // Build path string
    const lineCoords = pts.map((p) => `${xOfMile(p[3]).toFixed(1)},${yOfEle(p[2]).toFixed(1)}`);
    const linePath = `M ${lineCoords.join(' L ')}`;
    const areaPath = `${linePath} L ${xOfMile(maxDist).toFixed(1)},${(padT + plotH).toFixed(1)} L ${padL},${(padT + plotH).toFixed(1)} Z`;

    // Horizontal elevation grid lines
    const eleTicks = [8000, 9000, 10000, 10739];
    const gridLinesHtml = eleTicks
      .map((ft) => {
        const y = yOfEle(ft).toFixed(1);
        const isPeak = ft === 10739;
        return `
          <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
            stroke="${isPeak ? 'rgba(82, 207, 255,0.35)' : 'rgba(255,255,255,0.08)'}"
            stroke-dasharray="${isPeak ? '4 4' : 'none'}" stroke-width="1" />
          <text x="${padL - 8}" y="${Number(y) + 4}" text-anchor="end"
            fill="#b6cce2" font-family="monospace" font-size="11">${ft.toLocaleString()} ft</text>
        `;
      })
      .join('');

    // Mile ticks along bottom
    const mileTicks = [0, 14.14, 33.61, 53.08, 67.22];
    const xTicksHtml = mileTicks
      .map((mi) => {
        const x = xOfMile(mi).toFixed(1);
        return `
          <line x1="${x}" y1="${padT + plotH}" x2="${x}" y2="${padT + plotH + 5}" stroke="rgba(255,255,255,0.25)" />
          <text x="${x}" y="${H - 10}" text-anchor="middle"
            fill="#b6cce2" font-family="monospace" font-size="11">${Number(mi.toFixed(1))} mi</text>
        `;
      })
      .join('');

    // Landmark vertical markers & labels
    const landmarksHtml = route.landmarks
      .map((lm, idx) => {
        const x = xOfMile(lm.mile).toFixed(1);
        const y = yOfEle(lm.eleFt).toFixed(1);
        const isTurnaround = idx === 2;
        const isSummit = idx === 1 || idx === 3;
        const color = isTurnaround ? '#60a5fa' : isSummit ? '#82cfff' : '#e4f3ff';

        return `
          <line x1="${x}" y1="${y}" x2="${x}" y2="${padT + plotH}"
            stroke="${color}" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.7" />
          <circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="#040d1c" stroke-width="2" />
        `;
      })
      .join('');

    eleSvg.innerHTML = `
      <defs>
        <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#82cfff" stop-opacity="0.55" />
          <stop offset="65%" stop-color="#e4f3ff" stop-opacity="0.20" />
          <stop offset="100%" stop-color="#e4f3ff" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <!-- Grid & Axes -->
      ${gridLinesHtml}
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.2)" />
      ${xTicksHtml}

      <!-- Area & Stroke -->
      <path d="${areaPath}" fill="url(#eleGrad)" />
      <path d="${linePath}" fill="none" stroke="#82cfff" stroke-width="2.75" stroke-linejoin="round" stroke-linecap="round" />

      <!-- Landmarks -->
      ${landmarksHtml}

      <!-- Interactive Hover Scrubber -->
      <g id="ele-scrubber" style="display:none;">
        <line id="scrub-line" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 2" />
        <circle id="scrub-dot" cx="0" cy="0" r="6" fill="#ffffff" stroke="#82cfff" stroke-width="3" />
      </g>
    `;

    // =========================================================================
    // Render 2D GPS Route Map (Outbound half = full road geometry)
    // =========================================================================
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    pts.forEach(([lat, lon]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    });

    const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
    const cosLat = Math.cos(midLatRad);

    const mapW = 360;
    const mapH = 360;
    const mapPad = 30;

    const lonSpan = (maxLon - minLon) * cosLat;
    const latSpan = maxLat - minLat;
    const scale = Math.min((mapW - 2 * mapPad) / lonSpan, (mapH - 2 * mapPad) / latSpan);

    const usedW = lonSpan * scale;
    const usedH = latSpan * scale;
    const offsetX = (mapW - usedW) / 2;
    const offsetY = (mapH - usedH) / 2;

    const xOfLon = (lon) => offsetX + (lon - minLon) * cosLat * scale;
    const yOfLat = (lat) => mapH - offsetY - (lat - minLat) * scale;

    // Outbound points form the complete highway trace
    const halfIdx = Math.floor(pts.length / 2);
    const roadCoords = pts
      .slice(0, halfIdx + 1)
      .map(([lat, lon]) => `${xOfLon(lon).toFixed(1)},${yOfLat(lat).toFixed(1)}`);
    const roadPath = `M ${roadCoords.join(' L ')}`;

    const startPt = pts[0];
    const turnPt = pts[halfIdx];
    const passPt = pts.reduce((best, cur) => (cur[2] > best[2] ? cur : best), pts[0]);

    mapSvg.innerHTML = `
      <!-- Subtle compass grid -->
      <line x1="${mapW / 2}" y1="10" x2="${mapW / 2}" y2="${mapH - 10}" stroke="rgba(255,255,255,0.04)" />
      <line x1="10" y1="${mapH / 2}" x2="${mapW - 10}" y2="${mapH / 2}" stroke="rgba(255,255,255,0.04)" />
      <text x="${mapW - 16}" y="22" text-anchor="end" fill="#b6cce2" font-family="monospace" font-size="10">N ▲</text>

      <!-- Glow & Road Path -->
      <path d="${roadPath}" fill="none" stroke="rgba(82, 207, 255,0.22)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${roadPath}" fill="none" stroke="#82cfff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Start / Finish Marker (Soapstone) -->
      <circle cx="${xOfLon(startPt[1]).toFixed(1)}" cy="${yOfLat(startPt[0]).toFixed(1)}" r="5.5" fill="#e4f3ff" stroke="#040d1c" stroke-width="2" />
      <text x="${xOfLon(startPt[1]) + 10}" y="${yOfLat(startPt[0]) + 4}" fill="#e4f3ff" font-family="monospace" font-size="10.5" font-weight="700">
        START / FINISH (7,778')
      </text>

      <!-- Bald Mtn Pass Marker -->
      <circle cx="${xOfLon(passPt[1]).toFixed(1)}" cy="${yOfLat(passPt[0]).toFixed(1)}" r="5.5" fill="#82cfff" stroke="#040d1c" stroke-width="2" />
      <text x="${xOfLon(passPt[1]) + 10}" y="${yOfLat(passPt[0]) + 4}" fill="#82cfff" font-family="monospace" font-size="10.5" font-weight="700">
        BALD MTN PASS (10,739')
      </text>

      <!-- Turnaround Marker (Bear River) -->
      <circle cx="${xOfLon(turnPt[1]).toFixed(1)}" cy="${yOfLat(turnPt[0]).toFixed(1)}" r="5.5" fill="#60a5fa" stroke="#040d1c" stroke-width="2" />
      <text x="${xOfLon(turnPt[1]) - 10}" y="${yOfLat(turnPt[0]) + 4}" text-anchor="end" fill="#60a5fa" font-family="monospace" font-size="10.5" font-weight="700">
        TURNAROUND (8,339')
      </text>

      <!-- Live Scrubber Marker on Map -->
      <circle id="map-scrub-dot" cx="0" cy="0" r="7" fill="#ffffff" stroke="#82cfff" stroke-width="3" style="display:none;" />
    `;

    // Interactive hover handler on Elevation SVG
    const scrubber = document.getElementById('ele-scrubber');
    const scrubLine = document.getElementById('scrub-line');
    const scrubDot = document.getElementById('scrub-dot');
    const mapScrubDot = document.getElementById('map-scrub-dot');

    function updateScrubber(best) {
      const [lat, lon, eleFt, distMi, gradePct] = best;
      const cx = xOfMile(distMi).toFixed(1);
      const cy = yOfEle(eleFt).toFixed(1);

      scrubber.style.display = 'block';
      scrubLine.setAttribute('x1', cx);
      scrubLine.setAttribute('x2', cx);
      scrubDot.setAttribute('cx', cx);
      scrubDot.setAttribute('cy', cy);

      mapScrubDot.style.display = 'block';
      mapScrubDot.setAttribute('cx', xOfLon(lon).toFixed(1));
      mapScrubDot.setAttribute('cy', yOfLat(lat).toFixed(1));

      roMile.textContent = `${distMi.toFixed(2)} mi`;
      roEle.textContent = `${eleFt.toLocaleString()} ft`;
      const sign = gradePct > 0 ? '+' : '';
      roGrade.textContent = `${sign}${gradePct.toFixed(1)}%`;
    }

    function pointerPosition(svg, event) {
      return new DOMPoint(event.clientX, event.clientY)
        .matrixTransform(svg.getScreenCTM().inverse());
    }

    function hideScrubber() {
      scrubber.style.display = 'none';
      mapScrubDot.style.display = 'none';
    }

    eleSvg.addEventListener('pointermove', (event) => {
      const { x } = pointerPosition(eleSvg, event);
      const mile = ((x - padL) / plotW) * maxDist;
      const nearest = pts.reduce((best, point) =>
        Math.abs(point[3] - mile) < Math.abs(best[3] - mile) ? point : best
      );
      updateScrubber(nearest);
    });

    // Both legs share the same road, so map hover follows the outbound leg.
    const outbound = pts.slice(0, halfIdx + 1).map((point) => ({
      point,
      x: xOfLon(point[1]),
      y: yOfLat(point[0]),
    }));
    mapSvg.addEventListener('pointermove', (event) => {
      const { x, y } = pointerPosition(mapSvg, event);
      const distanceSquared = (point) => (point.x - x) ** 2 + (point.y - y) ** 2;
      const nearest = outbound.reduce((best, point) =>
        distanceSquared(point) < distanceSquared(best) ? point : best
      );
      updateScrubber(nearest.point);
    });

    eleSvg.addEventListener('pointerleave', hideScrubber);
    mapSvg.addEventListener('pointerleave', hideScrubber);
  }

  initGpxVisualizations();

  const match = window.location.hash.match(/^#slide-(\d+)$/);
  const initialIndex = match ? parseInt(match[1], 10) - 1 : 0;
  currentIndex = Math.max(0, Math.min(slides.length - 1, initialIndex));
  syncSlideState(false);
})();
