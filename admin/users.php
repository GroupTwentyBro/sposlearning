<?php
// users.php - Admin API endpoint
// This file should return ONLY JSON. All errors are logged.
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Start output buffering to catch any accidental output
ob_start();

use Kreait\Firebase\Factory;
use Kreait\Firebase\Exception\Auth\UserNotFound;
use Kreait\Firebase\Exception\AuthException;

require_once __DIR__ . '/vendor/autoload.php';

// Log file – make sure the directory exists and is writable
$logFile = __DIR__ . '/logs/debug.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

function writeLog($message) {
    global $logFile;
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - " . $message . "\n", FILE_APPEND);
}

writeLog("Script started");

// Service account check
$serviceAccountPath = __DIR__ . '/private/service-account.json';
if (!file_exists($serviceAccountPath)) {
    writeLog("Service account file not found: $serviceAccountPath");
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error']);
    exit;
}

try {
    $factory = (new Factory)->withServiceAccount($serviceAccountPath);
    $auth = $factory->createAuth();
} catch (Exception $e) {
    writeLog("Failed to initialize Firebase: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Firebase initialization failed']);
    exit;
}

/**
 * Verify the ID token and check for admin custom claim.
 */
function verifyAdminToken($idToken) {
    global $factory;
    try {
        $auth = $factory->createAuth();
        $verifiedToken = $auth->verifyIdToken($idToken);
        $claims = $verifiedToken->claims();
        $uid = $claims->get('sub');

        // Check for admin custom claim
        if (!$claims->get('admin', false)) {
            writeLog("User $uid is not admin (custom claim missing/false)");
            return null;
        }

        writeLog("Admin verified: $uid");
        return $uid;
    } catch (Exception $e) {
        writeLog("Token verification failed: " . $e->getMessage());
        return null;
    }
}

// Ensure we only handle POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    writeLog("Invalid JSON input");
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$action = $input['action'] ?? '';
$idToken = $input['idToken'] ?? '';
$targetUid = $input['uid'] ?? '';
$email = $input['email'] ?? '';

writeLog("Action: $action");

$adminUid = verifyAdminToken($idToken);
if (!$adminUid) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$response = ['success' => false];

try {
    switch ($action) {
        case 'listUsers':
            $users = [];
            $page = $auth->listUsers(1000, 1000);
            foreach ($page as $user) {
                $users[] = [
                    'uid' => $user->uid,
                    'email' => $user->email,
                    'displayName' => $user->displayName,
                    'emailVerified' => $user->emailVerified,
                    'disabled' => $user->disabled,
                    'customClaims' => $user->customClaims ?? [],
                    'createdAt' => $user->metadata->createdAt ? $user->metadata->createdAt->format('c') : null,
                    'lastLoginAt' => $user->metadata->lastLoginAt ? $user->metadata->lastLoginAt->format('c') : null,
                ];
            }
            $response = ['success' => true, 'users' => $users];
            break;

        case 'deleteUser':
            $auth->deleteUser($targetUid);
            $response = ['success' => true, 'message' => "User $targetUid deleted"];
            break;

        case 'sendPasswordReset':
            $link = $auth->generatePasswordResetLink($email);
            $response = ['success' => true, 'link' => $link];
            break;

        case 'sendEmailVerification':
            $link = $auth->generateEmailVerificationLink($email);
            $response = ['success' => true, 'link' => $link];
            break;

        case 'toggleAdmin':
            $user = $auth->getUser($targetUid);
            $currentClaims = $user->customClaims ?? [];
            $newAdminStatus = !($currentClaims['admin'] ?? false);
            $newClaims = array_merge($currentClaims, ['admin' => $newAdminStatus]);
            $auth->setCustomUserClaims($targetUid, $newClaims);
            $response = ['success' => true, 'isAdmin' => $newAdminStatus];
            break;

        default:
            $response = ['error' => 'Invalid action'];
    }
} catch (UserNotFound $e) {
    $response = ['error' => 'User not found'];
    writeLog("UserNotFound: " . $e->getMessage());
} catch (AuthException $e) {
    $response = ['error' => $e->getMessage()];
    writeLog("AuthException: " . $e->getMessage());
} catch (Exception $e) {
    $response = ['error' => 'Internal server error'];
    writeLog("Uncaught Exception: " . $e->getMessage());
}

// Clean the output buffer and send JSON
ob_clean();
header('Content-Type: application/json');
echo json_encode($response);
exit;