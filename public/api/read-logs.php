<?php
// public/api/read-logs.php

header("Access-Control-Allow-Origin: https://admin.sposlearning.cz");
header("Access-Control-Allow-Headers: Content-Type, X-Admin-Secret");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Credentials: true"); // Required to receive cookies

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$headers = getallheaders();
$secretKey = 'a8Fk2#9zLp$5vQx1@wErT';
$kratosUrl = "https://auth.sposlearning.cz/sessions/whoami";

// 1. Basic Secret Key Check
if (!isset($headers['X-Admin-Secret']) || $headers['X-Admin-Secret'] !== $secretKey) {
    http_response_code(403);
    exit('Forbidden: Invalid Secret');
}

// 2. Kratos Session & Admin Check
if (!isset($_COOKIE['ory_kratos_session'])) {
    http_response_code(401);
    exit('Unauthorized: No Session');
}

$ch = curl_init($kratosUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Cookie: ory_kratos_session=' . $_COOKIE['ory_kratos_session']
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(401);
    exit('Unauthorized: Kratos session invalid');
}

$session = json_decode($response, true);
$isAdmin = isset($session['identity']['metadata_public']['admin']) && $session['identity']['metadata_public']['admin'] === true;

if (!$isAdmin) {
    http_response_code(403);
    exit('Forbidden: Not an admin');
}

// 3. Serve the file
$logFile = __DIR__ . '/system_logs.jsonl';

if (file_exists($logFile)) {
    header('Content-Type: application/json');
    readfile($logFile);
} else {
    http_response_code(404);
    echo json_encode(["error" => "Log file not found"]);
}