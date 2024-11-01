<?php
/*
 * Plugin Name: Webvizio
 * Description: The Ultimate Visual Feedback, Collaboration & Productivity Tool for Web Professionals.
 * Version: 1.0.3
 * Requires at least: 5.7.0
 * Require PHP: 7.2
 * Author: Webvizio
 * Author URI: https://webvizio.com
 * License: GPL v2 or later
*/

if ( ! defined( 'ABSPATH' ) ) exit;
define( 'WEBVIZIO_DIR', dirname( __FILE__ ) );

define( 'WEBVIZIO_APP_URL', 'https://app.webvizio.com' );
define( 'WEBVIZIO_API_URL', 'https://app.webvizio.com/api/website-integration/wordpress/' );

class Webvizio_Plugin {
	public function __construct() {
		$this->routes_init();
		add_action( 'admin_enqueue_scripts', array( &$this, 'add_admin_scripts' ) );
		add_action( 'wp_head', array( &$this, 'add_scripts' ) );
		add_action( 'init', array( &$this, 'init_action' ) );
	}

	/**
	 * Autologin connected user if the website opened via Webvizio
	 * @return void
	 */
	public function init_action() {
		if (isset($_GET['webvizio_id'])) {
			$id = sanitize_key( $_GET['webvizio_id'] );
		} else {
			$id = false;
		}
		$webvizio_id_checked = false;
		if ( $id ) {
			$website_integration_uuid = get_option( 'webvizio_id', false );
			if ( $website_integration_uuid && $website_integration_uuid === $id ) {
				$webvizio_id_checked = true;
			}
		}
		if ( ( isset( $_SERVER['HTTP_SEC_FETCH_DEST'] ) && $_SERVER['HTTP_SEC_FETCH_DEST'] === 'iframe' ) || $webvizio_id_checked ) {
			if (isset($_GET['webvizio_token'])) {
				$token = sanitize_key( $_GET['webvizio_token'] );
				if ( $token && $token === get_option( 'webvizio_user_token', false ) ) {
					if ( ! is_user_logged_in() ) {
						$user_id = sanitize_key( get_option( 'webvizio_user', false ) );
						if ( ! $user_id ) {
							return false;
						}
						$user = get_user_by( 'id', $user_id );
						if ( $user ) {
							wp_set_current_user( $user_id, $user->user_login );
							wp_set_auth_cookie( $user_id );
							do_action( 'wp_login', $user->user_login, $user );
						}
					}
					show_admin_bar( false );
				}
			}
		}
	}

	/**
	 * Add scripts and styles for admin panel
	 * @return void
	 */
	public function add_admin_scripts() {
		wp_enqueue_script( 'webvizio_admin', plugin_dir_url( __FILE__ ) . 'js/webvizio-admin.js', array( 'jquery' ), '1.0.1', true);
		wp_enqueue_style( 'webvizio_admin-font', 'https://fonts.googleapis.com/css?family=Inter:400,500,600,700,900&subset=cyrillic,cyrillic-ext&display=swap', false, '1.0.0' );
		wp_enqueue_style( 'webvizio_admin_css', plugin_dir_url( __FILE__ ) . 'css/admin.css', array( 'webvizio_admin-font' ), '1.0.0' );
	}

	/**
	 * Add scripts for website
	 * @return void
	 */
	public function add_scripts() {
		if ( $this->is_connected() ) {
			wp_enqueue_script( 'webvizio_init', plugin_dir_url( __FILE__ ) . 'js/webvizio-init.js', '', '1.0.3');
		}
	}

