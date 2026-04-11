<?php
header('Content-Type: application/json');

$secret = $_POST['secret'] ?? '';
if ($secret !== 'SQBW1Jwl2fmmoHU4g7T4OEbSAIiaWsnRo6ndC5iMucU=') {
    die(json_encode(['success' => false, 'error' => 'Unauthorized']));
}

$userid = $_POST['userid'] ?? 'unknown';
$target_dir = "../media/pfp/";

// 1. Check if directory exists/is writable
if (!file_exists($target_dir)) {
    if (!mkdir($target_dir, 0777, true)) {
        die(json_encode(['success' => false, 'error' => 'Could not create directory']));
    }
}

if (!is_writable($target_dir)) {
    die(json_encode(['success' => false, 'error' => 'Directory not writable. Current perms: ' . substr(sprintf('%o', fileperms($target_dir)), -4)]));
}

// 2. Check if file was actually sent
if (!isset($_FILES["image"])) {
    die(json_encode(['success' => false, 'error' => 'No file in _FILES array', 'debug' => $_FILES]));
}

$target_file = $target_dir . $userid . ".png";

// 3. Try to save
if (move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
    // Return EXACTLY 'success' => true so Node.js sees it
    echo json_encode([
        'success' => true,
        'url' => "https://www.sposlearning.cz/media/pfp/$userid.png"
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'move_uploaded_file failed',
        'php_error' => error_get_last()
    ]);
}
?>