document.addEventListener("DOMContentLoaded", function() {
    let connectButton = document.getElementById('w-connect');
    let disconnectButton = document.getElementById('w-disconnect');
    let changeAccountButton = document.getElementById('w-change-account');
    let setUserButtons = document.querySelectorAll('.w-set-user');
    let removeUserButtons = document.querySelectorAll('.w-remove-user');
    let nonce = document.getElementById('w-nonce').value;

    if (connectButton) {
        connectButton.addEventListener('click', function() {
            let data = {
                action: 'webvizio_connect',
                security: nonce
            };
            jQuery.post(ajaxurl, data, function(response) {
                if (response.success) {
                    location.href = response.data.connect_url;
                } else {
                    console.log(response);
                }
            });
        });
    }

    if (disconnectButton) {
        disconnectButton.addEventListener('click', function() {
            let data = {
                action: 'webvizio_disconnect',
                security: nonce
            };
            jQuery.post(ajaxurl, data, function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    сonsole.log(response);
                }
            });
        });
    }
    if (changeAccountButton) {
        changeAccountButton.addEventListener('click', function() {
            let data = {
                action: 'webvizio_change_account',
                security: nonce
            };
            jQuery.post(ajaxurl, data, function(response) {
                if (response.success) {
                    location.href = response.data.connect_url;
                } else {
                    сonsole.log(response);
                }
            });
        });
    }

    setUserButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            let userSection = this.closest('.w-user-block');
            let userId = userSection.dataset.userId;
            let data = {
                'action': 'webvizio_set_user',
                'user_id': userId,
                'security': nonce
            };
            jQuery.post(ajaxurl, data, function(response) {
                if (response.success) {
                    document.querySelectorAll('.w-user-block.active').forEach(function (el) {
                        el.classList.remove('active');
                    });
                    userSection.classList.add('active');
                }
            });
        });
    });

    removeUserButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            let userSection = this.closest('.w-user-block');
            let userId = userSection.dataset.userId;
            let data = {
                'action': 'webvizio_remove_user',
                'user_id': userId,
                'security': nonce
            };
            jQuery.post(ajaxurl, data, function(response) {
                if (response.success) {
                    userSection.classList.remove('active');
                }
            });
        });
    });
});