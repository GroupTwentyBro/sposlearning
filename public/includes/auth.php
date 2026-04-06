<?php
// Configuration
define('KRATOS_PUBLIC_URL', 'https://auth.sposlearning.cz');
define('INTERNAL_API_URL', 'https://api.sposlearning.cz');
define('INTERNAL_API_SECRET', 'YX4gpXwbGsaZ6BoKQ4TuwQ=='); // MUST match your Node.js api.js file!

// Global cache so we don't make duplicate API calls on the same page load
$_AUTH_USER = null;
$_AUTH_DB_DATA = null;

function getKratosSession() {
    global $_AUTH_USER;
    if ($_AUTH_USER !== null) return $_AUTH_USER;

    // Grab all cookies sent by the user's browser
    $cookieString = isset($_SERVER['HTTP_COOKIE']) ? $_SERVER['HTTP_COOKIE'] : '';
    if (empty($cookieString)) {
        $_AUTH_USER = false;
        return false;
    }

    // 1. Ask Kratos to validate the session cookie
    $ch = curl_init(KRATOS_PUBLIC_URL . '/sessions/whoami');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Cookie: ' . $cookieString
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $_AUTH_USER = json_decode($response, true);
        return $_AUTH_USER;
    }

    $_AUTH_USER = false;
    return false;
}

function getDbData($kratosId) {
    global $_AUTH_DB_DATA;
    if ($_AUTH_DB_DATA !== null) return $_AUTH_DB_DATA;

    // 2. Ask our secure Node.js API for the user's database permissions
    $ch = curl_init(INTERNAL_API_URL . '/users/' . urlencode($kratosId));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'x-api-key: ' . INTERNAL_API_SECRET
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $_AUTH_DB_DATA = json_decode($response, true);
        return $_AUTH_DB_DATA;
    }

    $_AUTH_DB_DATA = false;
    return false;
}

// ==========================================
// --- YOUR NEW "FIREBASE RULES" IN PHP ---
// ==========================================

function isSignedIn() {
    $session = getKratosSession();
    return $session !== false && isset($session['active']) && $session['active'] === true;
}

function isEmailVerified() {
    if (!isSignedIn()) return false;
    $session = getKratosSession();
    $kratosId = $session['identity']['id'];

    $dbData = getDbData($kratosId);
    return $dbData !== false && $dbData['email_verified'] == 1;
}

function isAdmin() {
    if (!isSignedIn()) return false;
    $session = getKratosSession();
    $kratosId = $session['identity']['id'];

    $dbData = getDbData($kratosId);
    return $dbData !== false && $dbData['is_admin'] == 1;
}

function getCurrentUid() {
    $session = getKratosSession();
    return $session ? $session['identity']['id'] : null;
}
?>