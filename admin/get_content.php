<?php
require 'vendor/autoload.php';

use Google\Cloud\Firestore\FirestoreClient;

// 1. Verify Kratos Session
$ch = curl_init("https://auth.sposlearning.cz/sessions/whoami");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_COOKIE, $_SERVER['HTTP_COOKIE'] ?? '');
$res = curl_exec($ch);
$session = json_decode($res, true);

// 2. Strict Admin Check
if (curl_getinfo($ch, CURLINFO_HTTP_CODE) !== 200 || !($session['identity']['metadata_public']['admin'] ?? false)) {
    header('HTTP/1.1 403 Forbidden');
    exit(json_encode(['error' => 'Unauthorized']));
}

// 3. Fetch from Firestore using Admin privileges
$firestore = new FirestoreClient(['keyFilePath' => __DIR__ . '/private/service-account.json']);
$docRef = $firestore->collection('admin-pages')->document('dashboard');
$snapshot = $docRef->snapshot();

if ($snapshot->exists()) {
    header('Content-Type: application/json');
    echo json_encode(['html' => $snapshot->get('html')]);
} else {
    header('HTTP/1.1 404 Not Found');
}