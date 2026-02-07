<?php
// Security: Only allow your website to call this script
header("Access-Control-Allow-Origin: https://sposlearning.cz");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // Sanitize inputs
    $title   = filter_var($data['title'], FILTER_SANITIZE_STRING);
    $name    = filter_var($data['name'], FILTER_SANITIZE_STRING);
    $message = filter_var($data['message'], FILTER_SANITIZE_STRING);
    $page    = filter_var($data['page'], FILTER_SANITIZE_STRING);
    $contact = filter_var($data['contact'], FILTER_SANITIZE_EMAIL);

    $to      = "itsteddy@zohomail.eu";
    $subject = "=?UTF-8?B?".base64_encode("New feedback: $title")."?=";

    // Construct Email Body
    $body = "Nová zpětná vazba na SPOŠLearning\n";
    $body .= "----------------------------------\n";
    $body .= "Od: $name\n";
    $body .= "E-mail: $contact\n";
    $body .= "Stránka: $page\n\n";
    $body .= "Zpráva:\n$message\n";

    // Headers for SPOŠLearning sender identity
    $headers = "From: SPOŠLearning <no-reply@sposlearning.cz>\r\n";
    $headers .= "Reply-To: $contact\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    if (mail($to, $subject, $body, $headers)) {
        echo json_encode(["status" => "success"]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Mail delivery failed"]);
    }
} else {
    http_response_code(405);
}
?>