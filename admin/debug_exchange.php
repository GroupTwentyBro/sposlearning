<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

use Kreait\Firebase\Factory;

require_once __DIR__ . '/vendor/autoload.php';

$serviceAccountPath = __DIR__ . '/private/service-account.json';

try {
    $factory = (new Factory)->withServiceAccount($serviceAccountPath);
    $auth = $factory->createAuth();

    $input = json_decode(file_get_contents('php://input'), true);
    $idToken = $input['idToken'] ?? '';

    if (!$idToken) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing idToken']);
        exit;
    }

    $verifiedIdToken = $auth->verifyIdToken($idToken);
    $uid = $verifiedIdToken->claims()->get('sub');

    $customToken = $auth->createCustomToken($uid);

    // Use toString() to get the actual token string
    header('Content-Type: application/json');
    echo json_encode(['customToken' => $customToken->toString()]);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
}
