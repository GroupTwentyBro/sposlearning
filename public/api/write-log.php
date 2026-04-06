<?php
// Set CORS to allow both your main site and admin subdomain
$allowed_origins = ['https://www.sposlearning.cz', 'https://admin.sposlearning.cz'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data && isset($data['action'])) {
    $data['timestamp'] = date('Y-m-d H:i:s');
    $data['requestIP'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $data['type'] = $data['type'] ?? 'system';

    $logEntry = json_encode($data) . PHP_EOL;
    $logFile = __DIR__ . '/system_logs.jsonl';

    // Attempt to write. If this fails, it triggers the 500 error you saw.
    if (file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Permission denied to write log file."]);
    } else {
        echo json_encode(["status" => "success"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
}