	/**
	 * Add routes
	 * @return void
	 */
	public function routes_init() {
		add_action( 'admin_menu', function () {
			$icon_url = 'data:image/svg+xml;base64,' . base64_encode( '<svg width="20" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m7.688 1.815 1.748 4.883-1.93 5.367c-.184.51-.5.945-.91 1.253-.41.307-.892.472-1.387.473H3.871a.193.193 0 0 1-.116-.04.227.227 0 0 1-.076-.105L.012 3.502a.202.202 0 0 1 .017-.171.173.173 0 0 1 .06-.06.153.153 0 0 1 .077-.02h3.327a.17.17 0 0 1 .105.037.2.2 0 0 1 .066.098l1.615 5.185a.11.11 0 0 0 .037.053c.016.013.036.02.057.02.02 0 .04-.007.057-.02a.11.11 0 0 0 .036-.053l2.15-6.754a.157.157 0 0 1 .05-.074.133.133 0 0 1 .08-.03c.1 0-.017.1-.017.1l-.055.05" fill="#a7aaad"/><path d="M7.747 1.713h2.33c.373 0 .736.129 1.04.367.304.24.533.577.656.967l1.748 5.531a.11.11 0 0 0 .036.053c.017.013.037.02.057.02.02 0 .04-.007.057-.02a.11.11 0 0 0 .036-.053l2.388-7.195a1.78 1.78 0 0 1 .593-.85 1.51 1.51 0 0 1 .925-.323h2.26c.021 0 .041.007.06.018a.136.136 0 0 1 .044.045.159.159 0 0 1 .015.13l-4.238 11.67a2.71 2.71 0 0 1-.91 1.245 2.31 2.31 0 0 1-1.383.47h-1.355a.183.183 0 0 1-.11-.037.215.215 0 0 1-.073-.1L9.436 6.698 7.687 1.81l-.027-.065a.122.122 0 0 1 .087-.032Z" fill="#a7aaad"/></svg>' );
			add_menu_page( 'Webvizio', 'Webvizio', 'activate_plugins', 'webvizio', array(
				$this,
				'settings_page'
			), $icon_url, 50 );
		} );

		add_action( 'wp_ajax_webvizio_connect', array( $this, 'ajax_connect' ) );
		add_action( 'wp_ajax_webvizio_disconnect', array( $this, 'ajax_disconnect' ) );
		add_action( 'wp_ajax_webvizio_set_user', array( $this, 'ajax_set_user' ) );
		add_action( 'wp_ajax_webvizio_remove_user', array( $this, 'ajax_remove_user' ) );
		add_action( 'wp_ajax_webvizio_change_account', array( $this, 'ajax_change_account' ) );

		add_action( 'rest_api_init', function () {
			register_rest_route( 'webvizio/', '/check', array(
				'methods'  => 'GET',
				'callback' => array( $this, 'route_check' ),
			) );
			register_rest_route( 'webvizio/', '/refresh-token', array(
				'methods'  => 'POST',
				'callback' => array( $this, 'route_refresh_token' ),
			) );
		} );
	}

	/**
	 * Connect the website to Webvizio
	 *
	 * @return void
	 */
	public function ajax_connect() {
		check_ajax_referer( 'webvizio_settings_nonce', 'security' );

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error();
		}
		$uuid = get_option( 'webvizio_id', false );
		if ( ! $uuid ) {
			$uuid = wp_generate_uuid4();
			add_option( 'webvizio_id', $uuid );
		}
		$token = base64_encode( $uuid . '|' . get_site_url() );
		$url = WEBVIZIO_APP_URL . '/website-integration/wordpress/connect?token=' . $token;

