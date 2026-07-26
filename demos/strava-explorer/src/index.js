import './style.css';
import { installAnalytics } from '../../shared/analytics.mjs';
import * as strava from './strava.js';
import * as gmp from './gmp.js';
import { readUrlState as readUrlStateImpl, buildUrlParams } from './urlState.js';
import { demoActivities } from './demoData.js';
import {
    playFollowCamera,
    pauseFollowCamera,
    stopFollowCamera,
    setFollowCameraProgress,
    setFollowCameraSpeed,
    setTourSettings,
    getTourSettings,
    registerTourCallbacks,
    getTourState,
    loadTourRoute,
    clearTourRoute
} from './followCamera.js';
import { debug, warn, error } from './log.js';
import { toLatLngLiteral } from './latlng.js';
import { haversineKm, calculateElevationLoss } from './geo.js';
import { formatDistance, formatElevation, formatSpeed, formatDuration, MILES_PER_KM, FEET_PER_METER } from './units.js';
import { normalizeSportType, sportEmoji } from './activityIcons.js';

installAnalytics(import.meta.env.VITE_ANALYTICS_MEASUREMENT_ID);

// --- Module-Level Variables ---
let currentActivityId = null; // Keep track of the currently displayed activity ID
let currentRouteCoords = null; // Store the LatLng array for the current route
let currentActivityElevations = []; // Stores array of { distanceKm, elevationM, lat, lng } objects
let demoMode = false;

// Dynamic state variables (D4/D5)
let allActivities = []; // Caches activities fetched from API/demo
let selectedSportFilter = 'all'; // 'all', 'ride', 'run', 'hike'
let useImperial = true; // Metric / Imperial unit preference
let currentActivityData = null; // Caches full activity metadata
let currentStreams = null; // Caches altitude, distance, latlng streams
let theaterModeActive = false;
let keyboardModalOpen = false;
let currentSheetState = 'half'; // 'peek', 'half', 'full'

// --- DOM Element References ---
let cameraStatusEl, fitRouteButton, flyStartButton, flyFinishButton, orbitRouteButton;
let mapHost, loadingIndicator, loadingText, errorMessageDiv, statsContainer, activityNameEl, activityDistEl, activityTimeEl, activityElevEl, activityAvgSpeedEl, activityMaxSpeedEl, activityTotalLossEl, selectList, activityFilterDiv, startDateInput, endDateInput, activityCountInput, fetchFilteredButton, footerAthleteInfo, footerProfileImg, footerProfileName, logoutButton, stravaConnectButton, stravaAuthDiv, demoButton;

// Tour Player DOM elements
let tourScrubber, tourPlayBtn, tourStopBtn, playIcon, pauseIcon, tourDistanceElapsed, tourDistanceTotal;
let tourHeightSlider, tourHeightValue, tourRangeSlider, tourRangeValue, tourTiltSlider, tourTiltValue, tourSmoothnessSlider, tourSmoothnessValue, followCameraSpeedSlider, followCameraSpeedValue;

// Elevation Profile DOM elements
let elevationProfileContainer, elevationPlaceholder, elevationSvg, elevationHoverLine, elevationProgressLine, elevationHoverDot, elevationTooltip;

// Interactive UI elements (D3/D4/D5)
let unitToggleMetricBtn, unitToggleImperialBtn, activitySearchInput, sportChipsContainer, theaterToggleBtn, theaterPill, theaterExpandBtn, theaterPlayBtn, theaterStopBtn, theaterReadout, theaterPlayIcon, theaterPauseIcon;

// --- Utility Functions ---
function showLoading(isLoading, text = "Loading...") {
    if (!loadingIndicator || !loadingText) return;
    loadingText.textContent = text;
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    if (isLoading) showError(''); // Clear errors when loading starts
    const isList = text.includes("activities") && !text.includes("details") && !text.includes("Processing");
    toggleSkeletons(isLoading, isList);
}

function showError(message) {
    if (!errorMessageDiv) return;
    
    // Check if Strava 429 limit exceeded (D7)
    if (message && (message.includes('429') || message.includes('Rate Limit') || message.includes('rate limit'))) {
        showToast("Strava rate limit reached — try again in ~15 min", "error", 6000);
        message = "Strava rate limit reached. Please wait ~15 minutes before making another request.";
    }
    
    errorMessageDiv.textContent = message || '';
    errorMessageDiv.style.display = message ? 'block' : 'none';
    if (message) showLoading(false); // Hide loading if error occurs
}

function readUrlState() {
    return readUrlStateImpl(window.location.search);
}

function updateUrlState() {
    let settings = null;
    try {
        settings = getTourSettings();
    } catch (e) {
        warn("Could not read tour settings for URL state:", e);
    }

    const state = {
        startDate: startDateInput?.value || null,
        endDate: endDateInput?.value || null,
        count: activityCountInput?.value ? parseInt(activityCountInput.value, 10) : null,
        activityId: currentActivityId,
        cameraHeight: settings?.height,
        cameraRange: settings?.range,
        cameraTilt: settings?.tilt,
        cameraSmoothness: settings?.smoothness,
        cameraSpeed: followCameraSpeedSlider ? parseFloat(followCameraSpeedSlider.value) : null,
        units: useImperial ? 'imperial' : 'metric' // D5: URL state unit sync
    };

    const queryString = buildUrlParams(state, window.location.search);
    const newUrl = window.location.pathname + (queryString ? `?${queryString}` : '');
    window.history.replaceState({}, document.title, newUrl);
}

// --- Toast Notification System - D7 ---
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-xs font-semibold premium-glass backdrop-blur-md transition-all duration-300 translate-y-2 opacity-0`;
    
    let icon = '';
    if (type === 'error') {
        toast.classList.add('border-red-500/30', 'text-red-200');
        icon = `
            <svg class="w-4 h-4 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
        `;
    } else if (type === 'success') {
        toast.classList.add('border-emerald-500/30', 'text-emerald-200');
        icon = `
            <svg class="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
        `;
    } else {
        toast.classList.add('border-indigo-500/30', 'text-indigo-200');
        icon = `
            <svg class="w-4 h-4 text-indigo-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
        `;
    }
    
    toast.innerHTML = `
        <div class="flex items-center">
            ${icon}
            <span>${message}</span>
        </div>
        <button class="ml-4 text-gray-400 hover:text-white focus:outline-none p-1 rounded-md" aria-label="Close">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    window.requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });
    
    const closeToast = () => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-2', 'opacity-0');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    };
    
    toast.querySelector('button').addEventListener('click', closeToast);
    
    if (duration > 0) {
        setTimeout(closeToast, duration);
    }
}

// --- Skeleton Loading Screens - D7 ---
function toggleSkeletons(isLoading, isList = false) {
    const statsCards = document.querySelectorAll('.stat-card');
    
    if (isLoading) {
        statsCards.forEach(card => {
            const valEl = card.querySelector('.value');
            if (valEl) {
                if (!valEl.dataset.originalText) {
                    valEl.dataset.originalText = valEl.textContent;
                }
                valEl.innerHTML = '<span class="inline-block w-12 h-4 rounded skeleton-shimmer"></span>';
            }
        });
        
        if (isList && selectList) {
            selectList.innerHTML = '<option disabled selected>Loading activities...</option>';
        }
    } else {
        statsCards.forEach(card => {
            const valEl = card.querySelector('.value');
            if (valEl && valEl.dataset.originalText) {
                valEl.textContent = valEl.dataset.originalText;
                delete valEl.dataset.originalText;
            }
        });
    }
}

// --- Share Button (with navigator.share fallback) - D8 ---
function setupShareButton() {
    const shareUrlButton = document.getElementById('share-url-button');
    const shareTooltip = document.getElementById('share-tooltip');
    if (shareUrlButton && shareTooltip) {
        shareUrlButton.addEventListener('click', async () => {
            updateUrlState();
            const url = window.location.href;
            
            const shareData = {
                title: '3D Strava Explorer',
                text: 'Check out my 3D activity tour!',
                url: url
            };
            
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                try {
                    await navigator.share(shareData);
                    showToast("Tour shared successfully!", "success");
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        error("Error calling navigator.share:", err);
                        fallbackShare(url);
                    }
                }
            } else {
                fallbackShare(url);
            }
        });
    }
    
    function fallbackShare(url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showToast("Link copied to clipboard!", "success");
                if (shareTooltip) {
                    shareTooltip.classList.remove('opacity-0');
                    shareTooltip.classList.add('opacity-100');
                    setTimeout(() => {
                        shareTooltip.classList.remove('opacity-100');
                        shareTooltip.classList.add('opacity-0');
                    }, 2000);
                }
            }).catch(err => {
                error("Failed to copy URL:", err);
                showToast("Failed to copy link.", "error");
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast("Link copied to clipboard!", "success");
                if (shareTooltip) {
                    shareTooltip.classList.remove('opacity-0');
                    shareTooltip.classList.add('opacity-100');
                    setTimeout(() => {
                        shareTooltip.classList.remove('opacity-100');
                        shareTooltip.classList.add('opacity-0');
                    }, 2000);
                }
            } catch {
                showToast("Failed to copy link.", "error");
            }
            document.body.removeChild(textArea);
        }
    }
}

