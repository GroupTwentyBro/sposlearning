<?php
// Allow the admin subdomain to read the logs
header("Access-Control-Allow-Origin: https://admin.sposlearning.cz");
header("Access-Control-Allow-Headers: Content-Type, X-Admin-Secret");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$headers = getallheaders();
$secretKey = 'a8Fk2#9zLp$5vQx1@wErT'; // Your secret password

if (!isset($headers['X-Admin-Secret']) || $headers['X-Admin-Secret'] !== $secretKey) {
    http_response_code(403);
    exit('Forbidden');
}

// Locate the log file in the FTP root
$logFile = dirname(__DIR__, 2) . '/system_logs.jsonl';

if (file_exists($logFile)) {
    header('Content-Type: application/json');
    readfile($logFile);
} else {
    http_response_code(404);
    echo "Log file not found.";
}
?>