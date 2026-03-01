<?php
// public/api/write-log.php

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data && isset($data['action']) && isset($data['userEmail'])) {

    $data['timestamp'] = date('Y-m-d H:i:s');
    // We add the IP address resolution here server-side!<?php
// public/api/write-log.php

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data && isset($data['action']) && isset($data['userEmail'])) {

    $data['timestamp'] = date('Y-m-d H:i:s');
    // We add the IP address resolution here server-side!
    $data['requestIP'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $data['type'] = isset($data['type']) ? $data['type'] : 'system';

    $logEntry = json_encode($data) . PHP_EOL;

    // Go up two directories (from public/api/ to the project root)
    $logFile = dirname(__DIR__, 2) . '/system_logs.jsonl';

    // Write the log file securely outside the web root
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

    echo json_encode(["status" => "success"]);
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
}
?>
    $data['requestIP'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $data['type'] = isset($data['type']) ? $data['type'] : 'system';

    $logEntry = json_encode($data) . PHP_EOL;

    // Go up two directories (from public/api/ to the project root)
    $logFile = dirname(__DIR__, 2) . '/system_logs.jsonl';

    // Write the log file securely outside the web root
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

    echo json_encode(["status" => "success"]);
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
}
?>