// --- Keyboard Shortcuts modal & listeners - D3 ---
function toggleKeyboardModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal) return;
    keyboardModalOpen = !keyboardModalOpen;
    if (keyboardModalOpen) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function setupKeyboardShortcuts() {
    const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
    if (closeShortcutsBtn) {
        closeShortcutsBtn.addEventListener('click', () => {
            const modal = document.getElementById('shortcuts-modal');
            if (modal) {
                modal.classList.add('hidden');
                keyboardModalOpen = false;
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        // Ignore key events when user is typing in form inputs (D3)
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Escape' || e.key === 'Esc') {
            if (keyboardModalOpen) {
                toggleKeyboardModal();
            } else if (theaterModeActive) {
                toggleTheaterMode(false);
            }
        } else if (e.key === ' ') {
            e.preventDefault();
            const state = getTourState();
            if (currentRouteCoords) {
                if (state.active) {
                    pauseFollowCamera();
                } else {
                    playFollowCamera(currentRouteCoords);
                }
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const state = getTourState();
            if (currentRouteCoords) {
                const newProgress = Math.max(0, state.progress - 0.02);
                setFollowCameraProgress(newProgress);
                if (tourScrubber) tourScrubber.value = Math.round(newProgress * 1000);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const state = getTourState();
            if (currentRouteCoords) {
                const newProgress = Math.min(1, state.progress + 0.02);
                setFollowCameraProgress(newProgress);
                if (tourScrubber) tourScrubber.value = Math.round(newProgress * 1000);
            }
        } else if (e.key === 'f' || e.key === 'F') {
            if (currentRouteCoords) {
                runCameraAction('Framing route...', () => gmp.frameRoute(currentRouteCoords));
            }
        } else if (e.key === 'o' || e.key === 'O') {
            const state = getTourState();
            if (state.active) {
                stopFollowCamera();
            } else {
                runCameraAction('Orbiting current 3D view...', () => gmp.orbitCurrentView(getReducedMotionPreference() ? 2500 : 9000));
            }
        } else if (e.key === '?') {
            toggleKeyboardModal();
        }
    });
}

// --- Theater Mode - D3 ---
function toggleTheaterMode(active) {
    theaterModeActive = active;
    const sidebar = document.querySelector('aside');
    if (active) {
        if (sidebar) sidebar.classList.add('hidden');
        if (theaterPill) theaterPill.classList.remove('hidden');
    } else {
        if (sidebar) sidebar.classList.remove('hidden');
        if (theaterPill) theaterPill.classList.add('hidden');
    }
}

function setupTheaterMode() {
    theaterToggleBtn = document.getElementById('theater-toggle-btn');
    theaterPill = document.getElementById('theater-pill');
    theaterExpandBtn = document.getElementById('theater-expand-btn');
    theaterPlayBtn = document.getElementById('theater-play-btn');
    theaterStopBtn = document.getElementById('theater-stop-btn');
    theaterReadout = document.getElementById('theater-readout');
    theaterPlayIcon = document.getElementById('theater-play-icon');
    theaterPauseIcon = document.getElementById('theater-pause-icon');

    if (theaterToggleBtn) {
        theaterToggleBtn.addEventListener('click', () => toggleTheaterMode(true));
    }
    if (theaterExpandBtn) {
        theaterExpandBtn.addEventListener('click', () => toggleTheaterMode(false));
    }
    if (theaterPlayBtn) {
        theaterPlayBtn.addEventListener('click', () => {
            const state = getTourState();
            if (state.active) {
                pauseFollowCamera();
            } else {
                playFollowCamera(currentRouteCoords);
            }
        });
    }
    if (theaterStopBtn) {
        theaterStopBtn.addEventListener('click', () => {
            stopFollowCamera();
            toggleTheaterMode(false); // Automatically restore sidebar when stopped
        });
    }
}

// --- Live Telemetry Calculations - D5 ---
function getTelemetryAtDistance(distanceKm) {
    if (!currentActivityElevations || currentActivityElevations.length < 2) {
        return { elevationM: 0, grade: 0 };
    }
    
    // Find the segment containing distanceKm
    let i = 0;
    while (i < currentActivityElevations.length - 1 && currentActivityElevations[i + 1].distanceKm < distanceKm) {
        i++;
    }
    
    const p1 = currentActivityElevations[i];
    const p2 = currentActivityElevations[i + 1];
    
    if (!p1 || !p2) {
        return { elevationM: p1?.elevationM || 0, grade: 0 };
    }
    
    const segmentDistKm = p2.distanceKm - p1.distanceKm;
    let elevationM = p1.elevationM;
    let grade = 0;
    
    if (segmentDistKm > 0) {
        const fraction = (distanceKm - p1.distanceKm) / segmentDistKm;
        elevationM = p1.elevationM + fraction * (p2.elevationM - p1.elevationM);
        
        const rise = p2.elevationM - p1.elevationM;
        const run = segmentDistKm * 1000; // in meters
        if (run > 0) {
            grade = (rise / run) * 100;
        }
    }
    
    return { elevationM, grade };
}

function updateLiveTelemetry(distanceKm) {
    const telemetryDiv = document.getElementById('live-telemetry');
    if (!telemetryDiv) return;

    const { elevationM, grade } = getTelemetryAtDistance(distanceKm);

    const distEl = document.getElementById('telemetry-distance');
    const elevEl = document.getElementById('telemetry-elevation');
    const gradeEl = document.getElementById('telemetry-grade');

    if (distEl) {
        if (useImperial) {
            distEl.textContent = `${(distanceKm * MILES_PER_KM).toFixed(2)} mi`;
        } else {
            distEl.textContent = `${distanceKm.toFixed(2)} km`;
        }
    }
    if (elevEl) {
        if (useImperial) {
            elevEl.textContent = `${(elevationM * FEET_PER_METER).toFixed(0)} ft`;
        } else {
            elevEl.textContent = `${elevationM.toFixed(0)} m`;
        }
    }
    if (gradeEl) {
        gradeEl.textContent = `${grade.toFixed(1)}%`;
        const absGrade = Math.abs(grade);
        gradeEl.className = 'font-mono text-xs font-bold';
        if (absGrade >= 8) {
            gradeEl.classList.add('text-red-400');
        } else if (absGrade >= 3) {
            gradeEl.classList.add('text-amber-400');
        } else {
            gradeEl.classList.add('text-green-400');
        }
    }
}

// --- Units Imperial/Metric System - D5 ---
function setupUnitsSystem() {
    unitToggleMetricBtn = document.getElementById('unit-toggle-metric');
    unitToggleImperialBtn = document.getElementById('unit-toggle-imperial');

    // Load initial preference from URL query param, then localStorage, then default (true)
    const urlState = readUrlState();
    if (urlState.units === 'metric') {
        useImperial = false;
    } else if (urlState.units === 'imperial') {
        useImperial = true;
    } else {
        const cachedUnits = localStorage.getItem('units');
        if (cachedUnits === 'metric') {
            useImperial = false;
        } else {
            useImperial = true;
        }
    }

    const updateToggleUI = () => {
        if (useImperial) {
            unitToggleImperialBtn?.classList.add('bg-indigo-600', 'text-white');
            unitToggleImperialBtn?.classList.remove('text-gray-400');
            unitToggleImperialBtn?.setAttribute('aria-pressed', 'true');
            unitToggleMetricBtn?.classList.remove('bg-indigo-600', 'text-white');
            unitToggleMetricBtn?.classList.add('text-gray-400');
            unitToggleMetricBtn?.setAttribute('aria-pressed', 'false');
        } else {
            unitToggleMetricBtn?.classList.add('bg-indigo-600', 'text-white');
            unitToggleMetricBtn?.classList.remove('text-gray-400');
            unitToggleMetricBtn?.setAttribute('aria-pressed', 'true');
            unitToggleImperialBtn?.classList.remove('bg-indigo-600', 'text-white');
            unitToggleImperialBtn?.classList.add('text-gray-400');
            unitToggleImperialBtn?.setAttribute('aria-pressed', 'false');
        }
    };

    const handleUnitsChange = (newVal) => {
        if (useImperial === newVal) return;
        useImperial = newVal;
        localStorage.setItem('units', useImperial ? 'imperial' : 'metric');
        updateToggleUI();
        updateUrlState();

        // 1. Re-render activity stats if loaded
        if (currentActivityData) {
            updateStatsUI(currentActivityData, currentStreams?.altitudeStream);
        }
        // 2. Re-render activity picker select dropdown
        renderActivityDropdown();
        // 3. Re-draw elevation profile
        if (currentActivityElevations && currentActivityElevations.length > 0) {
            drawElevationSVG(currentActivityElevations);
        }
        // 4. Update player total distance text
        if (currentActivityData && tourDistanceTotal) {
            tourDistanceTotal.textContent = formatDistance(currentActivityData.distance, useImperial);
        }
        // 5. Update elapsed progress readout
        const state = getTourState();
        if (state.active || state.progress > 0) {
            const currentDistKm = state.progress * (currentActivityData?.distance / 1000 || 0);
            if (tourDistanceElapsed) {
                const totalDistFormatted = formatDistance(currentActivityData?.distance || 0, useImperial);
                const elapsedFormatted = useImperial ? `${(currentDistKm * MILES_PER_KM).toFixed(2)} mi` : `${currentDistKm.toFixed(2)} km`;
                tourDistanceElapsed.textContent = `${elapsedFormatted} / ${totalDistFormatted}`;
            }
            if (theaterReadout && currentActivityData) {
                const totalDistFormatted = formatDistance(currentActivityData.distance, useImperial);
                const elapsedFormatted = useImperial ? `${(currentDistKm * MILES_PER_KM).toFixed(2)} mi` : `${currentDistKm.toFixed(2)} km`;
                theaterReadout.textContent = `${elapsedFormatted} / ${totalDistFormatted}`;
            }
        }
    };

    unitToggleMetricBtn?.addEventListener('click', () => handleUnitsChange(false));
    unitToggleImperialBtn?.addEventListener('click', () => handleUnitsChange(true));
    
    updateToggleUI();
}

// --- Responsive Mobile Bottom Sheet snap logic - D6 ---
function setupBottomSheet() {
    const dragHandle = document.getElementById('bottom-sheet-drag');
    const sidebar = document.querySelector('aside');
    if (!dragHandle || !sidebar) return;

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;

    const getHeights = () => {
        const vh = window.visualViewport?.height || window.innerHeight;
        const safeBottom = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom')) || 0;
        // Taller snap points than the original 18% / 56%: the peek state now shows
        // the handle plus the header and first control row, and the half state
        // fits the stats grid and player without a second drag.
        return {
            peek: Math.max(140, vh * 0.24),
            half: Math.max(380, vh * 0.64),
            full: Math.max(440, vh - 12 - safeBottom)
        };
    };

    const setHeight = (h) => {
        sidebar.style.height = `${h}px`;
    };

    const enableTransition = (enable) => {
        if (enable) {
            sidebar.classList.add('transition-[height]', 'duration-300', 'ease-out');
        } else {
            sidebar.classList.remove('transition-[height]', 'duration-300', 'ease-out');
        }
    };

    dragHandle.addEventListener('touchstart', (e) => {
        if (window.innerWidth >= 768) return; // Ignore on desktop
        startY = e.touches[0].clientY;
        startHeight = sidebar.getBoundingClientRect().height;
        isDragging = true;
        enableTransition(false);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = startY - currentY; // positive = dragging up
        const newHeight = startHeight + deltaY;
        const heights = getHeights();
        const clampedHeight = Math.max(heights.peek, Math.min(heights.full, newHeight));
        setHeight(clampedHeight);
    }, { passive: false });

    window.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        enableTransition(true);

        const currentHeight = sidebar.getBoundingClientRect().height;
        const heights = getHeights();

        const distPeek = Math.abs(currentHeight - heights.peek);
        const distHalf = Math.abs(currentHeight - heights.half);
        const distFull = Math.abs(currentHeight - heights.full);

        const minDist = Math.min(distPeek, distHalf, distFull);

        if (minDist === distPeek) {
            currentSheetState = 'peek';
            setHeight(heights.peek);
        } else if (minDist === distHalf) {
            currentSheetState = 'half';
            setHeight(heights.half);
        } else {
            currentSheetState = 'full';
            setHeight(heights.full);
        }
    });

    dragHandle.addEventListener('click', () => {
        if (window.innerWidth >= 768) return;
        enableTransition(true);
        const heights = getHeights();
        if (currentSheetState === 'peek') {
            currentSheetState = 'half';
            setHeight(heights.half);
        } else if (currentSheetState === 'half') {
            currentSheetState = 'full';
            setHeight(heights.full);
        } else {
            currentSheetState = 'peek';
            setHeight(heights.peek);
        }
    });
    
    const handleResize = () => {
        if (window.innerWidth >= 768) {
            sidebar.style.height = ''; // Reset for desktop layout
        } else {
            const heights = getHeights();
            if (currentSheetState === 'peek') setHeight(heights.peek);
            else if (currentSheetState === 'half') setHeight(heights.half);
            else setHeight(heights.full);
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
}

// --- Activity Dropdown Enriched render with groupings & filter - D4 ---
function renderActivityDropdown() {
    if (!selectList) return;

    // Save previous selection if any
    const prevSelectedId = selectList.value;
    selectList.innerHTML = '';

    // Helpers for demo data lacking standard properties
    const getActivityDate = (activity) => {
        if (activity.start_date) return new Date(activity.start_date);
        if (activity.id === 'demo-alpine-ride') return new Date('2026-07-03T10:00:00Z');
        if (activity.id === 'demo-coastal-run') return new Date('2026-07-02T08:00:00Z');
        return new Date();
    };

    // Filter to only include activities that have GPS data
    let gpsActivities = allActivities.filter(activity => activity.map && activity.map.summary_polyline);

    // Apply Sport Filter Chip
    if (selectedSportFilter !== 'all') {
        gpsActivities = gpsActivities.filter(activity => {
            const type = normalizeSportType(activity);
            if (selectedSportFilter === 'ride') return type.includes('ride');
            if (selectedSportFilter === 'run') return type.includes('run');
            if (selectedSportFilter === 'hike') return type === 'hike' || type === 'walk';
            return true;
        });
    }

    // Apply Search Text filter
    const query = (activitySearchInput?.value || '').toLowerCase().trim();
    if (query !== '') {
        gpsActivities = gpsActivities.filter(activity => 
            (activity.name || '').toLowerCase().includes(query)
        );
    }

    // Check if empty
    if (gpsActivities.length === 0) {
        let option = document.createElement('option');
        option.textContent = 'No matching activities found';
        option.disabled = true;
        option.selected = true;
        selectList.appendChild(option);
        return;
    }

    // Sort chronologically (newest first)
    gpsActivities.sort((a, b) => getActivityDate(b) - getActivityDate(a));

    // Group by Month / Year
    const groups = {}; // key = "Month Year" -> value = array of activities
    gpsActivities.forEach(activity => {
        const date = getActivityDate(activity);
        const groupKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(activity);
    });

    // Append "Select an Activity..." default option
    let defaultOption = document.createElement('option');
    defaultOption.textContent = 'Select an Activity...';
    defaultOption.disabled = true;
    if (!prevSelectedId || prevSelectedId === 'Select an Activity...') {
        defaultOption.selected = true;
    }
    selectList.appendChild(defaultOption);

    // Render grouped options
    Object.keys(groups).forEach(groupName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;

        groups[groupName].forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            
            // Format labels with Emojis & Dynamic formats (D4)
            const emoji = sportEmoji(activity);

            const date = getActivityDate(activity);
            const dateStr = date.toLocaleString('default', { month: 'short', day: '2-digit' });
            const distStr = formatDistance(activity.distance, useImperial);
            const elevStr = formatElevation(activity.total_elevation_gain, useImperial);

            // Avoid double emoji if activity.name already contains it
            let cleanName = activity.name || 'Unnamed Activity';
            cleanName = cleanName.replace(/[🚴🚵🏃🥾🚶🏊🛶📍]|⛷️?/gu, '').trim();

            option.textContent = `${emoji} ${cleanName} - ${dateStr} - ${distStr} (${elevStr})`;
            
            if (activity.id.toString() === prevSelectedId?.toString()) {
                option.selected = true;
            }
            optgroup.appendChild(option);
        });

        selectList.appendChild(optgroup);
    });
}

