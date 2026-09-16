// ==UserScript==
// @name         MapGenie Unlimited
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Local unlimited locations, presets, profile import/export, and hide-found locations for MapGenie
// @author       TropicalFrog3 + SoggyBurrito (AI Assisted)
// @license      MIT
// @match        https://mapgenie.io/*
// @icon         https://cdn.mapgenie.io/favicons/mapgenie/favicon-32x32.png
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/Map%20Genie%20Unlimited/MapGenieUnlimited(Fixed+Updated).js
// @updateURL    https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/Map%20Genie%20Unlimited/MapGenieUnlimited(Fixed+Updated).js
// @run-at       document-start
// ==/UserScript==
//Based on https://greasyfork.org/en/scripts/560496-mapgenie-unlimited

(function () {
    'use strict';

    const PREFIX = '[MapGenie Unlimited]';

    const PRESETS_KEY = 'mapgenie_local_presets';
    const LOCATIONS_KEY = 'mapgenie_local_locations';
    const HIDE_FOUND_KEY = 'mapgenie_hide_found';

    const MAX_MARKED_LOCATIONS = 999999;

    let presetIdCounter = Date.now();

    // ============================================================
    // STORAGE
    // ============================================================

    function getPresets() {
        try {
            const value = JSON.parse(
                localStorage.getItem(PRESETS_KEY) || '[]'
            );

            return Array.isArray(value)
                ? value.filter(p => p && p.title)
                : [];
        } catch (err) {
            console.warn(
                PREFIX,
                'Could not read presets:',
                err
            );

            return [];
        }
    }

    function savePresets(presets) {
        try {
            localStorage.setItem(
                PRESETS_KEY,
                JSON.stringify(
                    Array.isArray(presets)
                        ? presets.filter(
                            p => p && p.title
                        )
                        : []
                )
            );
        } catch (err) {
            console.error(
                PREFIX,
                'Could not save presets:',
                err
            );
        }
    }

    function getLocations() {
        try {
            const value = JSON.parse(
                localStorage.getItem(LOCATIONS_KEY) || '{}'
            );

            return value &&
                typeof value === 'object' &&
                !Array.isArray(value)
                ? value
                : {};
        } catch (err) {
            console.warn(
                PREFIX,
                'Could not read locations:',
                err
            );

            return {};
        }
    }

    function saveLocations(locations) {
        try {
            localStorage.setItem(
                LOCATIONS_KEY,
                JSON.stringify(locations)
            );
        } catch (err) {
            console.error(
                PREFIX,
                'Could not save locations:',
                err
            );
        }
    }

    function getHideFound() {
        return (
            localStorage.getItem(
                HIDE_FOUND_KEY
            ) === 'true'
        );
    }

    function saveHideFound(value) {
        localStorage.setItem(
            HIDE_FOUND_KEY,
            value ? 'true' : 'false'
        );
    }

    // ============================================================
    // MAP IDENTIFICATION
    // ============================================================

    function getMapKey() {
        const parts =
            window.location.pathname
                .split('/')
                .filter(Boolean);

        const mapsIndex =
            parts.indexOf('maps');

        if (
            mapsIndex < 1 ||
            !parts[mapsIndex + 1]
        ) {
            return null;
        }

        return `${parts[mapsIndex - 1]}_${parts[mapsIndex + 1]}`;
    }

    function getMapLocations() {
        const key = getMapKey();

        if (!key) {
            return [];
        }

        const all = getLocations();

        if (!Array.isArray(all[key])) {
            return [];
        }

        return all[key]
            .map(Number)
            .filter(Number.isFinite);
    }

    function addLocation(id) {
        id = Number(id);

        if (!Number.isFinite(id)) {
            return;
        }

        const key = getMapKey();

        if (!key) {
            return;
        }

        const all = getLocations();

        if (!Array.isArray(all[key])) {
            all[key] = [];
        }

        if (!all[key].includes(id)) {
            all[key].push(id);
            saveLocations(all);
        }

        scheduleHideRefresh();
        updateUI();
    }

    function removeLocation(id) {
        id = Number(id);

        if (!Number.isFinite(id)) {
            return;
        }

        const key = getMapKey();

        if (!key) {
            return;
        }

        const all = getLocations();

        if (Array.isArray(all[key])) {
            all[key] = all[key].filter(
                x => Number(x) !== id
            );

            saveLocations(all);
        }

        scheduleHideRefresh();
        updateUI();
    }

    // ============================================================
    // MAP DATA RESPONSE
    // ============================================================

    function buildMapDataResponse(
        originalData = {}
    ) {
        const localLocations =
            getMapLocations();

        const localPresets =
            getPresets();

        const locations = {};

        for (const id of localLocations) {
            locations[String(id)] = true;
        }

        const result = {
            ...(
                originalData &&
                typeof originalData === 'object'
                    ? originalData
                    : {}
            )
        };

        result.locations = {
            ...(originalData?.locations || {}),
            ...locations
        };

        result.gameLocationsCount =
            Object.keys(
                result.locations
            ).length;

        result.hasPro = true;

        result.maxMarkedLocations =
            MAX_MARKED_LOCATIONS;

        result.presets =
            localPresets;

        if (
            !Array.isArray(
                result.trackedCategoryIds
            )
        ) {
            result.trackedCategoryIds = [];
        }

        if (
            !Array.isArray(
                result.suggestions
            )
        ) {
            result.suggestions = [];
        }

        if (
            !Array.isArray(
                result.notes
            )
        ) {
            result.notes = [];
        }

        return result;
    }

    // ============================================================
    // GLOBAL STATE PATCH
    // ============================================================

    function injectUser(user) {
        if (
            !user ||
            typeof user !== 'object'
        ) {
            return user;
        }

        try {
            user.hasPro = true;

            if (
                !user.locations ||
                typeof user.locations !== 'object'
            ) {
                user.locations = {};
            }

            for (
                const id of getMapLocations()
            ) {
                user.locations[
                    String(id)
                ] = true;
            }

        } catch (err) {
            console.warn(
                PREFIX,
                'User injection failed:',
                err
            );
        }

        return user;
    }

    function injectMapData(data) {
        if (
            !data ||
            typeof data !== 'object'
        ) {
            return data;
        }

        try {
            const patched =
                buildMapDataResponse(data);

            for (
                const key of Object.keys(patched)
            ) {
                data[key] =
                    patched[key];
            }

            return data;

        } catch (err) {
            console.warn(
                PREFIX,
                'Map data injection failed:',
                err
            );

            return data;
        }
    }

    // ============================================================
    // WINDOW.USER
    // ============================================================

    try {
        let internalUser;

        const existingUser =
            Object.getOwnPropertyDescriptor(
                window,
                'user'
            );

        if (
            !existingUser ||
            existingUser.configurable
        ) {
            Object.defineProperty(
                window,
                'user',
                {
                    configurable: true,

                    get() {
                        return internalUser;
                    },

                    set(value) {
                        internalUser =
                            injectUser(value);
                    }
                }
            );
        }

    } catch (err) {
        console.warn(
            PREFIX,
            'Could not hook window.user:',
            err
        );
    }

    // ============================================================
    // WINDOW.MAPDATA
    // ============================================================

    try {
        let internalMapData;

        const existingMapData =
            Object.getOwnPropertyDescriptor(
                window,
                'mapData'
            );

        if (
            !existingMapData ||
            existingMapData.configurable
        ) {
            Object.defineProperty(
                window,
                'mapData',
                {
                    configurable: true,

                    get() {
                        return internalMapData;
                    },

                    set(value) {
                        internalMapData =
                            injectMapData(value);
                    }
                }
            );
        }

    } catch (err) {
        console.warn(
            PREFIX,
            'Could not hook window.mapData:',
            err
        );
    }

    // ============================================================
    // HELPERS
    // ============================================================

    function getUrlString(url) {
        try {
            return new URL(
                String(url),
                window.location.origin
            ).toString();

        } catch {
            return String(url || '');
        }
    }

    function getLocationId(url) {
        const cleanUrl =
            getUrlString(url);

        const match =
            cleanUrl.match(
                /\/api\/v1\/user\/locations\/(\d+)(?:[/?#]|$)/
            );

        return match
            ? Number(match[1])
            : null;
    }

    function getPresetId(url) {
        const cleanUrl =
            getUrlString(url);

        const match =
            cleanUrl.match(
                /\/api\/v1\/user\/presets\/(\d+)(?:[/?#]|$)/
            );

        return match
            ? Number(match[1])
            : null;
    }

    function isMapDataRequest(url) {
        return getUrlString(url).includes(
            '/api/v1/user/map-data/'
        );
    }

    function isPresetRequest(url) {
        return getUrlString(url).includes(
            '/api/v1/user/presets'
        );
    }

    function isLocationRequest(url) {
        return getUrlString(url).includes(
            '/api/v1/user/locations/'
        );
    }

    function parseBody(body) {
        if (!body) {
            return {};
        }

        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch {
                return {};
            }
        }

        if (
            typeof URLSearchParams !==
            'undefined' &&
            body instanceof URLSearchParams
        ) {
            return Object.fromEntries(
                body.entries()
            );
        }

        return body;
    }

      // ============================================================
    // XHR INTERCEPTION
    // ============================================================

    const originalOpen =
        XMLHttpRequest.prototype.open;

    const originalSend =
        XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open =
        function (method, url) {
            this.__mgMethod =
                String(method || 'GET')
                    .toUpperCase();

            this.__mgUrl =
                getUrlString(url);

            return originalOpen.apply(
                this,
                arguments
            );
        };

    XMLHttpRequest.prototype.send =
        function (body) {
            const xhr = this;

            const method =
                xhr.__mgMethod || 'GET';

            const url =
                xhr.__mgUrl || '';

            // ----------------------------------------------------
            // LOCATION PUT / DELETE
            // ----------------------------------------------------

            if (isLocationRequest(url)) {
                const id =
                    getLocationId(url);

                if (
                    id !== null &&
                    method === 'PUT'
                ) {
                    addLocation(id);

                    console.log(
                        PREFIX,
                        'Marked location locally:',
                        id
                    );

                    fakeXHRResponse(
                        xhr,
                        201,
                        '{}',
                        'application/json'
                    );

                    return;
                }

                if (
                    id !== null &&
                    method === 'DELETE'
                ) {
                    removeLocation(id);

                    console.log(
                        PREFIX,
                        'Unmarked location locally:',
                        id
                    );

                    fakeXHRResponse(
                        xhr,
                        204,
                        '',
                        'application/json'
                    );

                    return;
                }
            }

            // ----------------------------------------------------
            // MAP DATA
            // ----------------------------------------------------

            if (
                isMapDataRequest(url) &&
                method === 'GET'
            ) {
                const localLocations =
                    getMapLocations();

                const localPresets =
                    getPresets();

                const response =
                    buildMapDataResponse({
                        locations:
                            Object.fromEntries(
                                localLocations.map(
                                    id => [
                                        String(id),
                                        true
                                    ]
                                )
                            ),

                        presets:
                            localPresets,

                        hasPro: true,

                        maxMarkedLocations:
                            MAX_MARKED_LOCATIONS
                    });

                console.log(
                    PREFIX,
                    'Served local map-data:',
                    localLocations.length,
                    'locations,',
                    localPresets.length,
                    'presets'
                );

                fakeXHRResponse(
                    xhr,
                    200,
                    JSON.stringify(response),
                    'application/json'
                );

                return;
            }

            // ----------------------------------------------------
            // PRESETS
            // ----------------------------------------------------

            if (isPresetRequest(url)) {
                const presetId =
                    getPresetId(url);

                // CREATE
                if (
                    method === 'POST' &&
                    presetId === null
                ) {
                    const data =
                        parseBody(body);

                    const presets =
                        getPresets();

                    const newPreset = {
                        id:
                            presetIdCounter++,

                        game_id:
                            data.game_id,

                        title:
                            data.title,

                        categories:
                            data.categories || [],

                        tags:
                            data.tags || {},

                        ordering:
                            data.ordering || [],

                        created_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString()
                    };

                    presets.push(
                        newPreset
                    );

                    savePresets(
                        presets
                    );

                    console.log(
                        PREFIX,
                        'Saved preset locally:',
                        newPreset.title
                    );

                    fakeXHRResponse(
                        xhr,
                        201,
                        JSON.stringify(
                            newPreset
                        ),
                        'application/json'
                    );

                    return;
                }

                // DELETE
                if (
                    method === 'DELETE' &&
                    presetId !== null
                ) {
                    const presets =
                        getPresets()
                            .filter(
                                p =>
                                    Number(p.id) !==
                                    presetId
                            );

                    savePresets(
                        presets
                    );

                    console.log(
                        PREFIX,
                        'Deleted preset locally:',
                        presetId
                    );

                    fakeXHRResponse(
                        xhr,
                        204,
                        '',
                        'application/json'
                    );

                    return;
                }

                // UPDATE
                if (
                    method === 'PUT' &&
                    presetId !== null
                ) {
                    const data =
                        parseBody(body);

                    const presets =
                        getPresets();

                    const index =
                        presets.findIndex(
                            p =>
                                Number(p.id) ===
                                presetId
                        );

                    if (index !== -1) {
                        presets[index] = {
                            ...presets[index],
                            ...data,

                            id:
                                presets[index].id,

                            updated_at:
                                new Date()
                                    .toISOString()
                        };

                        savePresets(
                            presets
                        );

                        console.log(
                            PREFIX,
                            'Updated preset locally:',
                            presets[index].title
                        );

                        fakeXHRResponse(
                            xhr,
                            200,
                            JSON.stringify(
                                presets[index]
                            ),
                            'application/json'
                        );

                        return;
                    }
                }
            }

            return originalSend.apply(
                this,
                arguments
            );
        };

    // ============================================================
    // FETCH INTERCEPTION
    // ============================================================

    const originalFetch =
        window.fetch;

    if (
        typeof originalFetch ===
        'function'
    ) {
        window.fetch =
            async function (
                input,
                init = {}
            ) {
                const url =
                    typeof input === 'string'
                        ? input
                        : input?.url || '';

                const method =
                    String(
                        init?.method ||
                        (
                            typeof input !==
                            'string'
                                ? input?.method
                                : 'GET'
                        ) ||
                        'GET'
                    ).toUpperCase();

                // ------------------------------------------------
                // LOCATION
                // ------------------------------------------------

                if (
                    isLocationRequest(url)
                ) {
                    const id =
                        getLocationId(url);

                    if (
                        id !== null &&
                        method === 'PUT'
                    ) {
                        addLocation(id);

                        console.log(
                            PREFIX,
                            'Fetch PUT location:',
                            id
                        );

                        return new Response(
                            '{}',
                            {
                                status: 201,

                                headers: {
                                    'Content-Type':
                                        'application/json'
                                }
                            }
                        );
                    }

                    if (
                        id !== null &&
                        method === 'DELETE'
                    ) {
                        removeLocation(id);

                        console.log(
                            PREFIX,
                            'Fetch DELETE location:',
                            id
                        );

                        return new Response(
                            null,
                            {
                                status: 204
                            }
                        );
                    }
                }

                // ------------------------------------------------
                // MAP DATA
                // ------------------------------------------------

                if (
                    isMapDataRequest(url) &&
                    method === 'GET'
                ) {
                    const localLocations =
                        getMapLocations();

                    const response =
                        buildMapDataResponse({
                            locations:
                                Object.fromEntries(
                                    localLocations.map(
                                        id => [
                                            String(id),
                                            true
                                        ]
                                    )
                                ),

                            presets:
                                getPresets(),

                            hasPro: true,

                            maxMarkedLocations:
                                MAX_MARKED_LOCATIONS
                        });

                    console.log(
                        PREFIX,
                        'Fetch map-data:',
                        localLocations.length,
                        'local locations'
                    );

                    return new Response(
                        JSON.stringify(
                            response
                        ),
                        {
                            status: 200,

                            headers: {
                                'Content-Type':
                                    'application/json'
                            }
                        }
                    );
                }

                // ------------------------------------------------
                // PRESETS
                // ------------------------------------------------

                if (
                    isPresetRequest(url)
                ) {
                    const presetId =
                        getPresetId(url);

                    // CREATE
                    if (
                        method === 'POST' &&
                        presetId === null
                    ) {
                        let data = {};

                        try {
                            const requestBody =
                                init?.body ||
                                (
                                    typeof input !==
                                    'string'
                                        ? await input
                                            .clone()
                                            .text()
                                        : null
                                );

                            data =
                                parseBody(
                                    requestBody
                                );

                        } catch {
                            // Leave empty.
                        }

                        const presets =
                            getPresets();

                        const newPreset = {
                            id:
                                presetIdCounter++,

                            game_id:
                                data.game_id,

                            title:
                                data.title,

                            categories:
                                data.categories ||
                                [],

                            tags:
                                data.tags ||
                                {},

                            ordering:
                                data.ordering ||
                                [],

                            created_at:
                                new Date()
                                    .toISOString(),

                            updated_at:
                                new Date()
                                    .toISOString()
                        };

                        presets.push(
                            newPreset
                        );

                        savePresets(
                            presets
                        );

                        return new Response(
                            JSON.stringify(
                                newPreset
                            ),
                            {
                                status: 201,

                                headers: {
                                    'Content-Type':
                                        'application/json'
                                }
                            }
                        );
                    }

                    // DELETE
                    if (
                        method === 'DELETE' &&
                        presetId !== null
                    ) {
                        savePresets(
                            getPresets()
                                .filter(
                                    p =>
                                        Number(
                                            p.id
                                        ) !==
                                        presetId
                                )
                        );

                        return new Response(
                            null,
                            {
                                status: 204
                            }
                        );
                    }

                    // UPDATE
                    if (
                        method === 'PUT' &&
                        presetId !== null
                    ) {
                        let data = {};

                        try {
                            const requestBody =
                                init?.body ||
                                (
                                    typeof input !==
                                    'string'
                                        ? await input
                                            .clone()
                                            .text()
                                        : null
                                );

                            data =
                                parseBody(
                                    requestBody
                                );

                        } catch {
                            // Leave empty.
                        }

                        const presets =
                            getPresets();

                        const index =
                            presets.findIndex(
                                p =>
                                    Number(
                                        p.id
                                    ) ===
                                    presetId
                            );

                        if (index !== -1) {
                            presets[index] = {
                                ...presets[index],
                                ...data,

                                id:
                                    presets[index]
                                        .id,

                                updated_at:
                                    new Date()
                                        .toISOString()
                            };

                            savePresets(
                                presets
                            );

                            return new Response(
                                JSON.stringify(
                                    presets[index]
                                ),
                                {
                                    status: 200,

                                    headers: {
                                        'Content-Type':
                                            'application/json'
                                    }
                                }
                            );
                        }
                    }
                }

                return originalFetch.apply(
                    this,
                    arguments
                );
            };
    }

    // ============================================================
    // FAKE XHR RESPONSE
    // ============================================================

    function fakeXHRResponse(
        xhr,
        status,
        responseText,
        contentType
    ) {
        setTimeout(() => {
            try {
                Object.defineProperty(
                    xhr,
                    'status',
                    {
                        configurable: true,
                        value: status
                    }
                );

                Object.defineProperty(
                    xhr,
                    'statusText',
                    {
                        configurable: true,

                        value:
                            status === 200 ||
                            status === 201
                                ? 'OK'
                                : ''
                    }
                );

                Object.defineProperty(
                    xhr,
                    'readyState',
                    {
                        configurable: true,
                        value: 4
                    }
                );

                Object.defineProperty(
                    xhr,
                    'responseText',
                    {
                        configurable: true,
                        value: responseText
                    }
                );

                Object.defineProperty(
                    xhr,
                    'response',
                    {
                        configurable: true,
                        value: responseText
                    }
                );

                Object.defineProperty(
                    xhr,
                    'getResponseHeader',
                    {
                        configurable: true,

                        value: function (name) {
                            if (
                                String(name)
                                    .toLowerCase() ===
                                'content-type'
                            ) {
                                return contentType;
                            }

                            return null;
                        }
                    }
                );

                xhr.dispatchEvent(
                    new Event(
                        'readystatechange'
                    )
                );

                if (
                    status >= 200 &&
                    status < 300
                ) {
                    xhr.dispatchEvent(
                        new Event('load')
                    );
                } else {
                    xhr.dispatchEvent(
                        new Event('error')
                    );
                }

                xhr.dispatchEvent(
                    new Event('loadend')
                );

            } catch (err) {
                console.error(
                    PREFIX,
                    'Could not create fake XHR response:',
                    err
                );
            }
        }, 0);
    }
    // ============================================================
    // HIDE FOUND LOCATIONS
    //
    // IMPORTANT:
    // We do NOT hide the entire locations layer.
    //
    // We preserve MapGenie's existing filter and add an
    // exclusion for locally-found location IDs.
    // ============================================================

    let hideRefreshTimer = null;
    let hideFilterInstalled = false;
    let lastHideFilter = null;
    let lastHideExpression = null;

    function cloneFilter(filter) {
        if (!filter) {
            return null;
        }

        try {
            return JSON.parse(
                JSON.stringify(filter)
            );
        } catch {
            return filter;
        }
    }

    function filtersEqual(a, b) {
        try {
            return JSON.stringify(a) ===
                JSON.stringify(b);
        } catch {
            return a === b;
        }
    }

    function makeHideExpression() {
        const ids =
            getMapLocations();

        if (!ids.length) {
            return null;
        }

        return [
            '!',
            [
                'in',
                ['to-number', ['get', 'locationId']],
                ['literal', ids]
            ]
        ];
    }

    function makeCombinedFilter(baseFilter) {
        const hideExpression =
            makeHideExpression();

        if (!hideExpression) {
            return baseFilter;
        }

        if (!baseFilter) {
            return [
                'all',
                hideExpression
            ];
        }

        return [
            'all',
            baseFilter,
            hideExpression
        ];
    }

    function getMapInstance() {
        try {
            if (
                window.map &&
                typeof window.map.getLayer ===
                    'function'
            ) {
                return window.map;
            }
        } catch {
            // Ignore.
        }

        return null;
    }

    function applyHideFound() {
        if (!getHideFound()) {
            restoreHideFilter();
            return;
        }

        const map =
            getMapInstance();

        if (!map) {
            return;
        }

        try {
            if (
                !map.getLayer('locations')
            ) {
                return;
            }

            const currentFilter =
                map.getFilter('locations');

            if (
                hideFilterInstalled &&
                filtersEqual(
                    currentFilter,
                    lastHideFilter
                ) &&
                filtersEqual(
                    makeHideExpression(),
                    lastHideExpression
                )
            ) {
                return;
            }


            let baseFilter =
                currentFilter;

            // If our filter is already installed,
            // remove our previous exclusion first.
            if (
                hideFilterInstalled &&
                Array.isArray(currentFilter) &&
                currentFilter[0] === 'all' &&
                currentFilter.length === 3 &&
                filtersEqual(
                    currentFilter[2],
                    lastHideExpression
                )
            ) {
                baseFilter =
                    currentFilter[1];
            }

            const newFilter =
                makeCombinedFilter(
                    cloneFilter(baseFilter)
                );

            // If there is nothing to hide, restore the
            // existing MapGenie filter.
            if (!newFilter) {
                restoreHideFilter();
                return;
            }

            if (
                filtersEqual(
                    currentFilter,
                    newFilter
                )
            ) {
                return;
            }

            map.setFilter(
                'locations',
                newFilter
            );

            lastHideFilter =
                cloneFilter(newFilter);

            lastHideExpression =
                makeHideExpression();

            hideFilterInstalled = true;

        } catch (err) {
            console.warn(
                PREFIX,
                'Could not apply hide-found filter:',
                err
            );
        }
    }

    function restoreHideFilter() {
        const map =
            getMapInstance();

        if (!map) {
            return;
        }

        try {
            if (
                !map.getLayer('locations')
            ) {
                return;
            }

            const currentFilter =
                map.getFilter('locations');

            if (
                hideFilterInstalled &&
                Array.isArray(currentFilter) &&
                currentFilter[0] === 'all' &&
                currentFilter.length === 3 &&
                lastHideExpression &&
                filtersEqual(
                    currentFilter[2],
                    lastHideExpression
                )
            ) {
                map.setFilter(
                    'locations',
                    currentFilter[1] || null
                );
            }

            hideFilterInstalled = false;
            lastHideFilter = null;
            lastHideExpression = null;

        } catch (err) {
            console.warn(
                PREFIX,
                'Could not restore location filter:',
                err
            );
        }
    }

    function scheduleHideRefresh() {
        clearTimeout(
            hideRefreshTimer
        );

        hideRefreshTimer =
            setTimeout(() => {
                applyHideFound();
            }, 50);
    }

    // ============================================================
    // WATCH MAP
    // ============================================================

    function startMapWatcher() {
        setInterval(() => {
            const map =
                getMapInstance();

            if (
                map &&
                typeof map.getLayer ===
                    'function'
            ) {
                try {
                    if (
                        map.getLayer(
                            'locations'
                        )
                    ) {
                        applyHideFound();

                        if (
                            getHideFound()
                        ) {
                            maintainHideFilter();
                        }
                    }
                } catch {
                    // Map may still be loading.
                }
            }
        }, 500);
    }

    function maintainHideFilter() {
        if (!getHideFound()) {
            return;
        }

        const map =
            getMapInstance();

        if (!map) {
            return;
        }

        try {
            if (
                !map.getLayer(
                    'locations'
                )
            ) {
                return;
            }

            const currentFilter =
                map.getFilter(
                    'locations'
                );

            const expectedExpression =
                makeHideExpression();

            if (
                Array.isArray(currentFilter) &&
                currentFilter[0] === 'all' &&
                currentFilter.length === 3 &&
                expectedExpression &&
                filtersEqual(
                    currentFilter[2],
                    expectedExpression
                )
            ) {
                lastHideExpression =
                    cloneFilter(
                        expectedExpression
                    );

                lastHideFilter =
                    cloneFilter(
                        currentFilter
                    );

                hideFilterInstalled =
                    true;

                return;
            }

            const newFilter =
                makeCombinedFilter(
                    cloneFilter(
                        currentFilter
                    )
                );

            if (
                !newFilter
            ) {
                return;
            }

            if (
                filtersEqual(
                    currentFilter,
                    newFilter
                )
            ) {
                return;
            }

            map.setFilter(
                'locations',
                newFilter
            );

            lastHideExpression =
                cloneFilter(
                    expectedExpression
                );

            lastHideFilter =
                cloneFilter(
                    newFilter
                );

            hideFilterInstalled =
                true;

        } catch {
            // Ignore transient map/style changes.
        }
    }
// ============================================================
// EXPORT / IMPORT
// ============================================================

function buildProfileExport() {
    return {
        format:
            'MapGenie Unlimited Profile',

        version: 1,

        exportedAt:
            new Date().toISOString(),

        presets:
            getPresets(),

        locations:
            getLocations(),

        settings: {
            hideFound:
                getHideFound()
        }
    };
}

function exportProfile() {
    try {
        const data =
            buildProfileExport();

        const json =
            JSON.stringify(
                data,
                null,
                2
            );

        const blob =
            new Blob(
                [json],
                {
                    type:
                        'application/json'
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                'a'
            );

        link.href = url;

        const mapName =
            document.title
                .replace(/\s*[-|]\s*MapGenie.*$/i, '')
                .trim();

        const date =
            new Date()
                .toISOString()
                .slice(0, 10);

        link.download =
            `mapgenie-${mapName || 'map'}-${date}.json`;


        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        // Give the browser a moment to finish
        // consuming the object URL.
        setTimeout(
            () => {
                URL.revokeObjectURL(
                    url
                );
            },
            1000
        );

        console.log(
            PREFIX,
            'Profile exported.'
        );

    } catch (err) {
        console.error(
            PREFIX,
            'Export failed:',
            err
        );

        alert(
            'MapGenie Unlimited: export failed. Check the console for details.'
        );
    }
}

function importProfileObject(data) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        throw new Error(
            'Invalid profile.'
        );
    }

    // --------------------------------------------------------
    // Current format: locations
    // --------------------------------------------------------

    if (
        data.locations &&
        typeof data.locations ===
            'object' &&
        !Array.isArray(
            data.locations
        )
    ) {
        saveLocations(
            data.locations
        );
    }

    // --------------------------------------------------------
    // Current format: presets
    // --------------------------------------------------------

    if (
        Array.isArray(
            data.presets
        )
    ) {
        savePresets(
            data.presets
        );
    }

    // --------------------------------------------------------
    // Settings
    // --------------------------------------------------------

    if (
        data.settings &&
        typeof data.settings ===
            'object' &&
        typeof data.settings.hideFound ===
            'boolean'
    ) {
        saveHideFound(
            data.settings.hideFound
        );
    }

    // --------------------------------------------------------
    // Older export format support
    // --------------------------------------------------------

    if (
        data.localLocations &&
        typeof data.localLocations ===
            'object'
    ) {
        saveLocations(
            data.localLocations
        );
    }

    if (
        data.localPresets &&
        Array.isArray(
            data.localPresets
        )
    ) {
        savePresets(
            data.localPresets
        );
    }

    // Prevent collisions with imported preset IDs.
    presetIdCounter =
        Date.now();

    // Rebuild the hide-found filter using
    // the newly imported data.
    restoreHideFilter();

    setTimeout(
        () => {
            applyHideFound();
        },
        100
    );

    updateUI();

    return true;
}

function importProfile(file) {
    if (!file) {
        return;
    }

    const reader =
        new FileReader();

    reader.onload =
        function () {
            try {
                const data =
                    JSON.parse(
                        reader.result
                    );

                importProfileObject(
                    data
                );

                alert(
                    'MapGenie Unlimited profile imported successfully.'
                );

                setTimeout(() => {
                    window.location.reload();
                }, 0);

                console.log(
                    PREFIX,
                    'Profile imported.'
                );

            } catch (err) {
                console.error(
                    PREFIX,
                    'Import failed:',
                    err
                );

                alert(
                    'MapGenie Unlimited: invalid or unreadable profile.'
                );
            }
        };

    reader.onerror =
        function () {
            alert(
                'MapGenie Unlimited: could not read the file.'
            );
        };

    reader.readAsText(
        file
    );
}

  // ============================================================
// CUSTOM UI
//
// The UI is inserted into MapGenie's EXISTING user panel.
//
// Structure:
//
//   Progress Tracker
//   Profile
//   Notes
//   Found Locations
//   Track Category
//   Tip
//   ------------------------
//   MapGenie Unlimited
//   Hide found locations [x]
//   Export Profile   Import Profile
//   ------------------------
//   Logout   My Account
//
// This means its position automatically follows the panel at
// any browser/window size.
// ============================================================

let panel = null;

function createUI() {
    if (
        document.getElementById(
            'mg-unlimited-settings'
        )
    ) {
        return true;
    }

    const userPanel =
        document.getElementById(
            'user-panel'
        );

    if (!userPanel) {
        return false;
    }

    const logout =
        userPanel.querySelector(
            '.logout'
        );

    if (!logout) {
        return false;
    }

    // --------------------------------------------------------
    // Main container
    // --------------------------------------------------------

    panel =
        document.createElement(
            'div'
        );

    panel.id =
        'mg-unlimited-settings';

    panel.innerHTML = `
        <hr>

        <div class="mg-unlimited-title">
            MapGenie Unlimited
        </div>

        <label
            class="mg-unlimited-toggle"
            title="Hide locations you have marked as found"
        >
            <input
                type="checkbox"
                id="mg-hide-found"
            >

            <span class="mg-checkbox"></span>

            <span class="mg-toggle-text">
                Hide found locations
            </span>
        </label>

        <div class="mg-unlimited-buttons">

            <button
                type="button"
                id="mg-export"
                class="mg-unlimited-button"
            >
                Export Profile
            </button>

            <button
                type="button"
                id="mg-import"
                class="mg-unlimited-button"
            >
                Import Profile
            </button>

        </div>

        <input
            type="file"
            id="mg-import-file"
            accept=".json,application/json"
            style="display:none;"
        >

        <div
            id="mg-stats"
            class="mg-unlimited-stats"
        ></div>
    `;

    // --------------------------------------------------------
    // Insert immediately BEFORE Logout/My Account
    // --------------------------------------------------------

    userPanel.insertBefore(
        panel,
        logout
    );

    // --------------------------------------------------------
    // Styling
    // --------------------------------------------------------

    if (
        !document.getElementById(
            'mg-unlimited-styles'
        )
    ) {
        const style =
            document.createElement(
                'style'
            );

        style.id =
            'mg-unlimited-styles';

        style.textContent = `

            #mg-unlimited-settings {
                width: 100%;
                box-sizing: border-box;
                color: inherit;
                font-size: inherit;
            }

            #mg-unlimited-settings hr {
                margin-top: 10px;
                margin-bottom: 10px;
            }

            .mg-unlimited-title {
                text-align: center;
                font-weight: 600;
                font-size: 12px;
                line-height: 18px;
                margin-bottom: 8px;
                opacity: .9;
            }

            .mg-unlimited-toggle {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                cursor: pointer;
                user-select: none;
                margin: 0 0 9px 0;
                min-height: 24px;
            }

            .mg-unlimited-toggle input {
                position: absolute;
                opacity: 0;
                pointer-events: none;
            }

            .mg-checkbox {
                width: 15px;
                height: 15px;
                min-width: 15px;
                box-sizing: border-box;
                border: 1px solid rgba(255,255,255,.35);
                border-radius: 3px;
                background: rgba(0,0,0,.12);
                position: relative;
                transition:
                    background .12s ease,
                    border-color .12s ease;
            }

            .mg-unlimited-toggle
            input:checked
            + .mg-checkbox {
                background: #4c9aff;
                border-color: #4c9aff;
            }

            .mg-unlimited-toggle
            input:checked
            + .mg-checkbox::after {
                content: '';
                position: absolute;
                width: 4px;
                height: 8px;
                left: 5px;
                top: 2px;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            .mg-toggle-text {
                line-height: 18px;
            }

            .mg-unlimited-buttons {
                display: flex;
                justify-content: center;
                gap: 6px;
                width: 100%;
                box-sizing: border-box;
            }

            .mg-unlimited-button {
                appearance: none;
                -webkit-appearance: none;
                border: 1px solid rgba(255,255,255,.22);
                background: rgba(255,255,255,.07);
                color: inherit;
                border-radius: 3px;
                padding: 5px 8px;
                font-family: inherit;
                font-size: 11px;
                line-height: 16px;
                cursor: pointer;
                transition:
                    background .12s ease,
                    border-color .12s ease;
                flex: 1;
                min-width: 0;
            }

            .mg-unlimited-button:hover {
                background: rgba(255,255,255,.14);
                border-color: rgba(255,255,255,.35);
            }

            .mg-unlimited-button:active {
                background: rgba(255,255,255,.19);
            }

            .mg-unlimited-stats {
                display: none;
            }

            @media (max-width: 400px) {
                .mg-unlimited-buttons {
                    flex-direction: column;
                }

                .mg-unlimited-button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // --------------------------------------------------------
    // Hide-found checkbox
    // --------------------------------------------------------

    const hideCheckbox =
        panel.querySelector(
            '#mg-hide-found'
        );

    hideCheckbox.checked =
        getHideFound();

    hideCheckbox.addEventListener(
        'change',
        () => {
            const enabled =
                hideCheckbox.checked;

            saveHideFound(
                enabled
            );

            if (enabled) {
                applyHideFound();
            } else {
                restoreHideFilter();
            }

            updateUI();

            console.log(
                PREFIX,
                'Hide found:',
                enabled
            );
        }
    );

    // --------------------------------------------------------
    // Export
    // --------------------------------------------------------

    panel.querySelector(
        '#mg-export'
    ).addEventListener(
        'click',
        exportProfile
    );

    // --------------------------------------------------------
    // Import
    // --------------------------------------------------------

    const importFile =
        panel.querySelector(
            '#mg-import-file'
        );

    panel.querySelector(
        '#mg-import'
    ).addEventListener(
        'click',
        () => {
            importFile.value = '';
            importFile.click();
        }
    );

    importFile.addEventListener(
        'change',
        () => {
            if (
                importFile.files &&
                importFile.files[0]
            ) {
                importProfile(
                    importFile.files[0]
                );
            }
        }
    );

    updateUI();

    console.log(
        PREFIX,
        'UI inserted into #user-panel.'
    );

    return true;
}

function updateUI() {
    if (!panel) {
        panel =
            document.getElementById(
                'mg-unlimited-settings'
            );
    }

    if (!panel) {
        return;
    }

    const checkbox =
        panel.querySelector(
            '#mg-hide-found'
        );

    if (checkbox) {
        checkbox.checked =
            getHideFound();
    }

    const stats =
        panel.querySelector(
            '#mg-stats'
        );

    if (stats) {
        stats.textContent =
            `Saved locations: ${getMapLocations().length} · Presets: ${getPresets().length}`;
    }
}

  // ============================================================
// PRESET UI
// ============================================================

function setupPresetDeleteHandler() {
    document.addEventListener(
        'click',
        event => {
            const target =
                event.target instanceof Element
                    ? event.target
                    : null;

            if (!target) {
                return;
            }

            const trash =
                target.closest(
                    '.ion-md-trash, [class*="trash"], [aria-label*="Delete"]'
                );

            if (!trash) {
                return;
            }

            const presetItem =
                trash.closest(
                    '.presets-item, [class*="preset"]'
                );

            if (!presetItem) {
                return;
            }

            // The API interception handles the deletion.
        },
        true
    );
}


// ============================================================
// WAIT FOR MAPGENIE UI
// ============================================================

function waitForUI() {
    let attempts = 0;

    const timer =
        setInterval(
            () => {
                attempts++;

                if (createUI()) {
                    clearInterval(
                        timer
                    );

                    return;
                }

                // Keep trying for roughly 30 seconds.
                if (attempts >= 60) {
                    clearInterval(
                        timer
                    );

                    console.warn(
                        PREFIX,
                        'Could not find #user-panel.'
                    );
                }
            },
            500
        );
}


// ============================================================
// STARTUP
// ============================================================

savePresets(
    getPresets()
);

console.log(
    PREFIX,
    'Loaded v5.0 for',
    getMapKey(),
    '| local locations:',
    getMapLocations().length,
    '| local presets:',
    getPresets().length,
    '| hide found:',
    getHideFound()
);

if (
    document.readyState ===
    'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        () => {
            setupPresetDeleteHandler();
            waitForUI();
            startMapWatcher();
        },
        { once: true }
    );
} else {
    setupPresetDeleteHandler();
    waitForUI();
    startMapWatcher();
}

})();

