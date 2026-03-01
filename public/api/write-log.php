<?php
// Allow the admin subdomain to write logs
header("Access-Control-Allow-Origin: https://admin.sposlearning.cz");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data && isset($data['action'])) {
    $data['timestamp'] = date('Y-m-d H:i:s');
    $data['requestIP'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $data['type'] = isset($data['type']) ? $data['type'] : 'system';

    $logEntry = json_encode($data) . PHP_EOL;
    $logFile = __DIR__ . '/system_logs.jsonl';

    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    echo json_encode(["status" => "success"]);
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
}
?>