function setupActivityPickerFilters() {
    activitySearchInput = document.getElementById('activity-search');
    sportChipsContainer = document.getElementById('sport-chips');

    // Wire search filter (D4)
    activitySearchInput?.addEventListener('input', () => {
        renderActivityDropdown();
    });

    // Wire sport filter chips (D4)
    if (sportChipsContainer) {
        const chips = sportChipsContainer.querySelectorAll('.sport-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                // Update active styles
                chips.forEach(c => {
                    c.classList.remove('bg-indigo-600', 'text-white');
                    c.classList.add('bg-white/5', 'text-gray-400', 'hover:text-white');
                    c.setAttribute('aria-checked', 'false');
                });
                
                chip.classList.add('bg-indigo-600', 'text-white');
                chip.classList.remove('bg-white/5', 'text-gray-400', 'hover:text-white');
                chip.setAttribute('aria-checked', 'true');

                selectedSportFilter = chip.dataset.sport;
                renderActivityDropdown();
            });
        });
    }
}

// --- Initialization ---
async function initApp() {
    debug("Initializing App...");
    setupShareButton();
    const urlState = readUrlState();

    // Get DOM elements
    mapHost = document.getElementById("map3d-host");
    stravaConnectButton = document.getElementById('strava-connect-button');
    stravaAuthDiv = document.getElementById('strava_auth');
    demoButton = document.getElementById('demo-button');
    loadingIndicator = document.getElementById('loading-indicator');
    loadingText = document.getElementById('loading-text');
    errorMessageDiv = document.getElementById('error-message');
    statsContainer = document.getElementById('activity-stats');
    activityNameEl = document.getElementById('activity-name');
    activityDistEl = document.getElementById('activity-distance');
    activityTimeEl = document.getElementById('activity-time');
    activityElevEl = document.getElementById('activity-elevation');
    activityAvgSpeedEl = document.getElementById('activity-avg-speed');
    activityMaxSpeedEl = document.getElementById('activity-max-speed');
    activityTotalLossEl = document.getElementById('activity-total-loss');
    activityFilterDiv = document.getElementById('activity-filter');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    activityCountInput = document.getElementById('activity-count');
    fetchFilteredButton = document.getElementById('fetch-filtered-activities');
    footerAthleteInfo = document.getElementById('footer-athlete-info');
    footerProfileImg = document.getElementById('footer-strava_profile');
    footerProfileName = document.getElementById('footer-strava-username');
    logoutButton = document.getElementById('logout-button');
    cameraStatusEl = document.getElementById('camera-status');
    fitRouteButton = document.getElementById('fit-route-button');
    flyStartButton = document.getElementById('fly-start-button');
    flyFinishButton = document.getElementById('fly-finish-button');
    orbitRouteButton = document.getElementById('orbit-route-button');

    // Tour player controls
    tourScrubber = document.getElementById('tour-scrubber');
    tourPlayBtn = document.getElementById('tour-play-btn');
    tourStopBtn = document.getElementById('tour-stop-btn');
    playIcon = document.getElementById('play-icon');
    pauseIcon = document.getElementById('pause-icon');
    tourDistanceElapsed = document.getElementById('tour-distance-elapsed');
    tourDistanceTotal = document.getElementById('tour-distance-total');

    // Settings sliders
    followCameraSpeedSlider = document.getElementById('follow-camera-speed-slider');
    followCameraSpeedValue = document.getElementById('follow-camera-speed-value');
    tourHeightSlider = document.getElementById('tour-height-slider');
    tourHeightValue = document.getElementById('tour-height-value');
    tourRangeSlider = document.getElementById('tour-range-slider');
    tourRangeValue = document.getElementById('tour-range-value');
    tourTiltSlider = document.getElementById('tour-tilt-slider');
    tourTiltValue = document.getElementById('tour-tilt-value');
    tourSmoothnessSlider = document.getElementById('tour-smoothness-slider');
    tourSmoothnessValue = document.getElementById('tour-smoothness-value');

    // Elevation Profile DOM
    elevationProfileContainer = document.getElementById('elevation-profile-container');
    elevationPlaceholder = document.getElementById('elevation-placeholder');
    elevationSvg = document.getElementById('elevation-svg');
    elevationHoverLine = document.getElementById('elevation-hover-line');
    elevationProgressLine = document.getElementById('elevation-progress-line');
    elevationHoverDot = document.getElementById('elevation-hover-dot');
    elevationTooltip = document.getElementById('elevation-tooltip');

    if (!mapHost || !activityFilterDiv || !fetchFilteredButton || !footerAthleteInfo || !logoutButton || !stravaConnectButton || !stravaAuthDiv || !activityTotalLossEl || !fitRouteButton || !flyStartButton || !flyFinishButton || !orbitRouteButton || !cameraStatusEl || !tourPlayBtn || !tourScrubber || !elevationProfileContainer || !demoButton) {
        showError("Essential HTML elements are missing. Cannot initialize.");
        return;
    }

    // Setup helper dependencies in modules
    const helpers = { showLoading, showError };
    strava.setHelpers(helpers);
    gmp.setHelpers(helpers);

    // Setup Units System (Metric/Imperial)
    setupUnitsSystem();

    // Setup Activity search & sport type filters
    setupActivityPickerFilters();

    // Setup Keyboard shortcuts modal listeners
    setupKeyboardShortcuts();

    // Setup Theater Mode floating bar click events
    setupTheaterMode();

    // Setup Mobile responsive bottom sheet touch drag/snapping
    setupBottomSheet();

    // Setup demo button click listener
    demoButton.onclick = () => {
        gmp.stopDefaultOrbit(); // Stop default orbit when demo occurs
        demoMode = true;
        stravaAuthDiv.style.display = 'none';
        if (activityFilterDiv) activityFilterDiv.classList.remove('hidden');
        if (logoutButton) {
            logoutButton.classList.remove('hidden');
            logoutButton.onclick = handleLogout;
        }
        handleActivitiesResponse(demoActivities);
    };

    // Set initial date inputs for filters
    setInitialDateInputs(urlState);

    // Initialize Tour Player listeners & callbacks
    initTourPlayer(urlState);

    // Initialize Elevation Profile hover events
    initElevationHover();

    try {
        // Initialize Google Maps Platform
        await gmp.initMap(mapHost, import.meta.env.VITE_GMP_API_KEY);

        // Enable buttons once map is ready
        if (stravaConnectButton) {
            stravaConnectButton.disabled = false;
            stravaConnectButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (demoButton) {
            demoButton.disabled = false;
            demoButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        // --- Strava Auth Flow ---
        const urlParams = new URLSearchParams(window.location.search);
        const temp_token = urlParams.get('code');
        const urlStateParam = urlParams.get('state');

        const activeUrlState = readUrlState();
        if (activeUrlState.activityId && activeUrlState.activityId.startsWith('demo-')) {
            gmp.stopDefaultOrbit();
            demoMode = true;
            if (stravaAuthDiv) stravaAuthDiv.style.display = 'none';
            if (activityFilterDiv) activityFilterDiv.classList.remove('hidden');
            if (logoutButton) {
                logoutButton.classList.remove('hidden');
                logoutButton.onclick = handleLogout;
            }
            handleActivitiesResponse(demoActivities);
        } else if (temp_token) {
            gmp.stopDefaultOrbit();
            const storedState = sessionStorage.getItem('oauth_state');
            sessionStorage.removeItem('oauth_state'); // Clear stored state after use

            // Clear OAuth params from URL
            const params = new URLSearchParams(window.location.search);
            params.delete('code');
            params.delete('scope');
            params.delete('state');
            const queryString = params.toString();
            const cleanUrl = window.location.pathname + (queryString ? `?${queryString}` : '');
            window.history.replaceState({}, document.title, cleanUrl);

            if (!urlStateParam || urlStateParam !== storedState) {
                showError("Security error: OAuth state mismatch (potential CSRF request).");
                showStravaLogin();
                return;
            }

            const authData = await strava.exchangeToken(temp_token);
            handleSuccessfulAuth(authData);
        } else {
            const cachedAuthData = strava.getCachedAuthData();
            if (cachedAuthData?.access_token) {
                gmp.stopDefaultOrbit();
                await strava.ensureValidToken();
                handleSuccessfulAuth(strava.getCachedAuthData());
            } else {
                showStravaLogin();
            }
        }

    } catch (err) {
        // A keyless staged build is an intentional, user-visible configuration
        // state. Keep unexpected runtime failures noisy without logging that
        // expected state as a console error.
        if (import.meta.env.VITE_GMP_API_KEY) error("Initialization failed:", err);
        showLoading(false);
        // Never fail silently: without this, a bad/missing Maps key leaves
        // the connect + demo buttons permanently disabled with no explanation.
        showError(
            /API Key/i.test(err?.message || '')
                ? "The 3D map couldn't load: Google Maps API key is missing or invalid for this deployment."
                : `The 3D map couldn't load: ${err?.message || 'unknown error'}. Reload to retry.`
        );
    }

    fitRouteButton.addEventListener('click', () => runCameraAction('Framing route...', () => gmp.frameRoute(currentRouteCoords)));
    flyStartButton.addEventListener('click', () => runCameraAction('Flying to route start...', () => gmp.flyToRoutePoint(currentRouteCoords, 'start')));
    flyFinishButton.addEventListener('click', () => runCameraAction('Flying to route finish...', () => gmp.flyToRoutePoint(currentRouteCoords, 'finish')));
    orbitRouteButton.addEventListener('click', () => runCameraAction('Orbiting current 3D view...', () => gmp.orbitCurrentView(getReducedMotionPreference() ? 2500 : 9000)));
}

function setCameraControlsEnabled(isEnabled) {
    [fitRouteButton, flyStartButton, flyFinishButton, orbitRouteButton, tourPlayBtn, tourStopBtn, tourScrubber, theaterToggleBtn].forEach((el) => {
        if (el) {
            el.disabled = !isEnabled;
            if (isEnabled) {
                el.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                el.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    });

    if (!isEnabled) {
        if (tourStopBtn) {
            tourStopBtn.disabled = true;
            tourStopBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

// --- Authentication Handling ---
function showStravaLogin() {
    stravaAuthDiv.style.display = 'flex';
    const authUrl = strava.getStravaAuthUrl();
    if (authUrl) {
        stravaConnectButton.onclick = () => {
            showLoading(true, "Redirecting to Strava...");
            window.location.href = authUrl;
        };
    } else {
         error("Could not get Strava Auth URL.");
    }
    showLoading(false);

    // Gently auto-orbit the globe over scenic Dolomite mountains (D2)
    gmp.startDefaultOrbit();
}

function handleSuccessfulAuth(authData) {
    if (!authData || !authData.access_token) {
        showError("Strava authentication succeeded but no access token was received.");
        error("Invalid authData received:", authData);
        return;
    }

    stravaAuthDiv.style.display = "none";
    gmp.stopDefaultOrbit(); // Stop default orbit upon login (D2)

    // Update footer profile info
    if (footerProfileImg) footerProfileImg.src = authData.athlete.profile_medium;
    if (footerProfileName) footerProfileName.textContent = `${authData.athlete.firstname} ${authData.athlete.lastname}`;
    if (footerAthleteInfo) footerAthleteInfo.classList.remove('hidden');

    // Show the filter section
    if (activityFilterDiv) activityFilterDiv.classList.remove('hidden');

    // Add listener to the fetch button
    if (fetchFilteredButton) {
        fetchFilteredButton.onclick = () => {
            updateUrlState();
            handleFetchFilteredActivities();
        };
    } else {
         error("Fetch filtered activities button not found.");
    }

    // Add listener for logout button and make it visible
    if (logoutButton) {
        logoutButton.classList.remove('hidden');
        logoutButton.onclick = handleLogout;
    } else {
        error("Logout button not found.");
    }

    // Trigger initial fetch with default filters
    handleFetchFilteredActivities();
}

function updateCameraStatus(message) {
    if (cameraStatusEl) cameraStatusEl.textContent = message;
}

function getReducedMotionPreference() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

async function runCameraAction(status, action) {
    if (!currentRouteCoords) {
        showError('Load an activity route before using camera controls.');
        return;
    }
    updateCameraStatus(status);
    stopFollowCamera();
    await action();
    updateCameraStatus('Camera synced to the selected activity.');
}

async function handleLogout() {
    debug("Logging out...");
    gmp.stopDefaultOrbit();
    if (demoMode) {
        demoMode = false;
        if (footerAthleteInfo) footerAthleteInfo.classList.add('hidden');
        if (logoutButton) logoutButton.classList.add('hidden');
        window.location.href = window.location.pathname;
        return;
    }
    try {
        await strava.deauthorizeStrava();
    } catch (err) {
        warn("Strava deauthorization failed; clearing local session.", err);
        strava.clearStravaToken();
    }
    if (footerAthleteInfo) footerAthleteInfo.classList.add('hidden');
    if (logoutButton) logoutButton.classList.add('hidden');
    window.location.href = window.location.pathname;
}

// --- Activity Fetching and Filtering ---
async function handleFetchFilteredActivities() {
    if (demoMode) {
        handleActivitiesResponse(demoActivities);
        return;
    }
    const token = await strava.ensureValidToken();
    if (!token) {
        showError("Not authenticated with Strava.");
        return;
    }
    if (!startDateInput || !endDateInput || !activityCountInput) {
         showError("Filter input elements not found.");
         return;
    }

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const count = parseInt(activityCountInput.value, 10) || 30;

    let beforeTimestamp = null;
    if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        beforeTimestamp = Math.floor(endOfDay.getTime() / 1000);
    }

    let afterTimestamp = null;
    if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        afterTimestamp = Math.floor(startOfDay.getTime() / 1000);
    }

    try {
        const activities = await strava.fetchActivities(token, beforeTimestamp, afterTimestamp, count);
        handleActivitiesResponse(activities);
    } catch (err) {
        error("Failed to fetch or handle activities:", err);
    }
}

// --- Activity List Handling ---
function handleActivitiesResponse(activities) {
    const actSelectContainer = document.getElementById("act_select");
    selectList = document.getElementById("select_lst");
    if (!selectList || !actSelectContainer) {
        showError("Activity selection UI elements not found.");
        return;
    }

    allActivities = activities || []; // Cache results (D4)

    // Filter to only include activities that have GPS data
    const gpsActivities = allActivities.filter(activity => activity.map && activity.map.summary_polyline);

    if (gpsActivities.length === 0) {
        debug("No GPS-recorded activities found for the selected filters.");
        showError("No GPS-recorded activities found. Manual and indoor activities cannot be explored in 3D.");
        selectList.innerHTML = '<option disabled selected>No GPS activities found</option>';
        actSelectContainer.classList.remove('hidden');
        clearActivityDisplay();
        return;
    }

    actSelectContainer.classList.remove('hidden');
    
    // Group and render select options with Month groupings (D4)
    renderActivityDropdown();

    selectList.onchange = handleActivitySelectionChange;

    // Add a visual cue
    if (selectList && gpsActivities.length > 0) {
        selectList.focus();
        const selectLabel = document.querySelector('label[for="select_lst"]');
        if (selectLabel) {
            const originalText = selectLabel.textContent;
            selectLabel.textContent = "Select an Activity to View!";
            selectLabel.classList.add('text-indigo-400', 'font-semibold');
            setTimeout(() => {
                selectLabel.textContent = originalText;
                selectLabel.classList.remove('text-indigo-400', 'font-semibold');
            }, 3000);
        }
    }

    // Auto-select and trigger the activity if present in URL
    const urlState = readUrlState();
    let foundUrlActivity = false;

    if (urlState.activityId) {
        for (let i = 0; i < selectList.options.length; i++) {
            if (selectList.options[i].value == urlState.activityId) {
                selectList.selectedIndex = i;
                handleActivitySelectionChange({ target: selectList });
                foundUrlActivity = true;
                debug(`[URL State] Auto-selected activity from URL: ${urlState.activityId}`);
                break;
            }
        }
    }

    if (!foundUrlActivity) {
        if (urlState.activityId) {
            debug(`[URL State] Activity ${urlState.activityId} not found in recent list. Fetching detailed activity directly...`);
            clearActivityDisplay();
            fetchAndDisplayDetailedActivity(urlState.activityId);
        } else if (selectList.options.length > 1) {
            // Options array now includes headers/disabled placeholder, so find first actual valued option
            let firstValuedIndex = -1;
            for (let i = 0; i < selectList.options.length; i++) {
                if (selectList.options[i].value && selectList.options[i].value !== 'Select an Activity...') {
                    firstValuedIndex = i;
                    break;
                }
            }
            if (firstValuedIndex !== -1 && selectList.options[firstValuedIndex]) {
                selectList.selectedIndex = firstValuedIndex;
                handleActivitySelectionChange({ target: selectList });
                if (selectList.options[firstValuedIndex]) {
                    debug(`Auto-selected first activity: ${selectList.options[firstValuedIndex].textContent}`);
                }
            } else {
                clearActivityDisplay();
            }
        } else {
            clearActivityDisplay();
        }
    }
}

function handleActivitySelectionChange(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const activityId = selectedOption.value;

    if (activityId && activityId !== 'Select an Activity...') {
         clearActivityDisplay();
         fetchAndDisplayDetailedActivity(activityId);
    }
}

// --- Detailed Activity Display ---
function clearActivityDisplay() {
    debug("Clearing previous activity display (map elements, stats)...");
    stopFollowCamera();
    clearTourRoute();
    gmp.removePreviousPolyline();
    gmp.clearPhotoMarkers();
    gmp.updateTrackingMarker(null);
    currentRouteCoords = null;
    setCameraControlsEnabled(false);
    updateCameraStatus('Load an activity to sync the 3D camera, route, markers, and elevation.');

    // Clear UI stats
    if (statsContainer) statsContainer.classList.add('hidden');
    if (activityNameEl) activityNameEl.textContent = '';
    if (activityDistEl) activityDistEl.textContent = '';
    if (activityTimeEl) activityTimeEl.textContent = '';
    if (activityElevEl) activityElevEl.textContent = '';
    if (activityAvgSpeedEl) activityAvgSpeedEl.textContent = '';
    if (activityMaxSpeedEl) activityMaxSpeedEl.textContent = '';
    if (activityTotalLossEl) activityTotalLossEl.textContent = '';

    // Clear elevation widget
    currentActivityElevations = [];
    showElevationPlaceholder("No activity loaded");
    if (tourDistanceElapsed) tourDistanceElapsed.textContent = '0.00 / 0.00 mi';
    if (tourDistanceTotal) tourDistanceTotal.textContent = 'route total';
    if (tourScrubber) {
        tourScrubber.value = 0;
        tourScrubber.disabled = true;
    }
    
    currentActivityId = null;
    currentActivityData = null;
    currentStreams = null;
    updateUrlState();
    toggleTheaterMode(false);
}

async function fetchAndDisplayDetailedActivity(activityId) {
    if (demoMode || (typeof activityId === 'string' && activityId.startsWith('demo-'))) {
        gmp.stopDefaultOrbit();
        demoMode = true;
        const demoActivity = demoActivities.find(a => a.id === activityId);
        if (demoActivity) {
            currentActivityId = activityId;
            updateUrlState();
            await displayDetailedActivity(demoActivity, demoActivity.streams);
            return;
        }
    }
    const token = await strava.ensureValidToken();
    if (!token) {
        showError("Cannot fetch details, not authenticated.");
        return;
    }
    if (!activityId) {
        showError("Cannot fetch details, no Activity ID provided.");
        return;
    }
    currentActivityId = activityId;

    try {
        updateUrlState();
        const detailedActivityData = await strava.fetchDetailedActivityData(activityId, token);
        let altitudeStream = null;
        let distanceStream = null;
        let latlngStream = null;
        try {
            const streams = await strava.fetchActivityStreams(activityId, token, ['altitude', 'distance', 'latlng']);
            if (streams) {
                altitudeStream = streams.altitude;
                distanceStream = streams.distance;
                latlngStream = streams.latlng;
            }
        } catch (streamError) {
            error(`Failed to fetch streams for activity ${activityId}:`, streamError);
        }
        await displayDetailedActivity(detailedActivityData, { altitudeStream, distanceStream, latlngStream });
    } catch (err) {
        error(`Failed to fetch or display detailed activity ${activityId}:`, err);
    }
}

async function displayDetailedActivity(activityData, streams) {
    const { altitudeStream, latlngStream } = streams || {};
    debug(`[displayDetailedActivity] Called for activity ID: ${activityData?.id}`);
    
    if (!activityData?.map?.polyline) {
        showError("Detailed activity data is missing map polyline.");
        error("Missing polyline:", activityData);
        return;
    }
    
    if (activityData.id != currentActivityId) {
        warn(`[displayDetailedActivity] Stale data received for ${activityData.id}, expected ${currentActivityId}. Ignoring.`);
        return;
    }

    gmp.stopDefaultOrbit(); // Stop onboarding scenic orbit if active
    showLoading(true, "Processing activity route...");

    // Cache activity data for metric/imperial dynamic updates
    currentActivityData = activityData;
    currentStreams = streams;

    // Rider marker artwork follows the activity's sport (MTB vs trail run vs hike ...).
    gmp.setRiderActivityType(activityData);

    const decodedPathLatLng = gmp.decodePolyline(activityData.map.polyline);
    if (decodedPathLatLng.length > 0) {
        if (altitudeStream?.data && latlngStream?.data) {
            const altData = altitudeStream.data;
            const llData = latlngStream.data;
            const streamLen = Math.min(altData.length, llData.length);
            
            if (streamLen > 0) {
                let streamIdx = 0;
                for (let i = 0; i < decodedPathLatLng.length; i++) {
                    const pt = decodedPathLatLng[i];
                    const literal = toLatLngLiteral(pt);
                    const lat = literal.lat;
                    const lng = literal.lng;
                    
                    let bestIdx = streamIdx;
                    let minDiff = Math.abs(llData[streamIdx][0] - lat) + Math.abs(llData[streamIdx][1] - lng);
                    
                    const lookAhead = Math.min(streamLen, streamIdx + 50);
                    for (let j = streamIdx + 1; j < lookAhead; j++) {
                        const diff = Math.abs(llData[j][0] - lat) + Math.abs(llData[j][1] - lng);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestIdx = j;
                        }
                    }
                    streamIdx = bestIdx;
                    pt.altitude = altData[streamIdx];
                }
            }
        }

        gmp.displayPolyline(decodedPathLatLng);

        await gmp.frameRoute(decodedPathLatLng, {
            rangeMultiplier: 1.45,
            tilt: 62,
            duration: getReducedMotionPreference() ? 0 : 1400,
        });
    } else {
        showError("Failed to decode or process activity route.");
        showLoading(false);
        return;
    }

    currentRouteCoords = decodedPathLatLng;
    setCameraControlsEnabled(true);
    updateCameraStatus('Route loaded. Camera shortcuts, 3D endpoints, photo markers, and follow tour are ready.');

    showLoading(false);

    // Update UI Stats
    updateStatsUI(activityData, altitudeStream);

    // Update player total distance label
    if (tourDistanceTotal) {
        tourDistanceTotal.textContent = formatDistance(activityData.distance, useImperial);
    }

    // Configure Elevation Profile Widget
    await configureElevationWidget(decodedPathLatLng, streams);

    // Load Tour Route for Follow Camera
    await loadTourRoute(decodedPathLatLng);

    // Fetch and Display Photos
    if (demoMode || (activityData && activityData.demo)) {
        await gmp.displayPhotoMarkers(activityData.photos || []);
    } else {
        const token = await strava.ensureValidToken();
        if (token) {
            try {
                const photosData = await strava.fetchPhotoData(activityData.id, token);
                if (activityData.id == currentActivityId) {
                     await gmp.displayPhotoMarkers(photosData);
                } else {
                     warn(`[displayDetailedActivity] Stale photo data received for ${activityData.id}, expected ${currentActivityId}. Ignoring.`);
                }
            } catch (photoError) {
                error("Failed to fetch or display photos:", photoError);
            }
        }
    }
}

function updateStatsUI(activityData, altitudeStream) {
    const distanceStr = formatDistance(activityData.distance, useImperial);
    const movingTimeFormatted = formatDuration(activityData.moving_time);
    const elevationGainStr = formatElevation(activityData.total_elevation_gain, useImperial);
    const avgSpeedStr = formatSpeed(activityData.average_speed || 0, useImperial);
    const maxSpeedStr = formatSpeed(activityData.max_speed || 0, useImperial);

    let totalLossStr = 'N/A';
    if (altitudeStream && altitudeStream.data) {
        const calculatedLossMeters = calculateElevationLoss(altitudeStream.data);
        totalLossStr = formatElevation(calculatedLossMeters, useImperial);
    }

    if (activityNameEl) activityNameEl.textContent = activityData.name || 'Unnamed Activity';
    if (activityDistEl) activityDistEl.textContent = distanceStr;
    if (activityTimeEl) activityTimeEl.textContent = movingTimeFormatted;
    if (activityElevEl) activityElevEl.textContent = elevationGainStr;
    if (activityAvgSpeedEl) activityAvgSpeedEl.textContent = avgSpeedStr;
    if (activityMaxSpeedEl) activityMaxSpeedEl.textContent = maxSpeedStr;
    if (activityTotalLossEl) activityTotalLossEl.textContent = totalLossStr;
    if (statsContainer) statsContainer.classList.remove('hidden');
    debug("[updateStatsUI] UI stats updated.");
}

async function configureElevationWidget(decodedPathLatLng, streams) {
    if (!elevationProfileContainer) return;
    
    showElevationPlaceholder("Loading elevation profile...");
    
    let chartPoints = []; // Array of { distanceKm, elevationM, lat, lng }
    const { altitudeStream, distanceStream, latlngStream } = streams || {};
    
    if (altitudeStream?.data && distanceStream?.data && latlngStream?.data) {
        const altData = altitudeStream.data;
        const distData = distanceStream.data;
        const llData = latlngStream.data;
        const length = Math.min(altData.length, distData.length, llData.length);
        
        // Downsample streams for rendering performance
        const targetCount = 300;
        const step = Math.max(1, Math.ceil(length / targetCount));
        
        for (let i = 0; i < length; i += step) {
            chartPoints.push({
                distanceKm: distData[i] / 1000,
                elevationM: altData[i],
                lat: llData[i][0],
                lng: llData[i][1]
            });
        }
        if (length > 0 && (length - 1) % step !== 0) {
            chartPoints.push({
                distanceKm: distData[length - 1] / 1000,
                elevationM: altData[length - 1],
                lat: llData[length - 1][0],
                lng: llData[length - 1][1]
            });
        }
    } else {
        // Fallback: Query Google Maps Elevation Service
        debug("Strava streams missing. Querying Google Maps Elevation API...");
        const maxPoints = 200;
        const downsampledPath = gmp.downsamplePath(decodedPathLatLng, maxPoints);
        
        if (downsampledPath && downsampledPath.length > 0) {
            try {
                const elevations = await gmp.getElevationsForPoints(downsampledPath);
                
                let accumDistKm = 0;
                const firstPt = toLatLngLiteral(downsampledPath[0]);
                chartPoints.push({
                    distanceKm: 0,
                    elevationM: elevations[0],
                    lat: firstPt.lat,
                    lng: firstPt.lng
                });
                
                for (let i = 1; i < downsampledPath.length; i++) {
                    const ptPrev = toLatLngLiteral(downsampledPath[i-1]);
                    const ptCurr = toLatLngLiteral(downsampledPath[i]);
                    const d = haversineKm(ptPrev, ptCurr);
                    accumDistKm += d;
                    chartPoints.push({
                        distanceKm: accumDistKm,
                        elevationM: elevations[i],
                        lat: ptCurr.lat,
                        lng: ptCurr.lng
                    });
                }
            } catch (err) {
                error("Fallback elevation query failed:", err);
            }
        }
    }
    
    if (chartPoints.length < 2) {
        showElevationPlaceholder("Could not load elevation profile");
        return;
    }
    
    currentActivityElevations = chartPoints;
    drawElevationSVG(chartPoints);
}

// --- Dynamic Elevation SVG segment coloring by grade - D5 ---
function drawElevationSVG(points) {
    if (!elevationSvg) return;

    // Convert elevations based on Metric/Imperial setting
    const elevationsUnit = points.map(p => useImperial ? p.elevationM * FEET_PER_METER : p.elevationM);
    const distancesUnit = points.map(p => useImperial ? p.distanceKm * MILES_PER_KM : p.distanceKm);

    const minElev = Math.min(...elevationsUnit);
    const maxElev = Math.max(...elevationsUnit);
    const totalDist = distancesUnit[distancesUnit.length - 1];

    const elevRange = maxElev - minElev;
    const elevPadding = elevRange * 0.1 || 10;
    const yMin = Math.max(0, minElev - elevPadding);
    const yMax = maxElev + elevPadding;

    const svgWidth = 1000;
    const svgHeight = 100;

    let segmentsHtml = '';
    let linePathData = '';
    let areaPathData = '';

    points.forEach((p, idx) => {
        const xPercent = totalDist > 0 ? (useImperial ? p.distanceKm * MILES_PER_KM : p.distanceKm) / totalDist : 0;
        const yPercent = ((useImperial ? p.elevationM * FEET_PER_METER : p.elevationM) - yMin) / (yMax - yMin);

        const x = xPercent * svgWidth;
        const y = svgHeight - (yPercent * svgHeight);

        if (idx === 0) {
            linePathData = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
            areaPathData = `M ${x.toFixed(1)} ${svgHeight} L ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
            linePathData += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            areaPathData += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }

        if (idx < points.length - 1) {
            const p2 = points[idx + 1];
            const x2Percent = totalDist > 0 ? (useImperial ? p2.distanceKm * MILES_PER_KM : p2.distanceKm) / totalDist : 0;
            const y2Percent = ((useImperial ? p2.elevationM * FEET_PER_METER : p2.elevationM) - yMin) / (yMax - yMin);
            const x2 = x2Percent * svgWidth;
            const y2 = svgHeight - (y2Percent * svgHeight);

            // Calculate dynamic grade rise / run * 100
            const rise = p2.elevationM - p.elevationM;
            const run = (p2.distanceKm - p.distanceKm) * 1000; // in meters
            const grade = run > 0 ? (rise / run) * 100 : 0;
            const absGrade = Math.abs(grade);

            let color = '#22c55e'; // Green (<3% grade)
            let fillOpacity = '0.35';
            if (absGrade >= 8) {
                color = '#ef4444'; // Red (>=8% grade)
                fillOpacity = '0.45';
            } else if (absGrade >= 3) {
                color = '#f59e0b'; // Amber/Orange (3% to 8% grade)
                fillOpacity = '0.4';
            }

            segmentsHtml += `
                <polygon points="${x.toFixed(1)},${svgHeight} ${x.toFixed(1)},${y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${svgHeight}" fill="${color}" fill-opacity="${fillOpacity}"></polygon>
                <line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2" stroke-linecap="round"></line>
            `;
        }
    });

    areaPathData += ` L ${svgWidth} ${svgHeight} Z`;

    const areaPath = elevationSvg.querySelector('#elevation-area');
    const linePath = elevationSvg.querySelector('#elevation-line');
    if (areaPath) areaPath.setAttribute('d', areaPathData);
    if (linePath) linePath.setAttribute('d', linePathData);

    const segmentsGroup = elevationSvg.querySelector('#elevation-segments');
    if (segmentsGroup) {
        segmentsGroup.innerHTML = segmentsHtml;
    } else {
        const newGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        newGroup.id = 'elevation-segments';
        newGroup.innerHTML = segmentsHtml;
        elevationSvg.appendChild(newGroup);
    }

    elevationSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    elevationSvg.classList.remove('hidden');
    if (elevationPlaceholder) elevationPlaceholder.classList.add('hidden');
}

function showElevationPlaceholder(text) {
    if (elevationPlaceholder) {
        elevationPlaceholder.textContent = text;
        elevationPlaceholder.classList.remove('hidden');
    }
    if (elevationSvg) elevationSvg.classList.add('hidden');
    if (elevationHoverLine) elevationHoverLine.style.opacity = '0';
    if (elevationHoverDot) elevationHoverDot.style.opacity = '0';
    if (elevationTooltip) elevationTooltip.style.opacity = '0';
    if (elevationProgressLine) elevationProgressLine.style.opacity = '0';
}

function initElevationHover() {
    if (!elevationProfileContainer) return;

    elevationProfileContainer.addEventListener('mousemove', (e) => {
        if (!currentActivityElevations || currentActivityElevations.length < 2) return;

        const rect = elevationProfileContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mousePercent = Math.max(0, Math.min(1, mouseX / rect.width));

        const totalDistKm = currentActivityElevations[currentActivityElevations.length - 1].distanceKm;
        const targetDistKm = mousePercent * totalDistKm;

        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < currentActivityElevations.length; i++) {
            const diff = Math.abs(currentActivityElevations[i].distanceKm - targetDistKm);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }

        const point = currentActivityElevations[closestIdx];
        
        // Dynamic units tooltip readout (D5)
        const pointDist = useImperial ? point.distanceKm * MILES_PER_KM : point.distanceKm;
        const pointElev = useImperial ? point.elevationM * FEET_PER_METER : point.elevationM;
        const distLabel = useImperial ? 'mi' : 'km';
        const elevLabel = useImperial ? 'ft' : 'm';

        const xPos = mousePercent * rect.width;
        if (elevationHoverLine) {
            elevationHoverLine.style.left = `${xPos}px`;
            elevationHoverLine.style.opacity = '1';
        }

        const elevationsUnit = currentActivityElevations.map(p => useImperial ? p.elevationM * FEET_PER_METER : p.elevationM);
        const minElev = Math.min(...elevationsUnit);
        const maxElev = Math.max(...elevationsUnit);
        const elevRange = maxElev - minElev;
        const elevPadding = elevRange * 0.1 || 10;
        const yMin = Math.max(0, minElev - elevPadding);
        const yMax = maxElev + elevPadding;

        const yPercent = (pointElev - yMin) / (yMax - yMin);
        const yPos = rect.height - (yPercent * rect.height);

        if (elevationHoverDot) {
            elevationHoverDot.style.left = `${xPos}px`;
            elevationHoverDot.style.top = `${yPos}px`;
            elevationHoverDot.style.opacity = '1';
        }

        if (elevationTooltip) {
            elevationTooltip.innerHTML = `<strong>Dist:</strong> ${pointDist.toFixed(2)} ${distLabel}<br><strong>Elev:</strong> ${pointElev.toFixed(0)} ${elevLabel}`;
            elevationTooltip.style.opacity = '1';
            
            const tooltipRect = elevationTooltip.getBoundingClientRect();
            let tooltipX = xPos + 10;
            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = xPos - tooltipRect.width - 10;
            }
            let tooltipY = yPos - tooltipRect.height - 10;
            if (tooltipY < 0) {
                tooltipY = yPos + 10;
            }
            elevationTooltip.style.left = `${tooltipX}px`;
            elevationTooltip.style.top = `${tooltipY}px`;
        }

        gmp.updateTrackingMarker({ lat: point.lat, lng: point.lng, altitude: point.elevationM });
    });

    elevationProfileContainer.addEventListener('mouseleave', () => {
        if (elevationHoverLine) elevationHoverLine.style.opacity = '0';
        if (elevationHoverDot) elevationHoverDot.style.opacity = '0';
        if (elevationTooltip) elevationTooltip.style.opacity = '0';
        gmp.updateTrackingMarker(null);
    });
    
    elevationProfileContainer.addEventListener('click', (e) => {
        if (!currentActivityElevations || currentActivityElevations.length < 2) return;
        
        const rect = elevationProfileContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(1, mouseX / rect.width));
        
        setFollowCameraProgress(progress);
        if (tourScrubber) {
            tourScrubber.value = Math.round(progress * 1000);
        }
    });
}

function initTourPlayer(urlState) {
    registerTourCallbacks(
        (progress, distanceElapsedKm) => {
            const totalDistance = currentActivityData?.distance || 0;
            const totalDistanceKm = totalDistance / 1000;
            const distanceElapsedMiles = distanceElapsedKm * MILES_PER_KM;
            const totalMiles = totalDistanceKm * MILES_PER_KM;
            
            if (tourScrubber) {
                tourScrubber.value = Math.round(progress * 1000);
            }
            
            // Format elapsed distance based on Dynamic Metric/Imperial settings (D5)
            const elapsedText = useImperial ? `${distanceElapsedMiles.toFixed(2)} / ${totalMiles.toFixed(2)} mi` : `${distanceElapsedKm.toFixed(2)} / ${totalDistanceKm.toFixed(2)} km`;
            
            if (tourDistanceElapsed) {
                tourDistanceElapsed.textContent = elapsedText;
            }
            if (theaterReadout) {
                theaterReadout.textContent = elapsedText;
            }
            
            if (elevationProgressLine && elevationProfileContainer) {
                const rect = elevationProfileContainer.getBoundingClientRect();
                const xPos = progress * rect.width;
                elevationProgressLine.style.left = `${xPos}px`;
                elevationProgressLine.style.opacity = '1';
            }

            // Update live grade, elevation, and distance (D5)
            updateLiveTelemetry(distanceElapsedKm);
        },
        (state) => {
            debug(`Tour state changed: ${state}`);
            const telemetryDiv = document.getElementById('live-telemetry');
            if (state === 'playing') {
                if (playIcon) playIcon.classList.add('hidden');
                if (pauseIcon) pauseIcon.classList.remove('hidden');
                if (theaterPlayIcon) theaterPlayIcon.classList.add('hidden');
                if (theaterPauseIcon) theaterPauseIcon.classList.remove('hidden');
                if (tourStopBtn) tourStopBtn.disabled = false;
                if (theaterStopBtn) theaterStopBtn.disabled = false;
                if (telemetryDiv) telemetryDiv.classList.remove('hidden');
            } else if (state === 'paused') {
                if (playIcon) playIcon.classList.remove('hidden');
                if (pauseIcon) pauseIcon.classList.add('hidden');
                if (theaterPlayIcon) theaterPlayIcon.classList.remove('hidden');
                if (theaterPauseIcon) theaterPauseIcon.classList.add('hidden');
                if (tourStopBtn) tourStopBtn.disabled = false;
                if (theaterStopBtn) theaterStopBtn.disabled = false;
                if (telemetryDiv) telemetryDiv.classList.remove('hidden');
            } else if (state === 'stopped') {
                if (playIcon) playIcon.classList.remove('hidden');
                if (pauseIcon) pauseIcon.classList.add('hidden');
                if (theaterPlayIcon) theaterPlayIcon.classList.remove('hidden');
                if (theaterPauseIcon) theaterPauseIcon.classList.add('hidden');
                if (tourStopBtn) tourStopBtn.disabled = true;
                if (theaterStopBtn) theaterStopBtn.disabled = true;
                if (elevationProgressLine) elevationProgressLine.style.opacity = '0';
                if (telemetryDiv) telemetryDiv.classList.add('hidden');
                toggleTheaterMode(false); // Restore sidebar when tour stops
            }
        }
    );

    if (tourScrubber) {
        tourScrubber.addEventListener('input', (e) => {
            const progress = parseInt(e.target.value) / 1000;
            setFollowCameraProgress(progress);
        });
    }

    if (tourPlayBtn) {
        tourPlayBtn.addEventListener('click', () => {
            const state = getTourState();
            if (state.active) {
                pauseFollowCamera();
            } else {
                playFollowCamera(currentRouteCoords);
            }
        });
    }

    if (tourStopBtn) {
        tourStopBtn.addEventListener('click', () => {
            stopFollowCamera();
        });
    }

    if (followCameraSpeedSlider) {
        const speedVal = urlState?.cameraSpeed !== null && urlState?.cameraSpeed !== undefined ? urlState.cameraSpeed : 1.0;
        followCameraSpeedSlider.value = speedVal.toString();
        if (followCameraSpeedValue) followCameraSpeedValue.textContent = `${speedVal.toFixed(2)}x`;
        setFollowCameraSpeed(speedVal);
        followCameraSpeedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (followCameraSpeedValue) followCameraSpeedValue.textContent = `${val.toFixed(2)}x`;
            setFollowCameraSpeed(val);
            updateUrlState();
        });
    }

    if (tourHeightSlider) {
        const heightVal = urlState?.cameraHeight !== null && urlState?.cameraHeight !== undefined ? urlState.cameraHeight : 120;
        tourHeightSlider.value = heightVal.toString();
        if (tourHeightValue) tourHeightValue.textContent = `${heightVal}m`;
        setTourSettings({ height: heightVal });
        tourHeightSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (tourHeightValue) tourHeightValue.textContent = `${val}m`;
            setTourSettings({ height: val });
            updateUrlState();
        });
    }

    if (tourRangeSlider) {
        const rangeVal = urlState?.cameraRange !== null && urlState?.cameraRange !== undefined ? urlState.cameraRange : 760;
        tourRangeSlider.value = rangeVal.toString();
        if (tourRangeValue) tourRangeValue.textContent = `${rangeVal}m`;
        setTourSettings({ range: rangeVal });
        tourRangeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (tourRangeValue) tourRangeValue.textContent = `${val}m`;
            setTourSettings({ range: val });
            updateUrlState();
        });
    }

    if (tourTiltSlider) {
        const tiltVal = urlState?.cameraTilt !== null && urlState?.cameraTilt !== undefined ? urlState.cameraTilt : 64;
        tourTiltSlider.value = tiltVal.toString();
        if (tourTiltValue) tourTiltValue.textContent = `${tiltVal}°`;
        setTourSettings({ tilt: tiltVal });
        tourTiltSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (tourTiltValue) tourTiltValue.textContent = `${val}°`;
            setTourSettings({ tilt: val });
            updateUrlState();
        });
    }

    if (tourSmoothnessSlider) {
        const smoothnessVal = urlState?.cameraSmoothness !== null && urlState?.cameraSmoothness !== undefined ? urlState.cameraSmoothness : 0.18;
        tourSmoothnessSlider.value = smoothnessVal.toString();
        if (tourSmoothnessValue) tourSmoothnessValue.textContent = smoothnessVal.toFixed(2);
        setTourSettings({ smoothness: smoothnessVal });
        tourSmoothnessSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (tourSmoothnessValue) tourSmoothnessValue.textContent = val.toFixed(2);
            setTourSettings({ smoothness: val });
            updateUrlState();
        });
    }
}

function setInitialDateInputs(urlState) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (startDateInput) startDateInput.value = urlState?.startDate || formatDate(ninetyDaysAgo);
    if (endDateInput) endDateInput.value = urlState?.endDate || formatDate(tomorrow);
}

// --- Start Application ---
initApp();
