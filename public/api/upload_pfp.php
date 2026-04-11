<?php
$secret = $_POST['secret'] ?? '';
if ($secret !== 'SQBW1Jwl2fmmoHU4g7T4OEbSAIiaWsnRo6ndC5iMucU=') {
    die(json_encode(['error' => 'Unauthorized']));
}

$userid = $_POST['userid'];
if (!preg_match('/^[a-z0-9-]+$/i', $userid)) die("Invalid ID");

$target_dir = "../media/pfp/";
if (!file_exists($target_dir)) mkdir($target_dir, 0755, true);

$target_file = $target_dir . $userid . ".png";

if (move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
    echo json_encode(['success' => true, 'url' => "https://sposlearning.cz/media/pfp/$userid.png"]);
} else {
    echo json_encode(['error' => 'Upload failed']);
}
?>