		wp_send_json_success( [
			'connect_url' => $url,
		] );
	}

	/**
	 * Change the Webvizio account
	 * @return void
	 */
	public function ajax_change_account() {
		check_ajax_referer( 'webvizio_settings_nonce', 'security' );

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error();
		}
		$uuid = get_option( 'webvizio_id', false );
		if ( ! $uuid ) {
			$uuid = wp_generate_uuid4();
			add_option( 'webvizio_id', $uuid );
		}
		$token = base64_encode( $uuid . '|' . get_site_url() );
		$url = WEBVIZIO_APP_URL . '/website-integration/wordpress/connect?token=' . $token;

		delete_option( 'webvizio_user' );
		delete_option( 'webvizio_user_token' );

		wp_send_json_success( [
			'connect_url' => $url,
		] );
	}

	/**
	 * Connect user to Webvizio
	 * @return void
	 */
	public function ajax_set_user() {
		check_ajax_referer( 'webvizio_settings_nonce', 'security' );

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error();
		}
		$user_id = sanitize_key( $_POST['user_id'] ) ?? null;
		if ( null === $user_id ) {
			wp_send_json_error();
		}

		$login_token = bin2hex( random_bytes( 16 ) );
		$result = $this->send_api_request( 'set-settings', [ 'user_token' => $login_token ], [], true );
		if ( ! $result->success ) {
			wp_send_json_error();
		}
		update_option( 'webvizio_user', $user_id );
		update_option( 'webvizio_user_token', $login_token );

		wp_send_json_success();
	}

	/**
	 * Disconnect user from Webvizio
	 * @return void
	 */
	public function ajax_remove_user() {
		check_ajax_referer( 'webvizio_settings_nonce', 'security' );

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error();
		}
		$user_id = sanitize_key( $_POST['user_id'] ) ?? null;
		if ( null === $user_id ) {
			wp_send_json_error();
		}
		$active_user_id = get_option( 'webvizio_user', false );
		if ( $active_user_id && $active_user_id === $user_id ) {
			delete_option( 'webvizio_user' );
			delete_option( 'webvizio_user_token' );
			wp_send_json_success();
		} else {
			wp_send_json_error();
		}
	}

	/**
	 * Disconnects the website from Webvizio.
	 *
	 * @return void
	 */
	public function ajax_disconnect() {
		check_ajax_referer( 'webvizio_settings_nonce', 'security' );

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error();
		}
		$disconnect_response = $this->send_api_request( 'disconnect', [], [], true );
		if ( $disconnect_response && $disconnect_response->success ) {
			delete_option( 'webvizio_id' );
			delete_option( 'webvizio_user' );
			delete_option( 'webvizio_user_token' );
			update_option( 'webvizio_connected', false );
			wp_send_json_success();
		} else {
			wp_send_json_error();
		}
	}

	/**
	 * Checks if Webvizio integration UUID matches the stored UUID on the website
	 *
	 * @return void
	 */
	public function route_check() {
		$check_uuid = sanitize_key( $_GET['uuid'] ) ?? false;
		if ( ! $check_uuid ) {
			wp_send_json_error();
		}
		$uuid = get_option( 'webvizio_id', false );

		if ( $check_uuid === $uuid ) {
			wp_send_json_success();
		} else {
			wp_send_json_error();
		}
	}

	/**
	 * Refreshes the user token for user autologin iin webvizio
	 *
	 * @return void
	 */
	public function route_refresh_token() {
		$request_uuid = sanitize_key( $_GET['uuid'] ) ?? false;
		if ( ! $request_uuid ) {
			wp_send_json_error();
		}
		$uuid = get_option( 'webvizio_id', false );
		if ( $request_uuid !== $uuid ) {
			wp_send_json_error();
		}

		$login_token = bin2hex( random_bytes( 16 ) );
		$result = $this->send_api_request( 'set-settings', [ 'user_token' => $login_token ], [], true );
		if ( ! $result->success ) {
			wp_send_json_error();
		}
		update_option( 'webvizio_user_token', $login_token );
		wp_send_json_success();
	}

	/**
	 * Renders the settings page.
	 *
	 * @return void
	 */
	public function settings_page() {
		$connection = $this->send_api_request( 'get-connection' );
		if ( $connection && $connection->success ) {
			$data = [
				'is_iframe_allowed' => true,
				'is_https'          => true,
				'connected'         => true,
				'users'             => get_users(),
				'active_user'       => get_option( 'webvizio_user', 0 ),
				'account'           => $connection->result->account,
			];
			if ( ! $this->is_connected() ) {
				update_option( 'webvizio_connected', true );
			}
		} else {
			$data = [
				'is_iframe_allowed' => $this->is_iframe_allowed( get_site_url() ),
				'is_https'          => wp_is_using_https(),
				'connected'         => false,
			];
			if ( $this->is_connected() ) {
				update_option( 'webvizio_connected', false );
				delete_option( 'webvizio_user' );
				delete_option( 'webvizio_user_token' );
			}
		}
		$data['nonce'] = wp_create_nonce( 'webvizio_settings_nonce');
		$html = $this->render_template( 'settings-page-tpl.php', $data );
		echo $html;
	}

	/**
	 * Sends an API request to a specified route with optional data, URL request parameters, and request method.
	 *
	 * @param string $route The API route to send the request to.
	 * @param mixed $data (optional) The data to send in the request body. Default is false.
	 * @param array $urlRequest (optional) The URL request parameters to append to the route. Default is an empty array.
	 * @param bool $postRequest (optional) Whether to use POST request method. Default is false (GET request method).
	 *
	 * @return mixed|false The response from the API request, parsed as JSON, or false on failure.
	 */
	private function send_api_request( $route, $data = false, $urlRequest = [], $postRequest = false ) {
		$uuid = get_option( 'webvizio_id', false );
		if ( ! $uuid ) {
			return false;
		}

		$urlRequestParams = http_build_query( $urlRequest );

		if ( ! empty( $urlRequestParams ) ) {
			$urlRequestParams = '?' . $urlRequestParams . $urlRequestParams;
		}

		$url = WEBVIZIO_API_URL . $uuid . '/' . $route . $urlRequestParams;

		$args = array(
			'headers'   => array(
				'Content-Type' => 'application/json; charset=utf-8',
			),
			'sslverify' => false,
		);

		if ( $data ) {
			$args['body'] = wp_json_encode( $data );
		}

		if ( $postRequest ) {
			$response = wp_remote_post( $url, $args );
		} else {
			$response = wp_remote_get( $url, $args );
		}

		if ( is_wp_error( $response ) ) {
			return false;
		} else {
			return json_decode( wp_remote_retrieve_body( $response ) );
		}
	}

	/**
	 * Checks if the website is currently connected to the Webvizio.
	 *
	 * @return bool True if connected, false otherwise.
	 */
	public function is_connected() {
		return get_option( 'webvizio_connected', false );
	}

	/**
	 * Check if website is accessible via iframe
	 *
	 * @param string $url
	 *
	 * @return boolean
	 */
	private function is_iframe_allowed( $url ) {
		//return true;
		$response = wp_remote_get( $url );

		if ( is_wp_error( $response ) ) {
			return true;
		}

		$headers = wp_remote_retrieve_headers( $response );

		if ( isset( $headers['x-frame-options'] ) ) {
			return false;
		} else {
			return true;
		}
	}


	/**
	 * Renders a template file with the provided template data.
	 *
	 * @param string $template The path to the template file to render.
	 * @param array $template_data (optional) The data to pass to the template. Default is an empty array.
	 *
	 * @return string The rendered HTML content of the template.
	 */
	private function render_template( $template, $template_data = array() ) {
		ob_start();
		set_query_var( 'template_data', $template_data );
		include( WEBVIZIO_DIR . "/" . $template );
		$html = ob_get_contents();
		ob_end_clean();
		return $html;
	}

	/**
	 * @return void
	 */
	public static function install() {

	}

	/**
	 * @return void
	 */
	public static function uninstall() {
		$uuid = get_option( 'webvizio_id', false );
		if ( $uuid ) {
			$url = WEBVIZIO_API_URL . $uuid . '/disconnect';
			$args = array(
				'headers'   => array(
					'Content-Type' => 'application/json; charset=utf-8',
				),
				'sslverify' => false,
			);
			wp_remote_post( $url, $args );
		}
		delete_option( 'webvizio_id' );
		delete_option( 'webvizio_user' );
		delete_option( 'webvizio_user_token' );
		delete_option( 'webvizio_connected' );
	}
}

new Webvizio_Plugin();
register_activation_hook( __FILE__, array( 'Webvizio_Plugin', 'install' ) );
register_deactivation_hook( __FILE__, array( 'Webvizio_Plugin', 'uninstall' ) );