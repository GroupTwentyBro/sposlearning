<?php
// public/api/read-logs.php

header("Access-Control-Allow-Origin: https://admin.sposlearning.cz");
header("Access-Control-Allow-Headers: Content-Type, X-Admin-Secret");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$headers = getallheaders();
$secretKey = 'a8Fk2#9zLp$5vQx1@wErT'; // Must match logs.js

if (!isset($headers['X-Admin-Secret']) || $headers['X-Admin-Secret'] !== $secretKey) {
    http_response_code(403);
    exit('Forbidden');
}

$logFile = __DIR__ . '/system_logs.jsonl';

if (file_exists($logFile)) {
    header('Content-Type: application/json');
    readfile($logFile);
} else {
    http_response_code(404);
    echo json_encode(["error" => "Log file not found at " . $logFile]);
}