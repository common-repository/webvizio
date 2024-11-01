if (window.self !== window.top || ~location.href.indexOf("wv_task=")) {
    var s = document.createElement("script");
    s.type = "text/javascript";
    s.src = "https://" + window.location.host + '/wp-content/plugins/webvizio/js/webvizio.min.js?ver=1.0.3'
    s.id = "webvizio_script";
    document.head.append(s);
}