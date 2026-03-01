<?php
$headers = getallheaders();
$secretKey = 'a8Fk2#9zLp$5vQx1@wErT'; // Change this to a random string!

if (!isset($headers['X-Admin-Secret']) || $headers['X-Admin-Secret'] !== $secretKey) {
    http_response_code(403);
    exit('Forbidden');
}

// 2. Locate the log file outside the public directory
$logFile = dirname(__DIR__, 3) . '/system_logs.jsonl';

// 3. Serve the file contents
if (file_exists($logFile)) {
    header('Content-Type: application/json');
    readfile($logFile);
} else {
    http_response_code(404);
    echo "Log file not found.";
}
?>