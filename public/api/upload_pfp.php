<?php
header('Content-Type: application/json');

// This tells us what method was used and what data arrived
$debug = [
    "method" => $_SERVER['REQUEST_METHOD'],
    "post_data" => $_POST,
    "files_received" => array_keys($_FILES),
    "content_type" => $_SERVER['CONTENT_TYPE'] ?? 'none'
];

$secret = $_POST['secret'] ?? '';
$expected = 'SQBW1Jwl2fmmoHU4g7T4OEbSAIiaWsnRo6ndC5iMucU=';

if ($secret !== $expected) {
    $debug['error'] = 'Unauthorized';
    die(json_encode($debug));
}

die(json_encode(["success" => true, "message" => "Secret matched!"]));