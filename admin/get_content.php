<?php
require 'vendor/autoload.php';

use Google\Cloud\Firestore\FirestoreClient;

header('Content-Type: application/json');

try {
    // 1. Verify Kratos Session
    $ch = curl_init("https://auth.sposlearning.cz/sessions/whoami");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIE, $_SERVER['HTTP_COOKIE'] ?? '');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Add this if using self-signed certs/tunnels

    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($status !== 200) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid Kratos Session']);
        exit;
    }

    $session = json_decode($res, true);
    $isAdmin = $session['identity']['metadata_public']['admin'] ?? false;

    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'User is not admin']);
        exit;
    }

    // 2. Fetch from Firestore
    // Ensure this path matches where your JSON file is on the server!
    $firestore = new FirestoreClient([
        'keyFilePath' => __DIR__ . '/google-services.json'
    ]);

    $docRef = $firestore->collection('admin-pages')->document('dashboard');
    $snapshot = $docRef->snapshot();

    if ($snapshot->exists()) {
        echo json_encode(['html' => $snapshot->get('html')]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Content not found']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server Error', 'message' => $e->getMessage()]);
}