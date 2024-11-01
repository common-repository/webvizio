if (document.readyState !== 'loading') {
    webvizioInit();
} else {
    document.addEventListener('DOMContentLoaded', function () {
        webvizioInit();
    });
}

function webvizioInit() {
    let webvizioExtractDomain = function(url) {
        if (!url || url === '') {
            return '';
        }
        var domain;

        if (url.indexOf("://") > -1) {
            domain = url.split('/')[2];
        } else {
            domain = url.split('/')[0];
        }

        domain = domain.split(':')[0];
        domain = domain.split('?')[0];

        return domain;
    }

    let isWebvizioInitAllowed = function() {
        if (window.location.ancestorOrigins !== undefined) {
            if (((window.self !== window.top &&
                    ~['webvizio.my', 'app.webvizio.com', 'test.webvizio.com', 'webvizio.loc'].indexOf(webvizioExtractDomain(window.location.ancestorOrigins[0]))) ||
                ~location.href.indexOf("wv_task=")) && (!document.body.classList.contains('webvizio'))) {
                return true;
            }
        } else {
            if (((window.self !== window.top) || ~location.href.indexOf("wv_task=")) && (!document.body.classList.contains('webvizio'))) {
                return true;
            }
        }
        return false;
    }

    if (isWebvizioInitAllowed()) {
        let webvizioSnapshot= require('rrweb-snapshot');
        var WebVizio = {
            tasks: [],
            currentTask: null,
            viewMode: 'start',
            host: null,
            url: null,
            taskSnapshot: null,
            rerenderTimeoutID: null,
            tasksPanelVisible: null,
            lastHoverElPath: null,
            sourceType: 'page',
            makeScreenshot: false,
            fileSize: [0, 0],
            scriptOrigin: '',
            role: 'assignee',
            notFoundMarkers: [],
            advancedSettings: [],
            snapshotMode: false,

            init: function () {

                if (typeof window.parent.postMessage !== "undefined") {
                    this.parentWindow = window.parent;
                } else {
                    if (typeof window.top.postMessage !== "undefined") {
                        this.parentWindow = window.top;
                    } else {
                        console.log('Webvizio is stopped - postMessage blocked');
                        return false;
                    }
                }

                addEventListener('click', this.clickEventListener.bind(this), true);
                addEventListener("mousedown", this.disableMouseClickEventsListener.bind(this), true);
                addEventListener("mouseup", this.disableMouseClickEventsListener.bind(this), true);
                addEventListener("message", this.messageEventListener.bind(this), false);
                addEventListener("mouseover", this.mouseoverEventListener.bind(this), false);
                addEventListener("mouseout", this.mouseoutEventListener.bind(this), false);
                addEventListener("mousemove", this.mousemoveEventListener.bind(this), false);
                addEventListener("keydown", this.keydownEventListener.bind(this), false);
                addEventListener("resize", this.resizeEventListener.bind(this), false);
                addEventListener("scroll", this.scrollEventListener.bind(this), false);
                addEventListener("load", this.loadEventListener.bind(this), false);


                addEventListener('WebVizioEvent', function (event) {
                    console.log('def', event.detail.prevEvent.defaultPrevented);
                }.bind(this));

                this.parentWindow.postMessage({message: 'Frame', method: 'setFrameHasScript'}, "*");
                document.body.classList.add("webvizio");

                webvizioExtractDomain(window.location.ancestorOrigins[0])
                this.scriptOrigin = 'https://app.webvizio.com';

                let initScript = function () {
                    if (!this.getParameterByName('wv_task')) {
                        this.getTasks();
                    }
                }.bind(this);

                this.addCss(this.scriptOrigin + '/css/webvizio.css', initScript);
                document.querySelector('html').classList.add('webvizio-full-access');

                (() => {
                    // console.log('history.pushState', history.pushState);
                    let oldPushState = history.pushState;

                    history.pushState = function pushState(e) {
                        // console.log('pushState', e);
                        window.dispatchEvent(new Event('locationchange'));
                        if (WebVizio.viewMode === 'browse') {
                            throw {error: 'pushState'};
                        } else {
                            let ret = oldPushState.apply(this, arguments);
                            window.dispatchEvent(new Event('pushstate'));
                            return ret;
                        }
                    };

                    let oldReplaceState = history.replaceState;
                    history.replaceState = function replaceState(e) {
                        // console.log('replaceState', e);
                        window.dispatchEvent(new Event('locationchange'));
                        if (WebVizio.viewMode === 'browse') {
                            throw {error: 'replaceState'};
                        } else {
                            let ret = oldReplaceState.apply(this, arguments);
                            window.dispatchEvent(new Event('replacestate'));
                            return ret;
                        }
                    };

                    window.addEventListener('popstate', () => {
                        window.dispatchEvent(new Event('locationchange'));
                    });
                })();

                window.addEventListener('locationchange', function (e) {
                    WebVizio.currentLocation = e.currentTarget.location;
                });
            },

            getLocationSearch(search) {
                if (!search) {
                    return search;
                }

                var hasV = false;
                if (search[0] === '?') {
                    hasV = true;
                    search = search.substring(1);
                }

                var searchArr = search.split('&');

                searchArr.forEach(function (item, index) {
                    var a = item.split('=');
                    if (a[0] === 'wv') {
                        searchArr.splice(index, 1);
                    }
                });

                search = searchArr.join('&');
                if (hasV) {
                    search = '?' + search;
                }

                return search;
            },

            getTaskForScreenshot(taskID) {
                const request = new XMLHttpRequest();

                var host = '';

                if (this.scriptOrigin) {
                    host = this.scriptOrigin;
                } else {
                    var urlArr = location.hostname.split('.');
                    if (!~location.href.indexOf('/open_visual?file=')) {
                        urlArr.shift();
                    }
                    host = location.protocol + "//" + urlArr.join('.');
                }

                var url = host + "/task/" + taskID + "/snapshot_url";

                request.open('GET', url);
                request.addEventListener("readystatechange", () => {
                    if (request.readyState === 4 && request.status === 200) {
                        let snapshotUrl = JSON.parse(request.responseText).result.url;
                        this.loadSnapshot(snapshotUrl);
                    }
                });
                request.send();
            },

            addCss: function (fileName, onload = false) {

                var head = document.head;
                var link = document.createElement("link");

                link.type = "text/css";
                link.rel = "stylesheet";
                link.href = fileName;

                if (onload) {
                    link.onload = onload;
                }

                head.appendChild(link);
            },

            addJs: function (fileName) {
                // console.log('addJs', fileName);
                var head = document.head;
                var script = document.createElement("script");

                script.type = "text/javascript";
                script.src = fileName;

                head.appendChild(script);
            },

            loadEventListener: function (event) {
                this.setFileSize();
                if (this.advancedSettings.includes('snapshot_styles')) {
                    setTimeout(function () {
                        let links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(link => {
                            return !link.href.startsWith(window.location.origin);
                        });
                        links.forEach(function (link) {
                            let newLink = link.cloneNode(true);
                            newLink.removeAttribute("onload");
                            newLink.removeAttribute("onerror");
                            newLink.setAttribute('crossorigin', 'anonymous');
                            link.parentNode.removeChild(link);
                            document.head.appendChild(newLink);
                        });
                    }.bind(WebVizio), 1000);
                }

                var taskID = this.getParameterByName('wv_task');
                if (taskID) {
                    this.getTaskForScreenshot(taskID);
                } else {
                    this.getTasks();
                }
            },

            setFileSize: function () {
                var file = document.getElementById('webvizio_file');
                if (file) {
                    var W = file.clientWidth;
                    var H = file.clientHeight;

                    this.fileSize = [W, H];
                    this.parentWindow.postMessage({
                        message: 'Frame',
                        method: 'setFileSize',
                        fileSize: this.fileSize
                    }, "*");

                    file.style.width = '100%';
                    file.style.height = 'auto';
                }
            },

            replaceRelativeLinks: function () {
                var anchors = document.getElementsByTagName("a");

                for (var i = 0; i < anchors.length; i++) {
                    if (window.WV_SCHEME && window.WV_HOST && anchors[i].href.indexOf(window.WV_SCHEME + '://') !== 0) {
                        anchors[i].href = window.WV_SCHEME + '://' + window.WV_HOST + (anchors[i].href[0] !== '/' ? '/' : '') + anchors[i].href
                    }
                }
            },

            resizeEventListener: function (event) {
                this.hideExternalDomainLinkTooltip();

                if (this.rerenderTimeoutID) {
                    clearTimeout(this.rerenderTimeoutID);
                }
                let timeout = 100;
                if (this.sourceType !== 'page') {
                    timeout = 50;
                }

                this.rerenderTimeoutID = setTimeout(function () {
                    this.clearMarkers(true);
                    this.renderMarkers();
                }.bind(WebVizio), timeout);
            },

            scrollEventListener: function (event) {
                if (this.rerenderTimeoutID) {
                    clearTimeout(this.rerenderTimeoutID);
                }
                this.rerenderTimeoutID = setTimeout(function () {
                    this.clearMarkers(true);
                    this.renderMarkers();
                }.bind(WebVizio), 500);
            },

            mousemoveEventListener: function (event) {
                if (this.rerenderTimeoutID) {
                    clearTimeout(this.rerenderTimeoutID);
                }
                this.rerenderTimeoutID = setTimeout(function () {
                    this.clearMarkers(true);
                    this.renderMarkers();
                    setTimeout(function () {
                        this.clearMarkers(true);
                        this.renderMarkers();
                    }.bind(WebVizio), 300);
                }.bind(WebVizio), 200);
            },

            disableMouseClickEventsListener: function (event) {
                if (this.viewMode === 'comment') {
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    event.preventDefault();
                }
            },

            keydownEventListener: function (event) {
                if (event.key === "Escape") {
                    if (this.viewMode === 'editor') {
                        this.setMode({mode: 'comment'})
                    }
                }
            },

            clickEventListener: function (event) {

                if (!event.isTrusted) {
                    return false;
                }

                this.parentWindow.postMessage({message: 'Frame', method: 'frameClick'}, "*");

                if (!this.viewMode) {
                    this.parentWindow.postMessage({message: 'Frame', method: 'getMode'}, "*");
                }

                if (this.viewMode === 'comment') {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    if (~event.target.classList.value.indexOf('webvizio_marker') || ~event.target.classList.value.indexOf('webvizio_marker_num')) {
                        var el = event.target;
                        if (~event.target.classList.value.indexOf('webvizio_marker_num')) {
                            el = event.target.parentNode;
                        }

                        let newCurrentTask = this.tasks.find(function (item) {
                            return item.num === parseInt(el.getAttribute('webvizio-marker-id'));
                        });
                        this.changeBorderColor(newCurrentTask);
                        this.currentTask = newCurrentTask;

                        this.parentWindow.postMessage({
                            message: 'Frame',
                            method: 'setCurrentTask',
                            currentTask: this.currentTask
                        }, "*");

                        setTimeout(function () {
                            this.scrollToMarker(newCurrentTask);
                        }.bind(this));

                        return true;
                    }
                    if (this.role === 'guest' || this.role === 'viewer') {
                        return false;
                    }

                    this.setViewMode('editor');

                    try {
                        this.parentWindow.postMessage({
                            message: 'Frame',
                            method: 'showEditor',
                            task: this.setTask(event)
                        }, "*");
                        var newTask = this.setTask(event);
                    } catch (e) {
                        this.setViewMode('comment');
                        this.clearMarkers(true);
                        this.renderMarkers();
                    }
                    let snapshotParameters = {'inlineStylesheet': true}
                    if (this.advancedSettings.includes('snapshot_images')) {
                        snapshotParameters.inlineImages = true;
                    }
                    this.taskSnapshot = webvizioSnapshot.snapshot(document, snapshotParameters);
                    this.parentWindow.postMessage({
                        message: 'Frame',
                        method: 'createNewTask',
                        task: newTask,
                        snapshot: this.taskSnapshot
                    }, "*");
                    this.tasks.push(newTask);
                    this.taskSnapshot = null;

                    return false;
                }

                if (this.viewMode === 'browse') {
                    if (!~event.target.classList.value.indexOf('webvizio_edl')) {
                        this.hideExternalDomainLinkTooltip();
                    }

                    // console.log('event.target', event);
                    var BreakException = {type: 'BreakException'};
                    var SkipException = {type: 'SkipException'};


                    try {
                        var path = event.path || (event.composedPath && event.composedPath());

                        path.forEach(function (item) {
                            if (item.tagName && item.tagName.toLowerCase() === 'a' && item.href) {
                                // event.preventDefault();

                                const WebVizioEvent = new CustomEvent('WebVizioEvent', {
                                    bubbles: true,
                                    cancelable: true,
                                    detail: {
                                        prevEvent: event
                                    }
                                });

                                window.dispatchEvent(WebVizioEvent);

                                var url = new URL(item.href);

                                url.searchParams.delete('wv_v');

                                if (url.host.toLowerCase() === location.host) {
                                    url.host = this.host.toLowerCase();
                                }

                                //console.log('browse a', url, this.host, item.getAttribute('href'));

                                if (item.getAttribute('href') === '#') { // ||
                                    throw SkipException;
                                }

                                if (this.isAnchorLink(item.getAttribute('href'))) {
                                    if (!this.advancedSettings.includes('hash_routing')) {
                                        throw SkipException;
                                    }
                                }

                                if (~item.getAttribute('href').indexOf('tel:') || ~item.getAttribute('href').indexOf('mailto:')) {
                                    throw BreakException;
                                }

                                if (~item.getAttribute('href').indexOf('javascript:')) {
                                    return;
                                }

                                if (url.host.toLowerCase() !== this.host.toLowerCase() &&
                                    url.host.toLowerCase() !== 'www.' + this.host.toLowerCase() &&
                                    'www.' + url.host.toLowerCase() !== this.host.toLowerCase() &&
                                    (!this.advancedSettings.includes('hash_routing') || item.getAttribute('href').substring(0, 1) != '#')
                                ) {
                                    this.showExternalDomainLinkTooltip(event, item);
                                    throw BreakException;
                                }

                                if ((!~url.pathname.toLowerCase().indexOf('javascript:')) && (
                                    (url.pathname.toLowerCase() !== location.pathname.toLowerCase() || url.search.toLowerCase() !== location.search.toLowerCase() || (this.advancedSettings.includes('hash_routing') && url.hash.toLowerCase() !== location.hash.toLowerCase())) && (
                                        url.host.toLowerCase() === this.host.toLowerCase() ||
                                        url.host.toLowerCase() === 'www.' + this.host.toLowerCase() ||
                                        'www.' + url.host.toLowerCase() === this.host.toLowerCase() ||
                                        url.host.toLowerCase() === location.host
                                    ))) {

                                    setTimeout(function () {
                                        // console.log('defaultPrevented 2', event.defaultPrevented, event, {item: item, a: item.classList});
                                        // console.log('!event.defaultPrevented', !event.defaultPrevented);
                                        // console.log('~item.classList.contains(\'wv-virtual-link\')', item.classList.contains('wv-virtual-link'));
                                        if (!event.defaultPrevented || (event.defaultPrevented && !~url.href.indexOf('#')) || item.classList.contains('wv-virtual-link')) {
                                            this.addNewSource(url.href);
                                        }
                                        throw BreakException;
                                    }.bind(this));

                                    // console.log('createSource');
                                    // event.preventDefault();
                                }
                            }
                        }.bind(this));
                    } catch (e) {
                        console.log('catchException', e);
                        if (e.type && e.type === 'BreakException') {
                            event.preventDefault();
                            event.stopPropagation();
                            event.stopImmediatePropagation();
                        } else if (e.type && e.type === 'SkipException') {
                            // event.preventDefault();
                        } else {
                            event.preventDefault();
                            return false;
                        }
                    }
                }
            },

            isAnchorLink(href) {
                var url = new URL(href, 'https://' + this.host);
                var currentUrl = new URL(this.url);
                return url.host === currentUrl.host && url.pathname === currentUrl.pathname && url.search === currentUrl.search;
            },

            addNewSource(url) {
                console.log('addNewSource', url);
                this.parentWindow.postMessage({
                    message: 'Frame',
                    method: 'createSource',
                    url: url
                }, "*");
            },

            setCurrentTask: function (data) {
                if (!data.currentTask) {
                    this.changeBorderColor(data.currentTask);
                    this.currentTask = null;
                    document.documentElement.classList.remove('has_active_webvizio_marker');
                } else {
                    this.changeBorderColor(data.currentTask);
                    this.scrollToMarker(data.currentTask);
                    this.currentTask = data.currentTask;
                    if (!~this.tasks.findIndex(function (item) {
                        return this.currentTask && item.id === this.currentTask.id;
                    }.bind(WebVizio))) {
                        this.tasks.push(this.currentTask);
                    }
                    document.documentElement.classList.add('has_active_webvizio_marker');
                }

                this.clearMarkers(true);
                this.renderMarkers();

            },

            cancelCreateTask: function (data) {
                this.setViewMode('comment');
                var removeIndex = this.tasks.findIndex(function (item) {
                    return item.num === null;
                }.bind(WebVizio));

                if (~removeIndex) {
                    this.tasks.splice(removeIndex, 1);
                }
                if (document.querySelector('div.marker_new')) {
                    document.querySelector('div.marker_new').remove();
                }
            },

            taskCreated: function (data) {
                this.setViewMode('comment');
            },

            destroyTask: function (data) {
                this.tasks.splice(this.tasks.findIndex(item => item.id === data.task.id), 1);
                document.querySelector('div.marker_' + data.task.num).remove();
                if (data.task.id === this.currentTask.id) {
                    this.currentTask = null;
                }
            },

            getTasks: function (data) {
                this.parentWindow.postMessage({message: 'Frame', method: 'getTasks', duration: 500}, "*");
            },

            setMarkers: function (data) {
                // console.log('setMarkers', data);
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        this.host = data.host || null;
                        this.url = data.url || null;
                        this.tasks = data.tasks;
                        this.setViewMode(data.mode);
                        this.sourceType = data.sourceType;
                        this.currentTask = data.currentTask;
                        this.clearMarkers();

                        if (this.tasks.length && this.viewMode !== 'browse') {
                            this.renderMarkers();
                        }
                        if (this.currentTask) {
                            this.sendCurrentMarkerPosition();
                        }
                        this.parentWindow.postMessage({message: 'Frame', method: 'markersSettable'}, "*");
                        resolve();
                    }.bind(WebVizio), 500);
                });
            },

            sendCurrentMarkerPosition() {
                let element = document.querySelector('.webvizio_marker_active');
                if (!element) {
                    return false;
                }
                let rect = element.getBoundingClientRect();
                let viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                let position = 'left'
                if (rect.left < viewportWidth / 2) {
                    position = 'left';
                } else if (rect.right > viewportWidth / 2) {
                    position = 'right';
                }
                this.parentWindow.postMessage({
                    message: 'Frame',
                    method: 'currentTaskPosition',
                    position: position
                }, "*");
            },

            getParameterByName(name, url = window.location.href) {
                name = name.replace(/[\[\]]/g, '\\$&');
                var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
                    results = regex.exec(url);
                if (!results) return null;
                if (!results[2]) return '';
                return decodeURIComponent(results[2].replace(/\+/g, ' '));
            },

            setTasksPanelVisible: function (data) {
                this.tasksPanelVisible = data.tasksPanelVisible;
            },

            renderMarkers: function () {
                // console.log('renderMarkers');
                if (this.viewMode != 'comment' && !this.currentTask) {
                    return;
                }
                if (!this.snapshotMode) {
                    this.tasks.forEach(function (task) {
                        this.renderMarker(task);
                    }.bind(WebVizio));
                } else {
                    this.currentTask.num = null;
                    this.renderMarker(this.currentTask);
                }
            },

            setMode: function (data) {
                // console.log('setMode', data);
                this.setViewMode(data.mode);

                if (data.mode === 'browse') {
                    this.clearMarkers(true);
                } else if (data.mode === 'comment') {
                    this.renderMarkers();
                }
            },

            setRole: function (data) {
                this.role = data.role;
                document.querySelector('html').classList.add('webvizio-role-' + data.role);
                document.querySelector('html').classList.remove('webvizio-full-access');
                if (this.role !== 'guest' && this.role !== 'viewer') {
                    document.querySelector('html').classList.add('webvizio-full-access');
                }
            },
            setAdvancedSettings: function (data) {
                this.advancedSettings = data.settings;
            },

            setViewMode: function (mode) {
                // console.log('setViewMode', mode);

                if (this.viewMode === mode) {
                    return;
                }
                if (mode === 'browse') {
                    document.querySelector('html').classList.remove('wv-task-mode');
                } else if (mode === 'comment') {
                    document.querySelector('html').classList.add('wv-task-mode');
                }

                this.viewMode = mode;
            },

            clearMarkers: function (clearAll = false) {
                // console.log('clearMarkers');
                var markers = document.querySelectorAll('.webvizio_marker');


                if (markers.length) {
                    markers.forEach(function (item) {
                        if (clearAll || !this.tasks.find(function (task) {
                            return task.num == item.getAttribute('webvizio-marker-id');
                        })) {
                            if (!item.classList.contains('marker_new')) {
                                item.remove();
                            }
                        }
                    }.bind(WebVizio))
                }
            },


            messageEventListener: function (event) {
                if (typeof event.data !== 'object') {
                    return;
                }

                if (event.data.method && typeof this[event.data.method] === 'function') {
                    this[event.data.method](event.data);
                }
            },

            changeBorderColor: function (newCurrentTask) {
                if (this.currentTask && document.querySelector('div.marker_' + this.currentTask.num)) {
                    document.querySelector('div.marker_' + this.currentTask.num).classList.remove("webvizio_marker_active");
                }
                if (newCurrentTask && document.querySelector('div.marker_' + newCurrentTask.num)) {
                    document.querySelector('div.marker_' + newCurrentTask.num).classList.add("webvizio_marker_active");
                }
            },

            scrollToMarker: function (task) {

                if (!task.hasOwnProperty('num') || task.num == null) {
                    task.num = 'new';
                }

                var element = document.querySelector('div.marker_' + task.num);
                var top = 0;
                if (element) {
                    top = parseInt(this.findPos(element)) - (window.innerHeight / 2);
                    // console.log('scrollToMarker top 1', this.findPos(element));
                } else if (task.browser_context.scroll && task.browser_context.scroll.y) {
                    top = parseInt(task.browser_context.scroll.y);
                    // console.warn('scrollToMarker top 2', top);
                } else {
                    console.warn('Cannot find element with num \'' + task.num + '\'.');
                    return;
                }

                if (Number.isInteger(Math.round(top))) {
                    window.scroll({
                        top: top,
                        behavior: 'smooth'
                    });
                }
            },

            findPos: function (obj) {
                var curtop = 0;
                if (obj.offsetParent) {
                    do {
                        curtop += obj.offsetTop;
                    } while (obj = obj.offsetParent);
                    return curtop;
                }
            },

            getCssProperty: function (element, property) {
                var cStyle = element.currentStyle || window.getComputedStyle(element, "");
                return cStyle[property];
            },

            getValidEl: function (event) {
                var el = event.target;

                while ((!el.offsetWidth || !el.offsetHeight) && el.nodeName.toLowerCase() !== 'body') {
                    el = el.parentNode;
                }

                if (!el) {
                    el = document.querySelector('body');
                }

                var elRect = el.getBoundingClientRect();
                var parentBox = el;

                while (el && el.nodeName.toLowerCase() !== 'body') {
                    if (el.parentNode && typeof el.parentNode.getBoundingClientRect === 'function') {
                        var elParentRect = el.parentNode.getBoundingClientRect();

                        if ((
                                elParentRect.width < elRect.width ||
                                elParentRect.height < elRect.height ||
                                (elParentRect.width === elRect.width && elParentRect.height === elRect.height)
                            ) &&
                            event.pageX > elRect.left && event.pageX < elRect.left + elRect.width &&
                            event.pageY > elRect.top && event.pageY < elRect.top + elRect.height &&
                            event.pageX > elParentRect.left && event.pageX < elParentRect.left + elParentRect.width &&
                            event.pageY > elParentRect.top && event.pageY < elParentRect.top + elParentRect.height
                        ) {
                            parentBox = el.parentNode;
                            elRect = parentBox.getBoundingClientRect();
                        }

                    }

                    el = el.parentNode;
                }

                return parentBox;
            },

            getNonStaticParent: function (el) {
                let elPosition = el.style.position ? el.style.position : this.getCssProperty(el, 'position');

                while (elPosition === 'static' && this.getCssProperty(el, 'transition') === 'none') {
                    el = el.parentNode;
                    elPosition = el.style.position ? el.style.position : this.getCssProperty(el, 'position');
                }

                return el;
            },

            mouseoverEventListener: function (event) {
                // console.log(event);
                if (event.target.classList && (event.target.classList.contains('webvizio_marker') || event.target.classList.contains('webvizio_marker_num'))) {
                    return;
                }

                var el = this.getValidEl(event);
                var elPath = this.domElementPath(el);

                if (this.sourceType !== 'page' || this.viewMode !== 'comment' || (this.lastHoverElPath && this.lastHoverElPath === elPath)) {
                    return;
                }
                this.lastHoverElPath = elPath;
                this.renderFrame(document.querySelector(this.domElementPath(el)));
            },

            mouseoutEventListener: function (event) {
                //console.log('mouseoutEventListener');
                document.querySelectorAll('.webvizio_frame').forEach(function (item) {
                    item.remove();
                });
            },

            setTask: function (event, dataOnly = false) {
                var el = this.getValidEl(event);
                var elRect = el.getBoundingClientRect();

                var offsetX = event.clientX - elRect.left;
                var offsetY = event.clientY - elRect.top;

                var offsetXPercent = offsetX / elRect.width,
                    offsetYPercent = offsetY / elRect.height;

                var task = {
                    element_path: this.domElementPath(el),
                    offset_x: offsetXPercent,
                    offset_y: offsetYPercent,
                    pin_x: event.clientX,
                    pin_y: event.clientY,
                    scroll_x: window.scrollX,
                    scroll_y: window.scrollY,
                    elements: this.getElementParentPositions(event, el),
                    num: null,
                };

                this.renderMarker(task);
                return task;
            },

            getElementParentPositions(event, el) {
                // console.log('path', this.parentElements(el), this.domElementPath(el));
                var stop = false;
                var result = [];
                this.parentElements(el).reverse().forEach(function (item, i) {
                    var elPath = this.domElementPath(item.element);
                    if (!stop) {
                        //console.log('elPath', elPath);
                        var elRect = item.element.getBoundingClientRect();

                        var offsetX = event.clientX - elRect.left;
                        var offsetY = event.clientY - elRect.top;

                        var offsetXPercent = offsetX / elRect.width,
                            offsetYPercent = offsetY / elRect.height;

                        result.push({
                            element_path: this.domElementPath(item.element),
                            offset_x: offsetXPercent,
                            offset_y: offsetYPercent,
                        });
                    }
                    if (elPath.indexOf('body') === 0) {
                        stop = true;
                    }
                }.bind(this))
                // console.log('getElementParentPositions result', result);
                return result;
            },

            getParentBox: function (el) {
                let parentBox = el.offsetParent;

                if (!parentBox) {
                    return document.body;
                }

                while (parentBox.nodeName.toLowerCase() !== 'body' &&
                this.getCssProperty(parentBox, 'position') === 'static' &&
                this.getCssProperty(parentBox, 'transform') === 'none') {
                    parentBox = parentBox.offsetParent;
                }

                if (this.getCssProperty(parentBox, 'position') === 'static'  &&
                    this.getCssProperty(parentBox, 'transform') === 'none') {
                    parentBox = document.querySelector("body");
                }

                return parentBox;
            },

            copyToClipboard(text) {
                var inputc = document.body.appendChild(document.createElement("input"));
                inputc.value = text;
                inputc.focus();
                inputc.select();
                document.execCommand('copy');
                inputc.parentNode.removeChild(inputc);
                this.parentWindow.postMessage({message: 'Frame', method: 'externalDomainLinkCopied'}, "*");
                this.hideExternalDomainLinkTooltip();
            },

            hideExternalDomainLinkTooltip() {
                document.querySelectorAll("div.webvizio_edl_tooltip").forEach(function (item) {
                    item.remove();
                });
            },

            showExternalDomainLinkTooltip(event, el) {
                this.hideExternalDomainLinkTooltip();

                // console.log('showExternalDomainLinkTooltip event', event);

                var arrow = document.createElement("div");
                arrow.classList.add("webvizio_edl");
                arrow.classList.add("webvizio_edl_arrow");

                var text = document.createElement("div");
                text.classList.add("webvizio_edl");
                text.classList.add("webvizio_edl_text");
                text.innerHTML = 'External domain link';

                var svgBox = document.createElement("div");
                svgBox.classList.add("webvizio_edl");
                svgBox.classList.add("webvizio_edl_svgbox");
                svgBox.title = "Copy link";
                svgBox.innerHTML = '<svg width="24" height="25" viewBox="0 0 24 25" xmlns="http://www.w3.org/2000/svg">\n' +
                    '<path d="M16.0906 2.70312H5.18146C4.18146 2.70312 3.36328 3.52131 3.36328 4.52131V17.2486H5.18146V4.52131H16.0906V2.70312ZM18.8178 6.33949H8.81783C7.81783 6.33949 6.99964 7.15767 6.99964 8.15767V20.8849C6.99964 21.8849 7.81783 22.7031 8.81783 22.7031H18.8178C19.8178 22.7031 20.636 21.8849 20.636 20.8849V8.15767C20.636 7.15767 19.8178 6.33949 18.8178 6.33949ZM18.8178 20.8849H8.81783V8.15767H18.8178V20.8849Z"/>\n' +
                    '</svg>';

                svgBox.onclick = function () {
                    this.copyToClipboard(el.href);
                }.bind(WebVizio);

                var tooltip = document.createElement("div");
                tooltip.classList.add("webvizio_edl");
                tooltip.classList.add("webvizio_edl_tooltip");


                var elRect = el.getBoundingClientRect();
                var offsetX, offsetY, offsetArrowX = 0;

                offsetX = (event.pageX - 104);
                offsetY = (elRect.y + window.scrollY - 50);

                // console.log('elRect', elRect.y, window.scrollY);


                if (offsetX + 208 > window.innerWidth) {
                    offsetArrowX = offsetX - (window.innerWidth - 212) - 2;
                    offsetX = window.innerWidth - 212;
                } else if (offsetX < 4) {
                    offsetArrowX = offsetX - 6;
                    offsetX = 4;
                }

                // console.log('offsetY', offsetY, window.innerHeight, elRect);

                if (offsetArrowX !== 0) {
                    arrow.setAttribute("style",
                        "left: calc(50% " + (offsetArrowX > 0 ? " + " : " + ") + offsetArrowX + 'px' + ");");
                }

                if (elRect.y < 54) {
                    offsetY = (elRect.y + window.scrollY + elRect.height + 6);
                    arrow.setAttribute("style",
                        "top: -5px;transform: rotate(180deg);");
                }
                // console.log('offsetArrowX', offsetArrowX);

                tooltip.setAttribute("style",
                    "left: " + offsetX + 'px' + ";" +
                    "top: " + offsetY + 'px' + ";");


                tooltip.appendChild(arrow);
                tooltip.appendChild(text);
                tooltip.appendChild(svgBox);

                document.body.appendChild(tooltip);
            },


            renderMarker: function (task, index = 0) {
                var hasElements = function () {
                    return task.container_context && task.container_context.elements && Array.isArray(task.container_context.elements) && task.container_context.elements.length;
                }

                var elementPath = index && hasElements() ? task.container_context.elements[index].element_path : task.element_path;
                var el = document.querySelector(elementPath);

                var notFoundMarker = this.notFoundMarkers.findIndex(function (item) {
                    return item.id === task.id;
                });

                if (!el || !this.checkVisibility(el)) {
                    if (!~notFoundMarker) {
                        this.notFoundMarkers.push(task);
                    }

                    if (hasElements()) {
                        this.renderMarker(task, ++index);
                    }
                    return;
                } else if (~notFoundMarker) {
                    this.notFoundMarkers.splice(notFoundMarker, 1);
                }


                /*console.log('renderMarker', this.currentTask, task);
                console.log('webvizio_markers', document.querySelectorAll('div.webvizio_marker'));*/

                var isActive = this.currentTask && task.id === this.currentTask.id;

                let parentBox = this.getParentBox(el); //el.offsetParent;

                /*console.log('el=parentBox', el==parentBox);
                console.log('el', el);
                console.log('parentBox', parentBox.tagName);*/

                var elRect = el.getBoundingClientRect();
                var parentRect = parentBox.getBoundingClientRect();
                var offsetX, offsetY;

                var taskOffsetX = index && hasElements() ? task.container_context.elements[index].offset_x : task.offset_x;
                var taskOffsetY = index && hasElements() ? task.container_context.elements[index].offset_y : task.offset_y;

                if (this.sourceType === 'file' || this.sourceType === 'figma') {
                    offsetX = (taskOffsetX * 100) + '%';
                    offsetY = (taskOffsetY * 100) + '%';
                } else {
                    offsetX = (elRect.left - parentRect.left + (taskOffsetX * elRect.width)) + 'px';

                    var parentTop = parentRect.top;
                    if (parentBox.nodeName.toUpperCase() === 'BODY') {
                        parentTop = document.querySelector('html').getBoundingClientRect().top;
                    }

                    offsetY = (elRect.top - parentTop + (taskOffsetY * elRect.height)) + parentBox.scrollTop + 'px';
                }

                /*console.log('elRect', elRect);
                console.log('parentRect', parentRect);
                console.log('task', task);
                console.log('offsetY', offsetY);*/

                var marker;

                if (task.num && document.querySelector('div.marker_' + task.num)) {
                    marker = document.querySelector('div.marker_' + task.num);
                    marker.style.left = offsetX;
                    marker.style.top = offsetY;
                    if (isActive) {
                        marker.classList.add("webvizio_marker_active");
                    }
                } else {
                    document.querySelectorAll('div.marker_new').forEach(function (item) {
                        item.remove();
                    });
                    marker = document.createElement("div");
                    var num = document.createElement("span");
                    num.innerHTML = task.num !== null && task.num !== 'new' ? task.num : '';
                    num.classList.add("webvizio_marker_num");

                    if (task.num > 999) {
                        num.classList.add("webvizio_marker_1000");
                    }

                    marker.classList.add("marker_" + (task.num !== null ? task.num : 'new'));
                    marker.classList.add("webvizio_marker");
                    marker.classList.add("userflow-webvizio_marker");
                    // marker.setAttribute('selector', elementPath);
                    if (isActive) {
                        marker.classList.add("webvizio_marker_active");
                    }
                    if (index > 0) {
                        marker.classList.add("webvizio_marker_gray");
                    }
                    marker.setAttribute("webvizio-marker-id", (task.num !== null ? task.num : 'new'));

                    marker.setAttribute("style",
                        "left: " + offsetX + ";" +
                        "top: " + offsetY + ";");

                    marker.appendChild(num);
                    if (el.nodeName.toLowerCase() !== 'body') {
                        if (~['TD', 'TH'].indexOf(el.nodeName)) {
                            return el.appendChild(marker);
                        } else {
                            el.parentNode.appendChild(marker);
                        }
                    } else {
                        el.appendChild(marker);
                    }
                }
            },

            checkVisibility: function (element) {
                if (typeof element.checkVisibility === "function") {
                    return element.checkVisibility({
                        opacityProperty: true,
                        visibilityProperty: true,
                        contentVisibilityAuto: true
                    });
                } else {
                    return this.customCheckVisibility(element);
                }
            },

            customCheckVisibility: function (element) {
                if (element === null || !(element instanceof Element)) {
                    return true;
                }

                let style = window.getComputedStyle(element);

                if (style.display === 'none' || style.visibility === 'hidden') {
                    return false;
                }
                return this.customCheckVisibility(element.parentNode);
            },

            updateTaskMarker: function (data) {
                this.clearMarkers();
                this.renderMarkers();
                this.renderMarker(data.task);
                this.scrollToMarker(data.task);
            },

            showTaskSnapshot: function (data) {
                this.loadSnapshot(data.snapshotUrl);
            },

            loadSnapshot(url) {
                fetch(url).then(res => res.json()).then(snapshot => {
                    webvizioSnapshot.rebuild(snapshot, {doc: document, hackCss: true});
                    document.querySelectorAll('[x-show],[v-if],[v-else],[v-show],[x-if]').forEach((element) => {
                        element.removeAttribute('x-show');
                        element.removeAttribute('x-if');
                        element.removeAttribute('v-if');
                        element.removeAttribute('v-else');
                        element.removeAttribute('v-show');
                    });
                    document.querySelector('html').classList.remove('wv-task-mode');
                    let element = document.querySelector('.marker_new.webvizio_marker');
                    while (element) {
                        element.classList.add(':hover');
                        element = element.parentElement;
                    }
                    this.scrollToElement(document.querySelector('.marker_new.webvizio_marker'));

                    let anchors = document.getElementsByTagName("a");
                    for (var i = 0; i < anchors.length; i++) {
                        anchors[i].onclick = function () {
                            return false;
                        };
                    }

                    let markers = document.querySelectorAll('.webvizio_marker');

                    markers.forEach((element) => {
                        if (!element.classList.contains('marker_new')) {
                            element.parentNode.removeChild(element);
                        }
                    });


                    setTimeout(function () {
                        document.querySelector('.marker_new').scrollIntoView({block: 'center'});
                    }, 500);

                    let snapshotPopup = document.createElement("div");
                    let snapshotPopupTimeout = null;
                    snapshotPopup.classList.add('webvizio-snapshot-popup');
                    snapshotPopup.innerHTML = "You cannot interact with this page in snapshot mode. Please switch to task or browse mode to continue working with tasks.";
                    document.body.appendChild(snapshotPopup);
                    window.addEventListener('click', function (e) {
                        let popup = document.querySelector('.webvizio-snapshot-popup');
                        popup.style.left = e.pageX + 'px';
                        popup.style.top = (e.pageY + 20) + 'px';
                        popup.style.display = 'block';
                        if (snapshotPopupTimeout) {
                            clearTimeout(snapshotPopupTimeout);
                        }
                        snapshotPopupTimeout = setTimeout(function () {
                            popup.style.display = 'none';
                        }, 2000);
                    });

                    this.snapshotMode = true;
                    if (this.sourceType !== 'page') {
                        setTimeout(function () {
                            addEventListener("resize", this.resizeEventListener.bind(this), false);
                            addEventListener("scroll", this.scrollEventListener.bind(this), false);
                        }.bind(WebVizio), 2000);
                    }
                    this.parentWindow.postMessage({message: 'Frame', method: 'frameSnapshotLoaded'}, "*");
                })
                    .catch(err => {
                        console.log(err);
                        this.parentWindow.postMessage({message: 'Frame', method: 'frameSnapshotLoaded'}, "*");
                    });
            },

            scrollToElement(element) {
                element.scrollIntoView(true);
                let viewportH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                window.scrollBy(0, (element.getBoundingClientRect().height - viewportH) / 2);
            },

            /*
             Clear cached files
             */
            clearCache: async function (data) {
                let resources = performance.getEntriesByType('resource');
                let allowedTypes = ['script', 'img', 'css', 'link', 'stylesheet', 'svg', 'media'];
                let urls = [];
                for (let i = 0; i < resources.length; i++) {
                    if (allowedTypes.includes(resources[i].initiatorType)) {
                        urls.push(resources[i].name);
                    }
                }
                try {
                    let requests = urls.map((url) => fetch(url,
                        {cache: 'reload', credentials: 'include', mode: 'no-cors'}));
                    await Promise.all(requests);
                } catch (error) {
                    console.warn(error);
                }
                this.parentWindow.postMessage({message: 'Frame', method: 'frameCacheCleared'}, "*");
            },

            isElementInViewport(el) {

                // Special bonus for those using jQuery
                if (typeof jQuery === "function" && el instanceof jQuery) {
                    el = el[0];
                }

                var rect = el.getBoundingClientRect();

                return (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
                );
            },

            renderFrame(el) {
                if (!el) {
                    return;
                }

                var elRect = el.getBoundingClientRect();

                /*console.log('el', el);
                console.log('elRect', elRect);*/

                var frame = document.createElement("div");
                frame.classList.add("webvizio_frame");

                frame.setAttribute("style",
                    "left: " + (elRect.x + this.getScrollX()) + "px;" +
                    "top: " + (elRect.y + this.getScrollY()) + "px;" +
                    "width: " + (elRect.width - 2) + "px;" +
                    "height: " + (elRect.height - 2) + "px;"
                );

                document.body.appendChild(frame);
            },

            getScrollX: function () {
                let bodyScroll = (document.body || document.documentElement || document.body.parentNode).scrollLeft;
                if (typeof bodyScroll !== 'undefined' && bodyScroll > 0) {
                    return bodyScroll + window.scrollX;
                }
                return window.scrollX;
            },

            getScrollY: function () {
                let bodyScroll = (document.body || document.documentElement || document.body.parentNode).scrollTop;
                if (typeof bodyScroll !== 'undefined' && bodyScroll > 0) {
                    return bodyScroll + window.scrollY;
                }
                return window.scrollY;
            },

            parentElements: function (element) {
                const parents = [];
                while (element) {
                    const tagName = element.nodeName.toLowerCase();
                    const cssId = element.id ? `#${this.selectorIdentifierSymbolFix(element.id)}` : '';
                    let cssClass = '';

                    if (element.className && typeof element.className === 'string') {
                        let className = element.className;
                        let classArr = className.split(' ');
                        let classOne = null;
                        let i = 0;
                        while ((!classOne || ~classOne.indexOf('.')) && i < classArr.length) {
                            classOne = this.selectorIdentifierSymbolFix(classArr[i]);
                            i++;
                        }

                        // escape class names
                        cssClass = `.${classOne.trim().replace(/\s+/g, '.').replace(/[:*+?^${}()|[\]\\]/gi, '\\$&')}`;
                    }

                    parents.unshift({
                        element,
                        selector: tagName + cssId + cssClass,
                    });

                    element = element.parentNode !== document ? element.parentNode : false;
                }

                return parents;
            },

            selectorIdentifierSymbolFix(selector) {
                if (typeof selector === 'string' || selector instanceof String) {
                    selector = selector.replaceAll('.', "\\.");
                    return selector.replaceAll('#', "\\#");
                } else {
                    return selector;
                }
            },

            nthElement: function (element) {
                let c = element;
                let nth = 1;
                while (c.previousElementSibling !== null) {
                    if (c.previousElementSibling.nodeName === element.nodeName) {
                        nth++;
                    }
                    c = c.previousElementSibling;
                }

                return nth;
            },

            normalizeSelector(selector) {

                selector = selector.replaceAll('\\#', "webvizio_selector_hash");
                selector = selector.replaceAll('\\.', "webvizio_selector_dot");

                var selectorClassOrigin = selector
                    .replaceAll('/', '\\/')
                    .replaceAll(' ', '\\ ')
                    .replaceAll('=', '\\=')
                    .replaceAll('@', '\\@')
                    .split('.');
                var selectorArr = [];

                selectorClassOrigin.forEach(function (item) {
                    var selectorIDOrigin = item.split('#');
                    var selectorIDArr = [];

                    selectorIDOrigin.forEach(function (item2) {
                        if (item2.match(/^[a-zA-Z]/)) {
                            selectorIDArr.push(item2);
                        }
                    });

                    if (selectorIDArr.length) {
                        selectorArr.push(selectorIDArr.join('#'));
                    }
                });


                selector = selectorArr.join('.');
                selector = selector.replaceAll('webvizio_selector_hash', '\\#');
                selector = selector.replaceAll('webvizio_selector_dot', '\\.');

                return selector;
            },

            nthSelectorNeeded: function (selector, path) {
                selector = this.normalizeSelector(selector);
                let querySelector = path === '' ? selector : `${path} > ${selector}`;
                return querySelector != 'html' ? document.querySelectorAll(querySelector).length > 1 : false;
            },

            buildPathString: function (parents) {
                const pathArr = [];

                parents.forEach((parent) => {
                    if (!parent.selector || this.nthSelectorNeeded(parent.selector, pathArr.join(' > '))) {
                        parent.selector += `:nth-of-type(${this.nthElement(parent.element)})`;
                    }

                    pathArr.push(this.normalizeSelector(parent.selector));
                });


                return pathArr;
            },

            domElementPath: function (element) {
                if (element.tagName === undefined) {
                    throw new Error('element must be of type `HTMLElement`.');
                }

                var fullPathArr = this.buildPathString(this.parentElements(element));
                var optimalPathArr = [];
                var i = fullPathArr.length - 2;
                optimalPathArr.push(fullPathArr[fullPathArr.length - 1]);
                while (i >= 0 && document.querySelectorAll(optimalPathArr.join(' > ')).length > 1) {
                    optimalPathArr.unshift(fullPathArr[i]);
                    i--;
                }

                return optimalPathArr.join(' > ');
            },
        };

        addEventListener("load", WebVizio.init(), false);

        document.addEventListener('mousemove', (event) => {
            window.top.postMessage({
                    eventName: 'berrycast:external-iframe-mouse-move',
                    data: {
                        clientX: event.clientX,
                        clientY: event.clientY + 80,
                    },
                }, '*',
            );
        });
    }
}
